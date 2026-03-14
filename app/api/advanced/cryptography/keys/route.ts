import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { checkFeatureAccess } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function createFingerprint(merchantId: string, keyVersion: string) {
  return createHash("sha256")
    .update(`${merchantId}:${keyVersion}:${randomBytes(24).toString("hex")}`)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "quantum_crypto"
  });
  if (!featureAccess.allowed) {
    return NextResponse.json(
      { error: `Feature unavailable on ${featureAccess.planTier} plan. Upgrade required.` },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await auth.context.supabase
    .from("quantum_crypto_keys")
    .select("id, key_version, algorithm, public_fingerprint, active, rotated_at, metadata")
    .eq("merchant_id", auth.context.merchantId)
    .order("rotated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  const featureAccess = await checkFeatureAccess({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    feature: "quantum_crypto"
  });
  if (!featureAccess.allowed) {
    return NextResponse.json(
      { error: `Feature unavailable on ${featureAccess.planTier} plan. Upgrade required.` },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const keyVersion =
    typeof body.key_version === "string" && body.key_version.trim() !== ""
      ? body.key_version
      : `v${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  const algorithm =
    typeof body.algorithm === "string" && body.algorithm.trim() !== ""
      ? body.algorithm
      : "hybrid_pqc_ready_v1";
  const fingerprint = createFingerprint(auth.context.merchantId, keyVersion);

  await auth.context.supabase
    .from("quantum_crypto_keys")
    .update({ active: false })
    .eq("merchant_id", auth.context.merchantId)
    .eq("active", true);

  const { data, error } = await auth.context.supabase
    .from("quantum_crypto_keys")
    .insert({
      merchant_id: auth.context.merchantId,
      key_version: keyVersion,
      algorithm,
      public_fingerprint: fingerprint,
      active: true,
      metadata: {
        rotation_reason: typeof body.rotation_reason === "string" ? body.rotation_reason : "scheduled_rotation",
        created_by: auth.context.userId,
        hybrid_mode: true
      }
    })
    .select("id, key_version, algorithm, public_fingerprint, active, rotated_at, metadata")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
