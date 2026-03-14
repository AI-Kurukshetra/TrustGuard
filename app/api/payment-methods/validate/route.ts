import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

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
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const isValid = isLikelyValidMethod(body);

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ validated: isValid, source: "local_heuristic" });
  }

  const methodId = typeof body.payment_method_id === "string" ? body.payment_method_id : null;
  if (methodId) {
    const client = createSupabaseAdminClient();
    await client
      .from("payment_methods")
      .update({ validation_status: isValid ? "verified" : "failed" })
      .eq("merchant_id", merchantId)
      .eq("id", methodId);
  }

  return NextResponse.json({ validated: isValid, source: "rules_adapter_v1" });
}
