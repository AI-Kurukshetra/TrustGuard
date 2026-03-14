import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type PlaybookInput = {
  transaction_id?: string;
  amount?: number;
  currency?: string;
  risk_score?: number;
  chargeback_history_count?: number;
  payment_method_validated?: boolean;
  identity_verified?: boolean;
  decision?: "approve" | "review" | "block";
};

function buildPreventionPlaybook(input: PlaybookInput) {
  const riskScore = Number(input.risk_score ?? 0);
  const amount = Number(input.amount ?? 0);
  const chargebackHistoryCount = Number(input.chargeback_history_count ?? 0);
  const paymentMethodValidated = Boolean(input.payment_method_validated ?? false);
  const identityVerified = Boolean(input.identity_verified ?? false);

  const actions: string[] = [];
  const reasons: string[] = [];

  if (riskScore >= 85) {
    actions.push("block_authorization", "require_manual_case_review");
    reasons.push("high_risk_score");
  } else if (riskScore >= 60) {
    actions.push("hold_for_manual_review");
    reasons.push("medium_high_risk_score");
  } else {
    actions.push("allow_with_monitoring");
  }

  if (chargebackHistoryCount >= 2) {
    actions.push("enable_post_transaction_monitoring", "capture_shipping_proof");
    reasons.push("repeat_chargeback_history");
  }

  if (!paymentMethodValidated) {
    actions.push("step_up_payment_validation");
    reasons.push("payment_unvalidated");
  }

  if (!identityVerified) {
    actions.push("require_identity_verification");
    reasons.push("identity_unverified");
  }

  if (amount >= 1000) {
    actions.push("require_signed_delivery");
    reasons.push("high_ticket_amount");
  }

  return {
    transaction_id: input.transaction_id ?? null,
    risk_band: riskScore >= 85 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low",
    recommended_actions: Array.from(new Set(actions)),
    reasons: Array.from(new Set(reasons)),
    input_snapshot: {
      amount,
      currency: input.currency ?? "USD",
      risk_score: riskScore,
      chargeback_history_count: chargebackHistoryCount,
      payment_method_validated: paymentMethodValidated,
      identity_verified: identityVerified,
      decision: input.decision ?? null
    }
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PlaybookInput;
  const auth = await requireMerchantAuth(request, body as Record<string, unknown>, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const playbook = buildPreventionPlaybook(body);
  return NextResponse.json(playbook);
}
