import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { StatCard } from "@/components/stat-card";
import { getDashboardData, getDashboardKpiSummaryData } from "@/lib/trustguard-data";
import { formatCurrency, formatTimestamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QUEUE_PREVIEW_LIMIT = 5;

const transactionStatusLabel: Record<string, string> = {
  approved: "Approved",
  review: "Needs review",
  blocked: "Blocked"
};

export default async function DashboardPage() {
  const authContext = getRequestAuthContext();
  const [{ alerts, fraudCases, metrics, transactions }, kpis] = await Promise.all([
    getDashboardData(authContext.merchantId ?? undefined, authContext.client ?? undefined),
    getDashboardKpiSummaryData(30, authContext.merchantId ?? undefined, authContext.client ?? undefined)
  ]);

  const primaryMetrics = metrics.slice(0, 3);
  const secondaryMetrics = metrics.slice(3);

  const openAlerts = alerts.filter((item) => !item.acknowledgedAt);
  const criticalOpenAlerts = openAlerts.filter((item) => item.severity === "critical").length;
  const openCases = fraudCases.filter((item) => item.status !== "resolved");
  const escalatedCases = fraudCases.filter((item) => item.status === "escalated").length;
  const reviewTransactions = transactions.filter((item) => item.status === "review").length;
  const blockedTransactions = transactions.filter((item) => item.status === "blocked").length;

  const visibleTransactions = transactions.slice(0, QUEUE_PREVIEW_LIMIT);
  const visibleAlerts = alerts.slice(0, QUEUE_PREVIEW_LIMIT);

  return (
    <PageShell
      pathname="/"
      title="Realtime fraud command center"
      subtitle="Start with the focus cards, clear urgent queues, then use KPI trends for tuning."
    >
      <SectionCard title="Focus mode: start here" eyebrow="Priority">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-alarm/25 bg-alarm/10 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-alarm">Critical alerts</div>
            <div className="mt-2 text-3xl font-semibold text-white">{criticalOpenAlerts}</div>
            <p className="mt-1 text-sm text-slate-200">Needs immediate analyst review.</p>
            <Link
              href="/alerts"
              className="mt-3 inline-flex rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Open alerts
            </Link>
          </div>

          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-amber-200">Escalated cases</div>
            <div className="mt-2 text-3xl font-semibold text-white">{escalatedCases}</div>
            <p className="mt-1 text-sm text-slate-200">High-risk investigations requiring decision.</p>
            <Link
              href="/cases"
              className="mt-3 inline-flex rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Open cases
            </Link>
          </div>

          <div className="rounded-2xl border border-pulse/25 bg-pulse/10 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-pulse">Needs review</div>
            <div className="mt-2 text-3xl font-semibold text-white">{reviewTransactions}</div>
            <p className="mt-1 text-sm text-slate-200">Transactions currently in manual review.</p>
            <Link
              href="/transactions"
              className="mt-3 inline-flex rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Open queue
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Operational pulse" eyebrow="Live metrics">
        <div className="grid gap-4 xl:grid-cols-3">
          {primaryMetrics.map((metric) => (
            <StatCard key={metric.label} metric={metric} />
          ))}
        </div>
        {secondaryMetrics.length > 0 ? (
          <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer text-sm font-medium text-white">View more operational metrics</summary>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {secondaryMetrics.map((metric) => (
                <StatCard key={metric.label} metric={metric} />
              ))}
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard title="KPI pulse (30d)" eyebrow="Business telemetry">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Protected value</div>
            <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(kpis.revenueProtectedAmount, "USD")}</div>
            <div className="mt-1 text-xs text-slate-400">Blocked transaction value</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Latency p95</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpis.transactionLatencyMsP95}ms</div>
            <div className="mt-1 text-xs text-slate-400">Request telemetry</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Open investigations</div>
            <div className="mt-2 text-2xl font-semibold text-white">{openCases.length}</div>
            <div className="mt-1 text-xs text-slate-400">Cases not yet resolved</div>
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-medium text-white">View more KPI details</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Precision</div>
              <div className="mt-2 text-2xl font-semibold text-white">{kpis.estimatedPrecisionPct}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Recall</div>
              <div className="mt-2 text-2xl font-semibold text-white">{kpis.estimatedRecallPct}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">API uptime</div>
              <div className="mt-2 text-2xl font-semibold text-white">{kpis.apiUptimePct}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Model drift</div>
              <div className="mt-2 text-2xl font-semibold capitalize text-white">{kpis.modelDriftSignal}</div>
            </div>
          </div>
        </details>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Live transaction queue"
          eyebrow="Scoring"
          action={
            <Link
              href="/transactions"
              className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200"
            >
              View all
            </Link>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-slate-300">
              Needs review: {reviewTransactions}
            </span>
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-slate-300">
              Blocked: {blockedTransactions}
            </span>
          </div>

          <div className="space-y-4">
            {visibleTransactions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                No transactions yet. Send your first scoring request from the Integrations page.
              </div>
            ) : null}

            {visibleTransactions.map((transaction) => (
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
                    {formatCurrency(transaction.amount, transaction.currency)} via {transaction.channel} in {transaction.location}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{transaction.reason}</div>
                </div>
                <div className="text-sm text-slate-400">
                  <div className="text-white">{transactionStatusLabel[transaction.status] ?? transaction.status}</div>
                  <div>{formatTimestamp(transaction.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Analyst load and alerts"
          eyebrow="Operations"
          action={
            <Link
              href="/alerts"
              className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200"
            >
              View all
            </Link>
          }
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Open investigations</div>
              <div className="mt-2 text-4xl font-semibold text-white">{openCases.length}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/15 px-2.5 py-1">Escalated: {escalatedCases}</span>
                <span className="rounded-full border border-white/15 px-2.5 py-1">Open alerts: {openAlerts.length}</span>
              </div>
            </div>

            <div className="space-y-3">
              {visibleAlerts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  No alerts right now. Queue is clear.
                </div>
              ) : null}

              {visibleAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{alert.alertType}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{alert.severity}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{alert.summary}</p>
                  <div className="mt-2 text-xs text-slate-400">
                    {alert.acknowledgedAt ? "Reviewed" : "Needs action"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
