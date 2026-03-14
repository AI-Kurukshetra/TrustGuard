import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginBody = {
  email: string;
  password: string;
  merchant_id?: string;
};

function parseLoginBody(value: unknown): LoginBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const email = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
  const password = typeof candidate.password === "string" ? candidate.password : "";
  const merchantId = typeof candidate.merchant_id === "string" ? candidate.merchant_id.trim() : undefined;

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
    merchant_id: merchantId && merchantId.length > 0 ? merchantId : undefined
  };
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase environment is not configured." }, { status: 503 });
  }

  const body = parseLoginBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: "Invalid payload. Email and password are required." }, { status: 400 });
  }

  const authClient = createSupabaseServerClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: body.email,
    password: body.password
  });
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const requestClient = createSupabaseRequestClient(data.session.access_token);
  let membershipsQuery = requestClient
    .from("merchant_members")
    .select("merchant_id, role, active, created_at")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (body.merchant_id) {
    membershipsQuery = membershipsQuery.eq("merchant_id", body.merchant_id);
  }

  const { data: memberships, error: membershipsError } = await membershipsQuery;
  if (membershipsError || !memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: "No active merchant membership found for this account." },
      { status: 403 }
    );
  }

  const selectedMembership = memberships[0];
  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email ?? body.email
    },
    merchant_id: selectedMembership.merchant_id,
    role: selectedMembership.role
  });

  setAuthCookies(response, data.session.access_token, selectedMembership.merchant_id);
  return response;
}
