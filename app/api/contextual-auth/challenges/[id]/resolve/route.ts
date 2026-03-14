import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type ContextParams = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, context: ContextParams) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "failed";
  if (!["passed", "failed", "expired"].includes(status)) {
    return NextResponse.json({ error: "status must be one of passed, failed, expired" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("contextual_auth_challenges")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      context_payload: {
        resolution_note: typeof body.note === "string" ? body.note : null,
        resolved_by: auth.context.userId
      }
    })
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", context.params.id)
    .select("id, user_id, transaction_id, challenge_type, status, expires_at, resolved_at, context_payload")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
