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

  let query = auth.context.supabase
    .from("channel_risk_baselines")
    .select("id, channel, sample_count, avg_risk_score, block_rate_pct, review_rate_pct, last_event_at, metadata")
    .eq("merchant_id", auth.context.merchantId)
    .order("channel", { ascending: true });

  const channel = request.nextUrl.searchParams.get("channel");
  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}
