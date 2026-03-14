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
      subtitle="Review open alerts first, follow the recommended next step, then mark reviewed so your queue stays clean."
    >
      <SectionCard title="Realtime alert stream" eyebrow="Notifications">
        <AlertManager initialAlerts={alerts} />
      </SectionCard>
    </PageShell>
  );
}
