import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const date = typeof body.metric_date === "string" ? body.metric_date : new Date().toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const client = createSupabaseAdminClient();
  const { data: transactions, error: txError } = await client
    .from("transactions")
    .select("status, amount, risk_score")
    .eq("merchant_id", merchantId)
    .gte("occurred_at", dayStart)
    .lte("occurred_at", dayEnd);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 400 });
  }

  const { count: chargebackCount, error: cbError } = await client
    .from("chargebacks")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gte("received_at", dayStart)
    .lte("received_at", dayEnd);

  if (cbError) {
    return NextResponse.json({ error: cbError.message }, { status: 400 });
  }

  const totalTransactions = (transactions ?? []).length;
  const blockedTransactions = (transactions ?? []).filter((item) => item.status === "blocked").length;
  const reviewTransactions = (transactions ?? []).filter((item) => item.status === "review").length;
  const approvedTransactions = (transactions ?? []).filter((item) => item.status === "approved").length;
  const blockedAmount = (transactions ?? [])
    .filter((item) => item.status === "blocked")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const avgRiskScore =
    totalTransactions > 0
      ? (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) / totalTransactions
      : 0;

  const { data, error } = await client
    .from("daily_risk_metrics")
    .upsert(
      {
        merchant_id: merchantId,
        metric_date: date,
        total_transactions: totalTransactions,
        blocked_transactions: blockedTransactions,
        review_transactions: reviewTransactions,
        approved_transactions: approvedTransactions,
        blocked_amount: Number(blockedAmount.toFixed(2)),
        chargeback_count: chargebackCount ?? 0,
        avg_risk_score: Number(avgRiskScore.toFixed(2))
      },
      { onConflict: "merchant_id,metric_date" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
