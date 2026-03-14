import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.context.userId) {
    return NextResponse.json(
      { error: "Revoke API key requires an interactive admin login session." },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase environment is not configured." }, { status: 503 });
  }

  const { error } = await auth.context.supabase
    .from("integration_api_keys")
    .update({
      active: false,
      revoked_at: new Date().toISOString()
    })
    .eq("id", params.id)
    .eq("merchant_id", auth.context.merchantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ revoked: true, id: params.id });
}
