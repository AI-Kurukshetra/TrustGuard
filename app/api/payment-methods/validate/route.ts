import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function isLikelyValidMethod(body: Record<string, unknown>) {
  const methodType = typeof body.method_type === "string" ? body.method_type : "";
  const last4 = typeof body.last4 === "string" ? body.last4 : "";
  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : "";

  if (!methodType || !fingerprint) {
    return false;
  }

  if (methodType === "card" && last4.length !== 4) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const isValid = isLikelyValidMethod(body);

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ validated: isValid, source: "local_heuristic" });
  }

  const methodId = typeof body.payment_method_id === "string" ? body.payment_method_id : null;
  if (methodId) {
    await auth.context.supabase
      .from("payment_methods")
      .update({ validation_status: isValid ? "verified" : "failed" })
      .eq("merchant_id", auth.context.merchantId)
      .eq("id", methodId);
  }

  return NextResponse.json({ validated: isValid, source: "rules_adapter_v1" });
}
