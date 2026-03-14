import { NextRequest, NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api-keys";
import { ACCESS_TOKEN_COOKIE, MERCHANT_ID_COOKIE } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";
import { createSupabaseRequestClient } from "@/lib/supabase/request";

type MerchantRole = "admin" | "analyst" | "viewer";

const roleRank: Record<MerchantRole, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3
};

export type MerchantAuthContext = {
  merchantId: string;
  userId: string | null;
  role: MerchantRole | null;
  supabase: ReturnType<typeof createSupabaseRequestClient> | ReturnType<typeof createSupabaseAdminClient> | null;
};

export function extractMerchantId(request: NextRequest, body?: Record<string, unknown>) {
  const headerMerchant = request.headers.get("x-merchant-id");
  const cookieMerchant = request.cookies.get(MERCHANT_ID_COOKIE)?.value ?? null;
  const bodyMerchant =
    body && typeof body.merchant_id === "string" && body.merchant_id.trim() !== ""
      ? body.merchant_id
      : null;

  return headerMerchant ?? bodyMerchant ?? cookieMerchant ?? null;
}

function extractBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

function extractApiKey(request: NextRequest) {
  const directKey = request.headers.get("x-api-key");
  if (directKey && directKey.trim() !== "") {
    return directKey.trim();
  }

  const authorization = request.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("apikey ")) {
    return authorization.slice("ApiKey ".length).trim();
  }

  return null;
}

export function merchantErrorResponse() {
  return NextResponse.json(
    {
      error: "Missing merchant context. Provide x-merchant-id header or merchant_id in payload."
    },
    { status: 400 }
  );
}

export async function requireMerchantAuth(
  request: NextRequest,
  body?: Record<string, unknown>,
  minimumRole: MerchantRole = "viewer"
): Promise<{ ok: true; context: MerchantAuthContext } | { ok: false; response: NextResponse }> {
  const requestedMerchantId = extractMerchantId(request, body);

  if (!hasSupabaseEnv()) {
    if (!requestedMerchantId) {
      return { ok: false, response: merchantErrorResponse() };
    }
    return {
      ok: true,
      context: {
        merchantId: requestedMerchantId,
        userId: null,
        role: null,
        supabase: null
      }
    };
  }

  const token = extractBearerToken(request);
  if (token) {
    const merchantId = requestedMerchantId;
    if (!merchantId) {
      return { ok: false, response: merchantErrorResponse() };
    }

    const supabase = createSupabaseRequestClient(token);
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid authentication token" }, { status: 401 })
      };
    }

    const { data: membership, error: membershipError } = await supabase
      .from("merchant_members")
      .select("role")
      .eq("merchant_id", merchantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Merchant access denied" }, { status: 403 })
      };
    }

    const role = (membership.role as MerchantRole) ?? "viewer";
    if (roleRank[role] < roleRank[minimumRole]) {
      return {
        ok: false,
        response: NextResponse.json({ error: `Insufficient role. Required: ${minimumRole}` }, { status: 403 })
      };
    }

    return {
      ok: true,
      context: {
        merchantId,
        userId: user.id,
        role,
        supabase
      }
    };
  }

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing authentication. Provide bearer token or x-api-key." }, { status: 401 })
    };
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "API key auth requires service role configuration." }, { status: 503 })
    };
  }

  const admin = createSupabaseAdminClient();
  const keyHash = hashApiKey(apiKey);
  const { data: keyRecord, error: keyError } = await admin
    .from("integration_api_keys")
    .select("merchant_id, role, active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyRecord || !keyRecord.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid API key." }, { status: 401 })
    };
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "API key expired." }, { status: 401 })
    };
  }

  if (requestedMerchantId && keyRecord.merchant_id !== requestedMerchantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Merchant mismatch for provided API key." }, { status: 403 })
    };
  }

  const keyRole = (keyRecord.role as MerchantRole) ?? "viewer";
  if (roleRank[keyRole] < roleRank[minimumRole]) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Insufficient role. Required: ${minimumRole}` }, { status: 403 })
    };
  }

  await admin
    .from("integration_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  return {
    ok: true,
    context: {
      merchantId: keyRecord.merchant_id,
      userId: null,
      role: keyRole,
      supabase: admin
    }
  };
}
