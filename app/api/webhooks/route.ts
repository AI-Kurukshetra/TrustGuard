import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function randomSecret() {
  return `whsec_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ endpoints: [], deliveries: [] });
  }

  const endpointsRes = await auth.context.supabase
    .from("webhook_endpoints")
    .select("id, name, target_url, subscribed_events, active, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  if (endpointsRes.error) {
    return NextResponse.json({ error: endpointsRes.error.message }, { status: 400 });
  }

  const endpointIds = (endpointsRes.data ?? []).map((item) => item.id);
  let deliveries: Array<Record<string, unknown>> = [];
  if (endpointIds.length > 0) {
    const deliveriesRes = await auth.context.supabase
      .from("webhook_deliveries")
      .select("id, webhook_endpoint_id, event_type, status, response_code, attempt_count, last_attempted_at, delivered_at, created_at")
      .in("webhook_endpoint_id", endpointIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (deliveriesRes.error) {
      return NextResponse.json({ error: deliveriesRes.error.message }, { status: 400 });
    }
    deliveries = deliveriesRes.data ?? [];
  }

  return NextResponse.json({
    endpoints: endpointsRes.data ?? [],
    deliveries
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const targetUrl = typeof body.target_url === "string" ? body.target_url.trim() : "";
  const subscribedEvents = Array.isArray(body.subscribed_events)
    ? body.subscribed_events.filter((item): item is string => typeof item === "string")
    : [];

  if (!name || !targetUrl) {
    return NextResponse.json({ error: "name and target_url are required" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("webhook_endpoints")
    .insert({
      merchant_id: auth.context.merchantId,
      name,
      target_url: targetUrl,
      secret_hash: typeof body.secret_hash === "string" ? body.secret_hash : randomSecret(),
      subscribed_events: subscribedEvents,
      active: typeof body.active === "boolean" ? body.active : true
    })
    .select("id, name, target_url, subscribed_events, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
