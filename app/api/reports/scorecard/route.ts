import { NextRequest, NextResponse } from "next/server";
import { getMerchantBillingSnapshot } from "@/lib/billing";
import { requireMerchantAuth } from "@/lib/api-auth";
import { getDashboardKpiSummaryData } from "@/lib/trustguard-data";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function clampDays(raw: number) {
  if (!Number.isFinite(raw)) {
    return 30;
  }
  return Math.min(180, Math.max(7, Math.round(raw)));
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const days = clampDays(Number(request.nextUrl.searchParams.get("days") ?? "30"));
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [billing, kpis] = await Promise.all([
    getMerchantBillingSnapshot(auth.context.supabase ?? null, auth.context.merchantId),
    getDashboardKpiSummaryData(days, auth.context.merchantId, auth.context.supabase ?? undefined)
  ]);

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({
      merchant_id: auth.context.merchantId,
      window_days: days,
      generated_at: new Date().toISOString(),
      plan: {
        tier: billing.planTier,
        label: billing.planLabel
      },
      usage: billing.usage,
      kpis,
      operations: {
        open_alerts: 0,
        open_cases: 0,
        review_transactions: 0,
        blocked_transactions: 0
      }
    });
  }

  const client = auth.context.supabase;
  const [{ count: openAlerts }, { data: caseRows }, { data: transactionRows }] = await Promise.all([
    client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", auth.context.merchantId)
      .is("acknowledged_at", null)
      .gte("created_at", sinceIso),
    client
      .from("fraud_cases")
      .select("status")
      .eq("merchant_id", auth.context.merchantId)
      .gte("created_at", sinceIso),
    client
      .from("transactions")
      .select("status")
      .eq("merchant_id", auth.context.merchantId)
      .gte("occurred_at", sinceIso)
  ]);

  const openCases = (caseRows ?? []).filter((item) => item.status !== "resolved").length;
  const reviewTransactions = (transactionRows ?? []).filter((item) => item.status === "review").length;
  const blockedTransactions = (transactionRows ?? []).filter((item) => item.status === "blocked").length;

  return NextResponse.json({
    merchant_id: auth.context.merchantId,
    window_days: days,
    generated_at: new Date().toISOString(),
    plan: {
      tier: billing.planTier,
      label: billing.planLabel
    },
    limits: billing.limits,
    features: billing.features,
    usage: billing.usage,
    kpis,
    operations: {
      open_alerts: openAlerts ?? 0,
      open_cases: openCases,
      review_transactions: reviewTransactions,
      blocked_transactions: blockedTransactions
    }
  });
}
