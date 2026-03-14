import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireMerchantAuth(request, undefined, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await auth.context.supabase
    .from("alerts")
    .update({
      acknowledged_at: nowIso,
      acknowledged_by: auth.context.userId
    })
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id)
    .select("id, acknowledged_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
