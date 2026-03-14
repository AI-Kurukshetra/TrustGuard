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

  const userId = request.nextUrl.searchParams.get("user_id");
  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ data: [] });
  }

  const client = createSupabaseAdminClient();
  let query = client
    .from("identity_verifications")
    .select("id, user_id, verification_type, status, provider, score, verified_at, created_at")
    .eq("merchant_id", merchantId)
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
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "pending";
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("identity_verifications")
    .insert({
      merchant_id: merchantId,
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
