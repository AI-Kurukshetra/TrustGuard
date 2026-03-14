import { NextRequest, NextResponse } from "next/server";
import { getMerchantBillingSnapshot } from "@/lib/billing";
import { requireMerchantAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await getMerchantBillingSnapshot(
    auth.context.supabase ?? null,
    auth.context.merchantId
  );

  const transactionLimit = snapshot.limits.monthlyTransactionLimit;
  const apiLimit = snapshot.limits.monthlyApiCallLimit;

  const transactionUsagePct =
    transactionLimit === null || transactionLimit === 0
      ? null
      : Number(((snapshot.usage.transactionScored / transactionLimit) * 100).toFixed(2));
  const apiUsagePct =
    apiLimit === null || apiLimit === 0
      ? null
      : Number(((snapshot.usage.apiCalls / apiLimit) * 100).toFixed(2));

  const upgradeSignals: string[] = [];
  if (transactionUsagePct !== null && transactionUsagePct >= 85) {
    upgradeSignals.push("monthly_transaction_quota_near_limit");
  }
  if (apiUsagePct !== null && apiUsagePct >= 85) {
    upgradeSignals.push("monthly_api_quota_near_limit");
  }
  if (!snapshot.features.advanced_detection_suite) {
    upgradeSignals.push("advanced_detection_locked");
  }

  return NextResponse.json({
    merchant_id: snapshot.merchantId,
    plan: {
      tier: snapshot.planTier,
      label: snapshot.planLabel
    },
    limits: snapshot.limits,
    usage: snapshot.usage,
    usage_percent: {
      transactions: transactionUsagePct,
      api_calls: apiUsagePct
    },
    features: snapshot.features,
    upgrade_signals: upgradeSignals
  });
}
