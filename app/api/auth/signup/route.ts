import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignupBody = {
  email: string;
  password: string;
  merchant_name: string;
};

function parseSignupBody(value: unknown): SignupBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const email = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
  const password = typeof candidate.password === "string" ? candidate.password : "";
  const merchantName = typeof candidate.merchant_name === "string" ? candidate.merchant_name.trim() : "";

  if (!email || !password || !merchantName) {
    return null;
  }

  return {
    email,
    password,
    merchant_name: merchantName
  };
}

function slugifyMerchantName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "merchant";
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Supabase auth signup requires NEXT_PUBLIC_* and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const body = parseSignupBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json(
      { error: "Invalid payload. Email, password, and merchant_name are required." },
      { status: 400 }
    );
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data: createdUserRes, error: createUserError } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true
  });
  if (createUserError || !createdUserRes.user) {
    return NextResponse.json({ error: createUserError?.message ?? "Failed to create account." }, { status: 400 });
  }

  const userId = createdUserRes.user.id;
  let merchantId: string | null = null;

  try {
    const slugBase = slugifyMerchantName(body.merchant_name);
    const slugCandidate = `${slugBase}-${randomUUID().slice(0, 8)}`;

    const { data: merchant, error: merchantError } = await adminClient
      .from("merchants")
      .insert({
        name: body.merchant_name,
        slug: slugCandidate
      })
      .select("id")
      .single();
    if (merchantError || !merchant) {
      throw new Error(merchantError?.message ?? "Failed to create merchant tenant.");
    }

    merchantId = merchant.id;

    const { error: membershipError } = await adminClient.from("merchant_members").insert({
      merchant_id: merchantId,
      user_id: userId,
      role: "admin",
      active: true
    });
    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const signinClient = createSupabaseServerClient();
    const { data: signInData, error: signInError } = await signinClient.auth.signInWithPassword({
      email: body.email,
      password: body.password
    });
    if (signInError || !signInData.session) {
      return NextResponse.json({
        created: true,
        user_id: userId,
        merchant_id: merchantId,
        message: "Account created. Please log in."
      });
    }

    if (!merchantId) {
      throw new Error("Missing merchant context after signup.");
    }

    const response = NextResponse.json({
      created: true,
      user_id: userId,
      merchant_id: merchantId,
      role: "admin"
    });
    setAuthCookies(response, signInData.session.access_token, merchantId);
    return response;
  } catch (error) {
    if (merchantId) {
      await adminClient.from("merchant_members").delete().eq("merchant_id", merchantId).eq("user_id", userId);
      await adminClient.from("merchants").delete().eq("id", merchantId);
    }
    await adminClient.auth.admin.deleteUser(userId);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account." },
      { status: 400 }
    );
  }
}
