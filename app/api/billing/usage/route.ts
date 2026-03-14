import { NextRequest, NextResponse } from "next/server";
import { getMerchantBillingSnapshot } from "@/lib/billing";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function monthBounds(year: number, month: number) {
  const safeMonth = Math.max(1, Math.min(12, month));
  const start = new Date(Date.UTC(year, safeMonth - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, safeMonth, 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodKey: `${year}-${String(safeMonth).padStart(2, "0")}`
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const today = new Date();
  const year = Number(request.nextUrl.searchParams.get("year") ?? today.getUTCFullYear());
  const month = Number(request.nextUrl.searchParams.get("month") ?? today.getUTCMonth() + 1);
  const bounds = monthBounds(
    Number.isFinite(year) ? year : today.getUTCFullYear(),
    Number.isFinite(month) ? month : today.getUTCMonth() + 1
  );

  const snapshot = await getMerchantBillingSnapshot(auth.context.supabase ?? null, auth.context.merchantId);

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({
      merchant_id: auth.context.merchantId,
      period: bounds.periodKey,
      totals: snapshot.usage,
      daily: [],
      recent_events: [],
      quota_notifications: []
    });
  }

  const [eventsResponse, notificationsResponse] = await Promise.all([
    auth.context.supabase
      .from("merchant_usage_events")
      .select("id, event_type, quantity, event_at, metadata")
      .eq("merchant_id", auth.context.merchantId)
      .gte("event_at", bounds.startIso)
      .lt("event_at", bounds.endIso)
      .order("event_at", { ascending: false })
      .limit(5000),
    auth.context.supabase
      .from("billing_usage_notifications")
      .select("id, event_type, threshold_percent, triggered_usage, usage_limit, metadata, created_at, alert_id")
      .eq("merchant_id", auth.context.merchantId)
      .eq("period_key", bounds.periodKey)
      .order("threshold_percent", { ascending: true })
      .order("created_at", { ascending: false })
  ]);

  const { data, error } = eventsResponse;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const dailyMap = new Map<string, { period_day: string; transaction_scored: number; api_call: number; alert_generated: number }>();
  for (const event of data ?? []) {
    const eventAt = typeof event.event_at === "string" ? event.event_at : new Date().toISOString();
    const day = eventAt.slice(0, 10);
    const quantity = Math.max(0, Number(event.quantity ?? 0));
    const bucket =
      dailyMap.get(day) ??
      {
        period_day: day,
        transaction_scored: 0,
        api_call: 0,
        alert_generated: 0
      };

    if (event.event_type === "transaction_scored") {
      bucket.transaction_scored += quantity;
    } else if (event.event_type === "api_call") {
      bucket.api_call += quantity;
    } else if (event.event_type === "alert_generated") {
      bucket.alert_generated += quantity;
    }

    dailyMap.set(day, bucket);
  }

  const daily = Array.from(dailyMap.values()).sort((left, right) =>
    left.period_day < right.period_day ? -1 : left.period_day > right.period_day ? 1 : 0
  );

  return NextResponse.json({
    merchant_id: auth.context.merchantId,
    period: bounds.periodKey,
    totals: snapshot.usage,
    daily,
    recent_events: (data ?? []).slice(0, 100),
    quota_notifications: notificationsResponse.data ?? []
  });
}
