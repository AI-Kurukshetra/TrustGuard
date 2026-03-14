import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const userId = request.nextUrl.searchParams.get("user_id");
  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  let query = auth.context.supabase
    .from("identity_verifications")
    .select("id, user_id, verification_type, status, provider, score, verified_at, created_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
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

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "pending";
  const { data, error } = await auth.context.supabase
    .from("identity_verifications")
    .insert({
      merchant_id: auth.context.merchantId,
      user_id: userId,
      verification_type: typeof body.verification_type === "string" ? body.verification_type : "kyc",
      status,
      provider: typeof body.provider === "string" ? body.provider : "internal",
      reference_id: typeof body.reference_id === "string" ? body.reference_id : null,
      score: typeof body.score === "number" ? body.score : null,
      result_payload: typeof body.result_payload === "object" && body.result_payload ? body.result_payload : {},
      verified_at: status === "verified" ? new Date().toISOString() : null
    })
    .select("id, user_id, verification_type, status, provider, score, verified_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
