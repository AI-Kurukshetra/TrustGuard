import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["pending", "verified", "failed", "expired"]);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const verificationId = typeof body.verification_id === "string" ? body.verification_id.trim() : "";
  const referenceId = typeof body.reference_id === "string" ? body.reference_id.trim() : "";
  if (!verificationId && !referenceId) {
    return NextResponse.json(
      { error: "verification_id or reference_id is required for callback updates" },
      { status: 400 }
    );
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!allowedStatuses.has(status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: pending, verified, failed, expired" },
      { status: 400 }
    );
  }

  let query = auth.context.supabase
    .from("identity_verifications")
    .select("id")
    .eq("merchant_id", auth.context.merchantId)
    .limit(1);
  if (verificationId) {
    query = query.eq("id", verificationId);
  } else {
    query = query.eq("reference_id", referenceId);
  }

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ error: "Identity verification record not found" }, { status: 404 });
  }

  const { data, error } = await auth.context.supabase
    .from("identity_verifications")
    .update({
      status,
      provider: typeof body.provider === "string" ? body.provider : null,
      score: typeof body.score === "number" ? body.score : null,
      result_payload: typeof body.result_payload === "object" && body.result_payload ? body.result_payload : {},
      verified_at: status === "verified" ? new Date().toISOString() : null
    })
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", existing.id)
    .select("id, user_id, verification_type, status, provider, reference_id, score, result_payload, verified_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
