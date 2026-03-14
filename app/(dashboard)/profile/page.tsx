import { PageShell } from "@/components/page-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";

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

  if (authContext.client) {
    const {
      data: { user }
    } = await authContext.client.auth.getUser();

    if (user) {
      email = user.email ?? null;
      fullName = getMetadataString(user.user_metadata, "full_name");
      jobTitle = getMetadataString(user.user_metadata, "job_title");
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
    </PageShell>
  );
}
