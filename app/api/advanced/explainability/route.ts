import { NextRequest, NextResponse } from "next/server";
import { buildExplainabilityFactors } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { checkFeatureAccess } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "viewer");
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

  let featureSnapshot =
    typeof body.feature_snapshot === "object" && body.feature_snapshot
      ? (body.feature_snapshot as Record<string, unknown>)
      : {};
  let reasons = Array.isArray(body.reasons) ? body.reasons.filter((item): item is string => typeof item === "string") : [];
  let riskScore = Number(body.risk_score ?? 0);
  const transactionId = typeof body.transaction_id === "string" ? body.transaction_id : null;

  if (transactionId && hasSupabaseEnv() && auth.context.supabase) {
    const { data: scoreData } = await auth.context.supabase
      .from("risk_scores")
      .select("score, reasons, feature_snapshot")
      .eq("merchant_id", auth.context.merchantId)
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scoreData) {
      riskScore = Number(scoreData.score ?? riskScore);
      if (reasons.length === 0 && Array.isArray(scoreData.reasons)) {
        reasons = scoreData.reasons.filter((item): item is string => typeof item === "string");
      }
      if (
        Object.keys(featureSnapshot).length === 0 &&
        scoreData.feature_snapshot &&
        typeof scoreData.feature_snapshot === "object"
      ) {
        featureSnapshot = scoreData.feature_snapshot as Record<string, unknown>;
      }
    }
  }

  const factors = buildExplainabilityFactors({
    riskScore,
    featureSnapshot,
    reasons
  });

  const narrative = factors.slice(0, 3).map((factor) => `${factor.feature}:${factor.contribution}`).join(" | ");

  if (hasSupabaseEnv() && auth.context.supabase) {
    await auth.context.supabase.from("explainability_reports").insert({
      merchant_id: auth.context.merchantId,
      transaction_id: transactionId,
      risk_score: Math.max(0, Math.min(100, Math.round(riskScore))),
      explanation_method: typeof body.method === "string" ? body.method : "factor_attribution_v1",
      factors,
      narrative
    });
  }

  return NextResponse.json({
    transaction_id: transactionId,
    risk_score: Math.max(0, Math.min(100, Math.round(riskScore))),
    factors,
    narrative,
    method: typeof body.method === "string" ? body.method : "factor_attribution_v1"
  });
}
