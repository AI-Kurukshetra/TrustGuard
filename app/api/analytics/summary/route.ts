import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}
