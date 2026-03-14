import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { recordApiRequestMetric } from "@/lib/api-metrics";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const track = async (statusCode: number, errorCode?: string) =>
    recordApiRequestMetric({
      merchantId: auth.context.merchantId,
      route: "/api/analytics/summary",
      method: "GET",
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
      client: auth.context.supabase ?? null
    });

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    await track(200, "supabase_not_configured");
    return NextResponse.json({ data: [] });
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await auth.context.supabase
    .from("daily_risk_metrics")
    .select("metric_date, total_transactions, blocked_transactions, review_transactions, approved_transactions, blocked_amount, chargeback_count, avg_risk_score")
    .eq("merchant_id", auth.context.merchantId)
    .gte("metric_date", since)
    .order("metric_date", { ascending: true });

  if (error) {
    await track(400, "daily_metrics_query_failed");
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await track(200);

  return NextResponse.json({ data: data ?? [] });
}
