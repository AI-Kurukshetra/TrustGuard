import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, MERCHANT_ID_COOKIE } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseRequestClient } from "@/lib/supabase/request";

export const dynamic = "force-dynamic";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ user: null, memberships: [], source: "mock" });
  }

  const token = getBearerToken(request) ?? request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const client = createSupabaseRequestClient(token);
  const {
    data: { user },
    error: userError
  } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid authentication token" }, { status: 401 });
  }

  const { data: memberships, error: membershipsError } = await client
    .from("merchant_members")
    .select("merchant_id, role, active, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 400 });
  }

  const cookieMerchantId = request.cookies.get(MERCHANT_ID_COOKIE)?.value ?? null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null
    },
    memberships: memberships ?? [],
    active_merchant_id: cookieMerchantId
  });
}
