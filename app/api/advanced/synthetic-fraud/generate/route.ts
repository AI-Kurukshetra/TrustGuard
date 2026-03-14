import { NextRequest, NextResponse } from "next/server";
import { generateSyntheticFraudSamples } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { checkFeatureAccess } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "advanced_detection_suite"
  });
  if (!featureAccess.allowed) {
    return NextResponse.json(
      { error: `Feature unavailable on ${featureAccess.planTier} plan. Upgrade required.` },
      { status: 403 }
    );
  }

  const scenario = typeof body.scenario === "string" && body.scenario.trim() !== "" ? body.scenario : "card_testing";
  const count = Math.max(1, Math.min(500, Number(body.count ?? 50)));
  const samples = generateSyntheticFraudSamples({
    scenario,
    count,
    currency: typeof body.currency === "string" ? body.currency : "USD",
    seed: typeof body.seed === "string" ? body.seed : undefined
  });

  if (hasSupabaseEnv() && auth.context.supabase) {
    await auth.context.supabase.from("synthetic_fraud_batches").insert({
      merchant_id: auth.context.merchantId,
      scenario_name: scenario,
      sample_count: samples.length,
      generated_payload: {
        scenario,
        samples
      },
      created_by: auth.context.userId
    });
  }

  return NextResponse.json({
    scenario,
    sample_count: samples.length,
    samples
  });
}
