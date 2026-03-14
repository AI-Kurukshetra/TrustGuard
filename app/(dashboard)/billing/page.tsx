import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { BILLING_PLAN_DEFINITIONS, getMerchantBillingSnapshot, type PlanFeatureKey } from "@/lib/billing";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export const dynamic = "force-dynamic";

function pct(used: number, limit: number | null) {
  if (limit === null || limit <= 0) {
    return null;
  }
  return Number(((used / limit) * 100).toFixed(2));
}

function featureLabel(feature: PlanFeatureKey) {
  if (feature === "advanced_detection_suite") {
    return "Advanced detection suite";
  }
  if (feature === "cross_merchant_intelligence") {
    return "Cross-merchant intelligence";
  }
  if (feature === "federated_learning") {
    return "Federated learning";
  }
  if (feature === "quantum_crypto") {
    return "Quantum-resistant crypto";
  }
  return "White-label deployment";
}

export default async function BillingPage() {
  const authContext = getRequestAuthContext();
  const billing = await getMerchantBillingSnapshot(authContext.client ?? null, authContext.merchantId ?? "");

  const transactionUsagePct = pct(
    billing.usage.transactionScored,
    billing.limits.monthlyTransactionLimit
  );
  const apiUsagePct = pct(billing.usage.apiCalls, billing.limits.monthlyApiCallLimit);

  const lockedFeatures = (Object.entries(billing.features) as Array<[PlanFeatureKey, boolean]>)
    .filter(([, enabled]) => !enabled)
    .map(([feature]) => featureLabel(feature));

  const canUpgrade = billing.planTier !== "enterprise";
  const nextTier = billing.planTier === "starter" ? "Growth" : "Enterprise";

  return (
    <PageShell
      pathname="/billing"
      title="Billing and plans"
      subtitle="Monitor plan limits, feature access, and billing readiness from one place."
    >
      <SectionCard title="Current plan" eyebrow="Subscription">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Active tier</div>
            <div className="mt-2 text-2xl font-semibold text-white">{billing.planLabel}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{billing.planTier}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Transactions (monthly)</div>
            <div className="mt-2 text-2xl font-semibold text-white">{billing.usage.transactionScored}</div>
            <div className="mt-1 text-xs text-slate-400">
              Limit: {billing.limits.monthlyTransactionLimit ?? "Unlimited"}
              {transactionUsagePct !== null ? ` (${transactionUsagePct}%)` : ""}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">API calls (monthly)</div>
            <div className="mt-2 text-2xl font-semibold text-white">{billing.usage.apiCalls}</div>
            <div className="mt-1 text-xs text-slate-400">
              Limit: {billing.limits.monthlyApiCallLimit ?? "Unlimited"}
              {apiUsagePct !== null ? ` (${apiUsagePct}%)` : ""}
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-400">Usage period: {billing.usage.periodKey}</div>
      </SectionCard>

      <SectionCard title="Feature access" eyebrow="Entitlements">
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(BILLING_PLAN_DEFINITIONS.enterprise.features) as PlanFeatureKey[]).map((feature) => {
            const enabled = billing.features[feature];
            return (
              <div
                key={feature}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="text-sm text-slate-100">{featureLabel(feature)}</span>
                <span
                  className={
                    enabled
                      ? "rounded-lg border border-ok/30 bg-ok/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-ok"
                      : "rounded-lg border border-slate-500/30 bg-slate-700/20 px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-300"
                  }
                >
                  {enabled ? "Enabled" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Upgrade options"
        eyebrow="Monetization"
        action={
          canUpgrade ? (
            <a
              href="mailto:sales@trustguard.ai?subject=TrustGuard%20Plan%20Upgrade"
              className="rounded-xl border border-pulse/45 bg-pulse/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-pulse transition hover:border-pulse/60 hover:bg-pulse/20"
            >
              Contact sales
            </a>
          ) : null
        }
      >
        {canUpgrade ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              You are currently on <span className="font-semibold text-white">{billing.planLabel}</span>. The next
              recommended tier is <span className="font-semibold text-white">{nextTier}</span>.
            </p>
            {lockedFeatures.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Currently locked</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  {lockedFeatures.slice(0, 4).map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="text-sm text-slate-300">
              For current usage snapshots, check{" "}
              <Link className="text-pulse underline decoration-pulse/50" href="/scorecard">
                scorecard
              </Link>{" "}
              or call <code>/api/billing/entitlements</code>.
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">
            Enterprise tier is active. Reach out to support for custom contract changes and white-label rollout.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Invoice history" eyebrow="Placeholder">
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-5">
          <div className="text-sm text-slate-300">
            Invoicing is not integrated yet. This section is reserved for billing-provider invoice sync and payment
            status history.
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Interim workflow: use <code>/api/billing/usage</code> exports plus monthly reconciliation in finance ops.
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
