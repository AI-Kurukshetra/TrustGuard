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
    .from("contextual_auth_challenges")
    .select("id, user_id, transaction_id, challenge_type, status, expires_at, resolved_at, context_payload, created_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  const status = request.nextUrl.searchParams.get("status");
  if (status) {
    query = query.eq("status", status);
  }

  const userId = request.nextUrl.searchParams.get("user_id");
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const challengeType =
    typeof body.challenge_type === "string" && body.challenge_type.trim() !== ""
      ? body.challenge_type.trim()
      : "step_up_auth";
  const ttlMinutes = Math.max(5, Math.min(120, Number(body.ttl_minutes ?? 15)));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { data, error } = await auth.context.supabase
    .from("contextual_auth_challenges")
    .insert({
      merchant_id: auth.context.merchantId,
      user_id: typeof body.user_id === "string" ? body.user_id : null,
      transaction_id: typeof body.transaction_id === "string" ? body.transaction_id : null,
      challenge_type: challengeType,
      status: "pending",
      expires_at: expiresAt,
      context_payload: typeof body.context_payload === "object" && body.context_payload ? body.context_payload : {}
    })
    .select("id, user_id, transaction_id, challenge_type, status, expires_at, context_payload, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
