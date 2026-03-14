import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { validatePaymentMethod } from "@/lib/payment-validation";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const validation = validatePaymentMethod({
    method_type: typeof body.method_type === "string" ? body.method_type : undefined,
    provider: typeof body.provider === "string" ? body.provider : null,
    fingerprint: typeof body.fingerprint === "string" ? body.fingerprint : null,
    last4: typeof body.last4 === "string" ? body.last4 : null,
    expiry_month: typeof body.expiry_month === "number" ? body.expiry_month : null,
    expiry_year: typeof body.expiry_year === "number" ? body.expiry_year : null,
    card_number: typeof body.card_number === "string" ? body.card_number : null,
    bank_account_token:
      typeof body.bank_account_token === "string" ? body.bank_account_token : null,
    wallet_id: typeof body.wallet_id === "string" ? body.wallet_id : null,
    billing_country: typeof body.billing_country === "string" ? body.billing_country : null
  });

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json(validation);
  }

  const methodId = typeof body.payment_method_id === "string" ? body.payment_method_id : null;
  if (methodId) {
    const { data: existing } = await auth.context.supabase
      .from("payment_methods")
      .select("metadata")
      .eq("merchant_id", auth.context.merchantId)
      .eq("id", methodId)
      .maybeSingle();

    const existingMetadata =
      existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
    const metadata = {
      ...existingMetadata,
      validation: {
        validated: validation.validated,
        score: validation.score,
        reasons: validation.reasons,
        source: validation.source,
        adapter: validation.adapter,
        validated_at: new Date().toISOString()
      }
    };

    await auth.context.supabase
      .from("payment_methods")
      .update({
        validation_status: validation.validated ? "verified" : "failed",
        metadata
      })
      .eq("merchant_id", auth.context.merchantId)
      .eq("id", methodId);
  }

  return NextResponse.json(validation);
}
