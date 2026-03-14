import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/config";
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
  supabase: ReturnType<typeof createSupabaseRequestClient> | null;
};

export function extractMerchantId(request: NextRequest, body?: Record<string, unknown>) {
  const headerMerchant = request.headers.get("x-merchant-id");
  const bodyMerchant =
    body && typeof body.merchant_id === "string" && body.merchant_id.trim() !== ""
      ? body.merchant_id
      : null;

  return headerMerchant ?? bodyMerchant ?? null;
}

function extractBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
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
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return { ok: false, response: merchantErrorResponse() };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      context: {
        merchantId,
        userId: null,
        role: null,
        supabase: null
      }
    };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
    };
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
