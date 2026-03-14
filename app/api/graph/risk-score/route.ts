import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { computeGraphRiskScore } from "@/lib/advanced-intelligence";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const { data, error } = await auth.context.supabase
    .from("graph_risk_findings")
    .select("id, cluster_key, risk_score, entity_count, connection_count, finding_payload, detected_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("risk_score", { ascending: false })
    .limit(Math.max(1, Math.min(200, Number.isFinite(limit) ? limit : 50)));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const lookbackDays = Math.max(1, Math.min(365, Number(body.lookback_days ?? 90)));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const client = auth.context.supabase;

  const [{ data: connections, error: connectionsError }, { data: riskScores, error: riskError }] =
    await Promise.all([
      client
        .from("entity_connections")
        .select("left_entity_type, left_entity_id, right_entity_type, right_entity_id, weight, relation_type")
        .eq("merchant_id", auth.context.merchantId)
        .gte("last_seen_at", since),
      client
        .from("risk_scores")
        .select("entity_type, entity_id, score")
        .eq("merchant_id", auth.context.merchantId)
        .in("entity_type", ["user", "device", "payment_method"]) 
        .gte("created_at", since)
    ]);

  if (connectionsError || riskError) {
    return NextResponse.json({ error: connectionsError?.message ?? riskError?.message ?? "Query failed" }, { status: 400 });
  }

  const riskMap = new Map<string, number>();
  for (const row of riskScores ?? []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const score = Number(row.score ?? 0);
    const previous = riskMap.get(key) ?? 0;
    if (score > previous) {
      riskMap.set(key, score);
    }
  }

  type ClusterAccumulator = {
    clusterKey: string;
    entities: Set<string>;
    connectionCount: number;
    weightSum: number;
    highRiskNodeCount: number;
    sampleRelations: string[];
  };

  const clusters = new Map<string, ClusterAccumulator>();
  for (const connection of connections ?? []) {
    const clusterKey = `${connection.left_entity_type}:${connection.left_entity_id}`;
    const existing = clusters.get(clusterKey) ?? {
      clusterKey,
      entities: new Set<string>(),
      connectionCount: 0,
      weightSum: 0,
      highRiskNodeCount: 0,
      sampleRelations: []
    };

    const leftNode = `${connection.left_entity_type}:${connection.left_entity_id}`;
    const rightNode = `${connection.right_entity_type}:${connection.right_entity_id}`;

    existing.entities.add(leftNode);
    existing.entities.add(rightNode);
    existing.connectionCount += 1;
    existing.weightSum += Number(connection.weight ?? 1);

    if ((riskMap.get(leftNode) ?? 0) >= 70) {
      existing.highRiskNodeCount += 1;
    }
    if ((riskMap.get(rightNode) ?? 0) >= 70) {
      existing.highRiskNodeCount += 1;
    }

    if (existing.sampleRelations.length < 8) {
      existing.sampleRelations.push(String(connection.relation_type ?? "related"));
    }

    clusters.set(clusterKey, existing);
  }

  const nowIso = new Date().toISOString();
  const upsertRows = Array.from(clusters.values())
    .map((cluster) => {
      const avgEdgeWeight = cluster.connectionCount > 0 ? cluster.weightSum / cluster.connectionCount : 0;
      const graphScore = computeGraphRiskScore({
        entityCount: cluster.entities.size,
        connectionCount: cluster.connectionCount,
        highRiskNodeCount: cluster.highRiskNodeCount,
        avgEdgeWeight
      });

      return {
        merchant_id: auth.context.merchantId,
        cluster_key: cluster.clusterKey,
        risk_score: graphScore.score,
        entity_count: cluster.entities.size,
        connection_count: cluster.connectionCount,
        finding_payload: {
          high_risk_node_count: cluster.highRiskNodeCount,
          density: graphScore.density,
          avg_edge_weight: Number(avgEdgeWeight.toFixed(4)),
          sample_relations: cluster.sampleRelations
        },
        detected_at: nowIso
      };
    })
    .sort((left, right) => Number(right.risk_score) - Number(left.risk_score));

  if (upsertRows.length === 0) {
    return NextResponse.json({ data: [], generated: 0 });
  }

  const { data, error } = await client
    .from("graph_risk_findings")
    .upsert(upsertRows, { onConflict: "merchant_id,cluster_key" })
    .select("id, cluster_key, risk_score, entity_count, connection_count, finding_payload, detected_at")
    .order("risk_score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ generated: (data ?? []).length, data: data ?? [] });
}
