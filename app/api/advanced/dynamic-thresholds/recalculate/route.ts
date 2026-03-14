import { NextRequest, NextResponse } from "next/server";
import { computeDynamicThresholds } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { checkFeatureAccess } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "advanced_detection_suite"
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

  const lookbackDays = Math.max(7, Math.min(180, Number(body.lookback_days ?? 30)));
  const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const client = auth.context.supabase;
  const [{ data: merchant }, { data: transactions }, { data: cases }, { count: chargebackCount }] = await Promise.all([
    client
      .from("merchants")
      .select("risk_threshold_review, risk_threshold_block, settings")
      .eq("id", auth.context.merchantId)
      .single(),
    client
      .from("transactions")
      .select("risk_score, status")
      .eq("merchant_id", auth.context.merchantId)
      .gte("occurred_at", sinceIso)
      .limit(5000),
    client
      .from("fraud_cases")
      .select("status, outcome")
      .eq("merchant_id", auth.context.merchantId)
      .gte("created_at", sinceIso)
      .limit(2000),
    client
      .from("chargebacks")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", auth.context.merchantId)
      .gte("received_at", sinceIso)
  ]);

  const totalTransactions = (transactions ?? []).length;
  const blockedCount = (transactions ?? []).filter((item) => item.status === "blocked").length;
  const avgRiskScore =
    totalTransactions > 0
      ? (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) / totalTransactions
      : 0;

  const falsePositiveCases = (cases ?? []).filter(
    (item) => item.outcome === "approved" || item.status === "resolved"
  ).length;
  const falsePositiveRatePct = (cases ?? []).length > 0 ? (falsePositiveCases / (cases ?? []).length) * 100 : 0;
  const blockRatePct = totalTransactions > 0 ? (blockedCount / totalTransactions) * 100 : 0;
  const chargebackRatePct = totalTransactions > 0 ? ((chargebackCount ?? 0) / totalTransactions) * 100 : 0;

  const adjustment = computeDynamicThresholds({
    avgRiskScore,
    blockRatePct,
    chargebackRatePct,
    falsePositiveRatePct,
    currentReviewThreshold: Number(merchant?.risk_threshold_review ?? 60),
    currentBlockThreshold: Number(merchant?.risk_threshold_block ?? 85)
  });

  const currentSettings =
    merchant?.settings && typeof merchant.settings === "object"
      ? (merchant.settings as Record<string, unknown>)
      : {};

  const dynamicThresholds = {
    updated_at: new Date().toISOString(),
    lookback_days: lookbackDays,
    avg_risk_score: Number(avgRiskScore.toFixed(2)),
    block_rate_pct: Number(blockRatePct.toFixed(2)),
    chargeback_rate_pct: Number(chargebackRatePct.toFixed(2)),
    false_positive_rate_pct: Number(falsePositiveRatePct.toFixed(2)),
    rationale: adjustment.rationale
  };

  const { error: updateError } = await client
    .from("merchants")
    .update({
      risk_threshold_review: adjustment.reviewThreshold,
      risk_threshold_block: adjustment.blockThreshold,
      settings: {
        ...currentSettings,
        dynamic_thresholds: dynamicThresholds
      }
    })
    .eq("id", auth.context.merchantId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      review_threshold: adjustment.reviewThreshold,
      block_threshold: adjustment.blockThreshold,
      rationale: adjustment.rationale,
      metrics: dynamicThresholds
    }
  });
}
