import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getMerchantBillingSnapshot } from "@/lib/billing";
import { getDashboardData, getDashboardKpiSummaryData } from "@/lib/trustguard-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pct(used: number, limit: number | null) {
  if (limit === null || limit <= 0) {
    return null;
  }
  return Number(((used / limit) * 100).toFixed(2));
}

export default async function ScorecardPage() {
  const authContext = getRequestAuthContext();
  const [billing, kpis, dashboard] = await Promise.all([
    getMerchantBillingSnapshot(authContext.client ?? null, authContext.merchantId ?? ""),
    getDashboardKpiSummaryData(30, authContext.merchantId ?? undefined, authContext.client ?? undefined),
    getDashboardData(authContext.merchantId ?? undefined, authContext.client ?? undefined)
  ]);

  const openAlerts = dashboard.alerts.filter((item) => !item.acknowledgedAt).length;
  const openCases = dashboard.fraudCases.filter((item) => item.status !== "resolved").length;
  const reviewTransactions = dashboard.transactions.filter((item) => item.status === "review").length;
  const quotaAlerts = dashboard.alerts
    .filter((item) => item.alertType.startsWith("billing_"))
    .slice(0, 3);

  const transactionUsagePct = pct(
    billing.usage.transactionScored,
    billing.limits.monthlyTransactionLimit
  );
  const apiUsagePct = pct(billing.usage.apiCalls, billing.limits.monthlyApiCallLimit);

  return (
    <PageShell
      pathname="/scorecard"
      title="Business scorecard"
      subtitle="Track plan consumption, fraud performance, and operations health in one place."
    >
      <SectionCard title="Plan and usage" eyebrow="Monetization">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Plan</div>
            <div className="mt-2 text-2xl font-semibold capitalize text-white">{billing.planLabel}</div>
            <div className="mt-1 text-xs text-slate-400">Tier: {billing.planTier}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Transactions this month</div>
            <div className="mt-2 text-2xl font-semibold text-white">{billing.usage.transactionScored}</div>
            <div className="mt-1 text-xs text-slate-400">
              Limit: {billing.limits.monthlyTransactionLimit ?? "Unlimited"}
              {transactionUsagePct !== null ? ` (${transactionUsagePct}%)` : ""}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">API calls this month</div>
            <div className="mt-2 text-2xl font-semibold text-white">{billing.usage.apiCalls}</div>
            <div className="mt-1 text-xs text-slate-400">
              Limit: {billing.limits.monthlyApiCallLimit ?? "Unlimited"}
              {apiUsagePct !== null ? ` (${apiUsagePct}%)` : ""}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Fraud KPI summary (30d)" eyebrow="Performance">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Precision</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpis.estimatedPrecisionPct}%</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Recall</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpis.estimatedRecallPct}%</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Latency p95</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpis.transactionLatencyMsP95}ms</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">API uptime</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpis.apiUptimePct}%</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Protected value</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {formatCurrency(kpis.revenueProtectedAmount, "USD")}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Operations snapshot" eyebrow="Workload">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Open alerts</div>
            <div className="mt-2 text-2xl font-semibold text-white">{openAlerts}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Open cases</div>
            <div className="mt-2 text-2xl font-semibold text-white">{openCases}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Needs review</div>
            <div className="mt-2 text-2xl font-semibold text-white">{reviewTransactions}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Drift signal</div>
            <div className="mt-2 text-2xl font-semibold capitalize text-white">{kpis.modelDriftSignal}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Quota notifications" eyebrow="Billing alerts">
        {quotaAlerts.length === 0 ? (
          <p className="text-sm text-slate-300">No quota warnings this month.</p>
        ) : (
          <div className="space-y-3">
            {quotaAlerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-400">
                  <span>{alert.severity}</span>
                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm text-white">{alert.summary}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
