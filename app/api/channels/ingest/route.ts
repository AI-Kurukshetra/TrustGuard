import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { analyzeTransaction } from "@/lib/trustguard-data";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const channel = typeof body.channel === "string" && body.channel.trim() !== "" ? body.channel : "web";

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const analyze = body.analyze_transaction !== false;
  const client = auth.context.supabase;

  const lookbackDays = 30;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: transactions, error: transactionError } = await client
    .from("transactions")
    .select("risk_score, status")
    .eq("merchant_id", auth.context.merchantId)
    .eq("channel", channel)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (transactionError) {
    return NextResponse.json({ error: transactionError.message }, { status: 400 });
  }

  const sampleCount = (transactions ?? []).length;
  const blockedCount = (transactions ?? []).filter((item) => item.status === "blocked").length;
  const reviewCount = (transactions ?? []).filter((item) => item.status === "review").length;
  const avgRiskScore =
    sampleCount > 0
      ? (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) / sampleCount
      : 0;
  const blockRatePct = sampleCount > 0 ? (blockedCount / sampleCount) * 100 : 0;
  const reviewRatePct = sampleCount > 0 ? (reviewCount / sampleCount) * 100 : 0;

  const baselinePayload = {
    merchant_id: auth.context.merchantId,
    channel,
    sample_count: sampleCount,
    avg_risk_score: Number(avgRiskScore.toFixed(2)),
    block_rate_pct: Number(blockRatePct.toFixed(2)),
    review_rate_pct: Number(reviewRatePct.toFixed(2)),
    last_event_at: new Date().toISOString(),
    metadata: {
      lookback_days: lookbackDays,
      source: "channel_ingest"
    }
  };

  const { data: baselineData, error: baselineError } = await client
    .from("channel_risk_baselines")
    .upsert(baselinePayload, { onConflict: "merchant_id,channel" })
    .select("id, channel, sample_count, avg_risk_score, block_rate_pct, review_rate_pct, last_event_at")
    .single();

  if (baselineError) {
    return NextResponse.json({ error: baselineError.message }, { status: 400 });
  }

  let analysis: Awaited<ReturnType<typeof analyzeTransaction>> | null = null;
  if (analyze) {
    const channelRiskScore = Math.max(0, Math.min(100, Math.round(avgRiskScore * 0.6 + blockRatePct * 0.9)));
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount is required for analyze_transaction=true" }, { status: 400 });
    }

    analysis = await analyzeTransaction(
      {
        ...body,
        amount,
        channel,
        channel_risk_score: channelRiskScore,
        merchant_id: auth.context.merchantId,
        raw_payload: body
      },
      client
    );
  }

  return NextResponse.json({
    channel,
    baseline: baselineData,
    analysis
  });
}
