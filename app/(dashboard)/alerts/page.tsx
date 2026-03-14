import { AlertManager } from "@/components/alerts/alert-manager";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getAlertsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const authContext = getRequestAuthContext();
  const alerts = await getAlertsData(authContext.merchantId ?? undefined, authContext.client ?? undefined);

  return (
    <PageShell
      pathname="/alerts"
      title="Alert center"
      subtitle="Track suspicious events across logins, transactions, and device changes. Alerts are designed for dashboard, email, webhook, and Slack delivery."
    >
      <SectionCard title="Realtime alert stream" eyebrow="Notifications">
        <AlertManager initialAlerts={alerts} />
      </SectionCard>
    </PageShell>
  );
}
