import { NextRequest, NextResponse } from "next/server";
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

  const token = getBearerToken(request);
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

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null
    },
    memberships: memberships ?? []
  });
}
