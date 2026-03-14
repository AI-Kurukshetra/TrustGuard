import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.target_url === "string" && body.target_url.trim()) {
    updates.target_url = body.target_url.trim();
  }
  if (Array.isArray(body.subscribed_events)) {
    updates.subscribed_events = body.subscribed_events.filter(
      (item): item is string => typeof item === "string"
    );
  }
  if (typeof body.secret_hash === "string" && body.secret_hash.trim()) {
    updates.secret_hash = body.secret_hash.trim();
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("webhook_endpoints")
    .update(updates)
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id)
    .select("id, name, target_url, subscribed_events, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const { error } = await auth.context.supabase
    .from("webhook_endpoints")
    .delete()
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true });
}
