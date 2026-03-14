import { PageShell } from "@/components/page-shell";
import { RulesManager } from "@/components/rules/rules-manager";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getRiskRulesData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const authContext = getRequestAuthContext();
  const riskRules = await getRiskRulesData(authContext.merchantId ?? undefined, authContext.client ?? undefined);

  return (
    <PageShell
      pathname="/rules"
      title="Risk rules engine"
      subtitle="Configure fraud decision logic without redeploying application code. Rules complement AI scoring with transparent business controls."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Active policies" eyebrow="Rules">
          <RulesManager initialRules={riskRules} />
        </SectionCard>

        <SectionCard title="Policy design principles" eyebrow="Controls">
          <div className="space-y-4 text-sm text-slate-300">
            <p>Rules should remain explainable, measurable, and easy to override with trusted entity controls.</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-medium text-white">Recommended layers</div>
              <ul className="mt-3 space-y-2 text-slate-300">
                <li>Amount and velocity thresholds</li>
                <li>Device trust and fingerprint freshness</li>
                <li>Geolocation mismatch and impossible travel checks</li>
                <li>Whitelist and blacklist overrides</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-alarm/20 bg-alarm/10 p-4 text-slate-200">
              Keep false positives low by routing mid-risk events to review instead of block whenever the model confidence is mixed.
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
