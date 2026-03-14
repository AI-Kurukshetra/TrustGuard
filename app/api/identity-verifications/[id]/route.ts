import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["pending", "verified", "failed", "expired"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.verification_type === "string" && body.verification_type.trim() !== "") {
    updates.verification_type = body.verification_type.trim();
  }
  if (typeof body.provider === "string") {
    updates.provider = body.provider;
  }
  if (typeof body.reference_id === "string") {
    updates.reference_id = body.reference_id;
  }
  if (typeof body.score === "number") {
    updates.score = body.score;
  }
  if (typeof body.result_payload === "object" && body.result_payload) {
    updates.result_payload = body.result_payload;
  }
  if (typeof body.status === "string") {
    if (!allowedStatuses.has(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: pending, verified, failed, expired" },
        { status: 400 }
      );
    }
    updates.status = body.status;
    updates.verified_at = body.status === "verified" ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("identity_verifications")
    .update(updates)
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id)
    .select("id, user_id, verification_type, status, provider, reference_id, score, result_payload, verified_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
