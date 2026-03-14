import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const biometrics =
    typeof body.behavioral_biometrics === "object" && body.behavioral_biometrics
      ? body.behavioral_biometrics
      : {};

  const { data, error } = await auth.context.supabase
    .from("sessions")
    .update({ behavioral_biometrics: biometrics })
    .eq("id", params.id)
    .eq("merchant_id", auth.context.merchantId)
    .select("id, behavioral_biometrics, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
