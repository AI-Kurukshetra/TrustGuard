import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

type InviteBody = {
  email?: string;
  role?: "admin" | "analyst" | "viewer";
};

const allowedRoles = new Set(["admin", "analyst", "viewer"]);

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data: members, error } = await auth.context.supabase
    .from("merchant_members")
    .select("id, user_id, role, active, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const emailByUserId = new Map<string, string | null>();
  if (hasSupabaseServiceRoleEnv()) {
    const admin = createSupabaseAdminClient();
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!listError) {
      for (const user of listData.users) {
        emailByUserId.set(user.id, user.email ?? null);
      }
    }
  }

  return NextResponse.json({
    data: (members ?? []).map((member) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      active: member.active,
      created_at: member.created_at,
      updated_at: member.updated_at,
      email: emailByUserId.get(member.user_id) ?? null
    }))
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as InviteBody;
  const auth = await requireMerchantAuth(request, body as Record<string, unknown>, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.context.userId) {
    return NextResponse.json(
      { error: "Inviting members requires an interactive admin login session." },
      { status: 403 }
    );
  }

  if (!hasSupabaseEnv() || !auth.context.supabase || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Member invite requires Supabase service-role configuration." },
      { status: 503 }
    );
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Invite email is required." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role : "analyst";
  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: "Invalid member role." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const inviteRedirectTo = `${request.nextUrl.origin}/login`;

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invited_to_merchant_id: auth.context.merchantId,
      invited_by_user_id: auth.context.userId
    },
    redirectTo: inviteRedirectTo
  });

  let invitedUserId = inviteData.user?.id ?? null;
  if (!invitedUserId) {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: inviteError?.message ?? listError.message }, { status: 400 });
    }

    invitedUserId =
      listData.users.find((candidate) => normalizeEmail(candidate.email ?? "") === email)?.id ?? null;
  }

  if (!invitedUserId) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Unable to resolve invited user for membership assignment." },
      { status: 400 }
    );
  }

  const { data: membership, error: membershipError } = await admin
    .from("merchant_members")
    .upsert(
      {
        merchant_id: auth.context.merchantId,
        user_id: invitedUserId,
        role,
        active: true
      },
      { onConflict: "merchant_id,user_id" }
    )
    .select("id, user_id, role, active, created_at, updated_at")
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: membershipError?.message ?? "Failed to assign merchant membership." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: {
      id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      active: membership.active,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
      email
    },
    invite_sent: !inviteError
  });
}
