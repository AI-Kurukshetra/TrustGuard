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
    .from("behavioral_patterns")
    .select("id, user_id, session_id, pattern_type, fingerprint_hash, score, status, observed_at, pattern_payload, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("observed_at", { ascending: false });

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
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const patternType = typeof body.pattern_type === "string" ? body.pattern_type.trim() : "";
  if (!patternType) {
    return NextResponse.json({ error: "pattern_type is required" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("behavioral_patterns")
    .insert({
      merchant_id: auth.context.merchantId,
      user_id: typeof body.user_id === "string" ? body.user_id : null,
      session_id: typeof body.session_id === "string" ? body.session_id : null,
      pattern_type: patternType,
      fingerprint_hash: typeof body.fingerprint_hash === "string" ? body.fingerprint_hash : null,
      score: typeof body.score === "number" ? body.score : 0,
      status: typeof body.status === "string" ? body.status : "observed",
      observed_at: typeof body.observed_at === "string" ? body.observed_at : new Date().toISOString(),
      pattern_payload: typeof body.pattern_payload === "object" && body.pattern_payload ? body.pattern_payload : {}
    })
    .select("id, user_id, session_id, pattern_type, fingerprint_hash, score, status, observed_at, pattern_payload, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
