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

  const reportType = typeof body.report_type === "string" ? body.report_type : "pci_dss";
  const periodStart =
    typeof body.period_start === "string" ? body.period_start : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const periodEnd = typeof body.period_end === "string" ? body.period_end : new Date().toISOString().slice(0, 10);

  const client = createSupabaseAdminClient();
  const { data: transactions, error: txError } = await client
    .from("transactions")
    .select("id, status, risk_score, amount, currency, occurred_at")
    .eq("merchant_id", merchantId)
    .gte("occurred_at", `${periodStart}T00:00:00.000Z`)
    .lte("occurred_at", `${periodEnd}T23:59:59.999Z`);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 400 });
  }

  const payload = {
    report_type: reportType,
    period_start: periodStart,
    period_end: periodEnd,
    totals: {
      transactions: (transactions ?? []).length,
      blocked: (transactions ?? []).filter((item) => item.status === "blocked").length,
      review: (transactions ?? []).filter((item) => item.status === "review").length,
      avg_risk:
        (transactions ?? []).length > 0
          ? Number(
              (
                (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) /
                (transactions ?? []).length
              ).toFixed(2)
            )
          : 0
    }
  };

  const { data, error } = await client
    .from("compliance_reports")
    .insert({
      merchant_id: merchantId,
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      status: "generated",
      report_payload: payload,
      generated_at: new Date().toISOString(),
      storage_path: `reports/${reportType}_${periodStart}_${periodEnd}.json`
    })
    .select("id, report_type, period_start, period_end, status, generated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data, payload });
}
