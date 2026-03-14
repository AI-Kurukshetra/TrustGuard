import { NextRequest, NextResponse } from "next/server";
import { generateApiKey, maskApiKeyPrefix } from "@/lib/api-keys";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

type CreateKeyBody = {
  name?: string;
  role?: "admin" | "analyst" | "viewer";
  expires_in_days?: number;
};

const allowedRoles = new Set(["admin", "analyst", "viewer"]);

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await auth.context.supabase
    .from("integration_api_keys")
    .select("id, name, key_prefix, role, active, last_used_at, expires_at, revoked_at, created_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const serialized = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    masked_key: maskApiKeyPrefix(row.key_prefix)
  }));

  return NextResponse.json({ data: serialized, merchant_id: auth.context.merchantId });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CreateKeyBody;
  const auth = await requireMerchantAuth(request, body as Record<string, unknown>, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.context.userId) {
    return NextResponse.json(
      { error: "Create API key requires an interactive admin login session." },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase environment is not configured." }, { status: 503 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Key name is required." }, { status: 400 });
  }

  const requestedRole = typeof body.role === "string" ? body.role : "analyst";
  if (!allowedRoles.has(requestedRole)) {
    return NextResponse.json({ error: "Invalid key role." }, { status: 400 });
  }

  const expiresInDays =
    typeof body.expires_in_days === "number" && Number.isFinite(body.expires_in_days)
      ? Math.max(1, Math.min(365, Math.round(body.expires_in_days)))
      : null;

  const expiry = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const generated = generateApiKey();
  const { data, error } = await auth.context.supabase
    .from("integration_api_keys")
    .insert({
      merchant_id: auth.context.merchantId,
      name,
      key_prefix: generated.keyPrefix,
      key_hash: generated.keyHash,
      role: requestedRole,
      active: true,
      expires_at: expiry,
      created_by: auth.context.userId
    })
    .select("id, name, key_prefix, role, active, last_used_at, expires_at, revoked_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create API key." }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      id: data.id,
      name: data.name,
      role: data.role,
      active: data.active,
      last_used_at: data.last_used_at,
      expires_at: data.expires_at,
      revoked_at: data.revoked_at,
      created_at: data.created_at,
      masked_key: maskApiKeyPrefix(data.key_prefix)
    },
    api_key: generated.apiKey,
    merchant_id: auth.context.merchantId
  });
}
