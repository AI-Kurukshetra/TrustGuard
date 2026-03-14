import { PageShell } from "@/components/page-shell";
import { MemberInviteManager, type CompanyMember } from "@/components/profile/member-invite-manager";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default async function ProfilePage() {
  const authContext = getRequestAuthContext();

  let email: string | null = null;
  let fullName = "";
  let jobTitle = "";
  let canManageMembers = false;
  let members: CompanyMember[] = [];
  const merchantId = authContext.merchantId ?? "";
  let currentUserId: string | null = null;

  if (authContext.client && merchantId) {
    const {
      data: { user }
    } = await authContext.client.auth.getUser();

    if (user) {
      currentUserId = user.id;
      email = user.email ?? null;
      fullName = getMetadataString(user.user_metadata, "full_name");
      jobTitle = getMetadataString(user.user_metadata, "job_title");
    }

    if (currentUserId) {
      const { data: currentMembership } = await authContext.client
        .from("merchant_members")
        .select("role")
        .eq("merchant_id", merchantId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      canManageMembers = currentMembership?.role === "admin";
    }

    if (canManageMembers) {
      const { data: membershipRows } = await authContext.client
        .from("merchant_members")
        .select("id, user_id, role, active, created_at, updated_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });

      const emailByUserId = new Map<string, string | null>();
      if (hasSupabaseServiceRoleEnv()) {
        const admin = createSupabaseAdminClient();
        const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const listedUser of listData?.users ?? []) {
          emailByUserId.set(listedUser.id, listedUser.email ?? null);
        }
      }

      members = (membershipRows ?? []).map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role as CompanyMember["role"],
        active: member.active,
        created_at: member.created_at,
        updated_at: member.updated_at,
        email: emailByUserId.get(member.user_id) ?? null
      }));
    }
  }

  return (
    <PageShell
      pathname="/profile"
      title="Profile settings"
      subtitle="Update your operator details used across alerts, case notes, and dashboard context."
    >
      <SectionCard title="Operator profile" eyebrow="Account">
        <ProfileEditor email={email} initialFullName={fullName} initialJobTitle={jobTitle} />
      </SectionCard>
      <SectionCard title="Company members" eyebrow="Team access">
        <MemberInviteManager canManageMembers={canManageMembers} initialMembers={members} />
      </SectionCard>
    </PageShell>
  );
}
