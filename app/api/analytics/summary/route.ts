import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const merchantId = extractMerchantId(request);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ data: [] });
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("daily_risk_metrics")
    .select("metric_date, total_transactions, blocked_transactions, review_transactions, approved_transactions, blocked_amount, chargeback_count, avg_risk_score")
    .eq("merchant_id", merchantId)
    .gte("metric_date", since)
    .order("metric_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}
