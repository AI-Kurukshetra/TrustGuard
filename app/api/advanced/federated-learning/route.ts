import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { checkFeatureAccess } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "federated_learning"
  });
  if (!featureAccess.allowed) {
    return NextResponse.json(
      { error: `Feature unavailable on ${featureAccess.planTier} plan. Upgrade required.` },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await auth.context.supabase
    .from("federated_learning_rounds")
    .select(
      "id, round_name, target_model_id, status, participant_count, aggregation_payload, started_at, completed_at, created_at"
    )
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "federated_learning"
  });
  if (!featureAccess.allowed) {
    return NextResponse.json(
      { error: `Feature unavailable on ${featureAccess.planTier} plan. Upgrade required.` },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const roundName =
    typeof body.round_name === "string" && body.round_name.trim() !== ""
      ? body.round_name.trim()
      : `round-${new Date().toISOString()}`;
  const participantCount = Math.max(1, Math.min(10000, Number(body.participant_count ?? 10)));
  const status =
    typeof body.status === "string" && ["planned", "running", "completed", "failed"].includes(body.status)
      ? body.status
      : "running";

  const nowIso = new Date().toISOString();
  const completedAt = status === "completed" ? nowIso : null;
  const { data, error } = await auth.context.supabase
    .from("federated_learning_rounds")
    .insert({
      merchant_id: auth.context.merchantId,
      round_name: roundName,
      target_model_id: typeof body.target_model_id === "string" ? body.target_model_id : null,
      status,
      participant_count: participantCount,
      aggregation_payload:
        typeof body.aggregation_payload === "object" && body.aggregation_payload
          ? body.aggregation_payload
          : {
              secure_aggregation: true,
              differential_privacy_epsilon: Number(body.epsilon ?? 4),
              update_norm_clip: Number(body.norm_clip ?? 1.5)
            },
      started_at: status === "planned" ? null : nowIso,
      completed_at: completedAt
    })
    .select(
      "id, round_name, target_model_id, status, participant_count, aggregation_payload, started_at, completed_at, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
