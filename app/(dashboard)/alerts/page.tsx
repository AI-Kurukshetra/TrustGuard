import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getAlertsData } from "@/lib/trustguard-data";
import { formatTimestamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getAlertsData();

  return (
    <PageShell
      pathname="/alerts"
      title="Alert center"
      subtitle="Track suspicious events across logins, transactions, and device changes. Alerts are designed for dashboard, email, webhook, and Slack delivery."
    >
      <SectionCard title="Realtime alert stream" eyebrow="Notifications">
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{alert.alertType}</span>
                    <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{alert.summary}</p>
                </div>
                <div className="text-xs text-slate-400">{formatTimestamp(alert.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageShell>
  );
}
