import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeProfileField(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({
      user: {
        id: auth.context.userId,
        email: null,
        full_name: null,
        job_title: null
      }
    });
  }

  if (!auth.context.userId) {
    return NextResponse.json({ error: "Profile requires operator session authentication." }, { status: 403 });
  }

  const {
    data: { user },
    error: userError
  } = await auth.context.supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unable to load profile." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      full_name: getMetadataString(user.user_metadata, "full_name"),
      job_title: getMetadataString(user.user_metadata, "job_title")
    }
  });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const fullName = normalizeProfileField(body.full_name, 120);
  const jobTitle = normalizeProfileField(body.job_title, 120);

  if (fullName === null && jobTitle === null) {
    return NextResponse.json({ error: "Provide full_name or job_title." }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({
      user: {
        id: auth.context.userId,
        email: null,
        full_name: fullName,
        job_title: jobTitle
      },
      updated: true
    });
  }

  if (!auth.context.userId) {
    return NextResponse.json({ error: "Profile update requires operator session authentication." }, { status: 403 });
  }

  const {
    data: { user: currentUser },
    error: currentUserError
  } = await auth.context.supabase.auth.getUser();
  if (currentUserError || !currentUser) {
    return NextResponse.json({ error: "Unable to load current user." }, { status: 401 });
  }

  const existingMetadata =
    currentUser.user_metadata && typeof currentUser.user_metadata === "object"
      ? (currentUser.user_metadata as Record<string, unknown>)
      : {};

  const nextMetadata: Record<string, unknown> = { ...existingMetadata };
  if (fullName !== null) {
    nextMetadata.full_name = fullName;
  }
  if (jobTitle !== null) {
    nextMetadata.job_title = jobTitle;
  }

  const {
    data: { user: updatedUser },
    error: updateError
  } = await auth.context.supabase.auth.updateUser({
    data: nextMetadata
  });

  if (updateError || !updatedUser) {
    return NextResponse.json({ error: updateError?.message ?? "Unable to update profile." }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email ?? null,
      full_name: getMetadataString(updatedUser.user_metadata, "full_name"),
      job_title: getMetadataString(updatedUser.user_metadata, "job_title")
    },
    updated: true
  });
}
