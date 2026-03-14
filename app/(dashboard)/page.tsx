import { PageShell } from "@/components/page-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { getDashboardData } from "@/lib/trustguard-data";
import { formatCurrency, formatTimestamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { alerts, fraudCases, metrics, transactions } = await getDashboardData();

  return (
    <PageShell
      pathname="/"
      title="Realtime fraud command center"
      subtitle="Monitor scoring latency, high-risk transactions, analyst workload, and policy outcomes from one security-oriented control plane."
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Live transaction queue" eyebrow="Scoring">
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{transaction.id}</span>
                    <RiskBadge score={transaction.riskScore} />
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {formatCurrency(transaction.amount, transaction.currency)} via {transaction.channel} in{" "}
                    {transaction.location}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{transaction.reason}</div>
                </div>
                <div className="text-sm text-slate-400">
                  <div className="capitalize text-white">{transaction.status}</div>
                  <div>{formatTimestamp(transaction.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Analyst load and alerts" eyebrow="Operations">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Open investigations</div>
              <div className="mt-2 text-4xl font-semibold text-white">{fraudCases.length}</div>
              <div className="mt-2 text-sm text-slate-300">1 escalated, 1 pending decision</div>
            </div>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{alert.alertType}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{alert.severity}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{alert.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
