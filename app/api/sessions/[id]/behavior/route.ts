import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const biometrics =
    typeof body.behavioral_biometrics === "object" && body.behavioral_biometrics
      ? body.behavioral_biometrics
      : {};

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("sessions")
    .update({ behavioral_biometrics: biometrics })
    .eq("id", params.id)
    .eq("merchant_id", merchantId)
    .select("id, behavioral_biometrics, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
