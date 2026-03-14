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
      subtitle="Set fraud decision rules with a guided builder first, then use advanced expressions when your team is ready."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Active policies" eyebrow="Rules">
          <RulesManager initialRules={riskRules} />
        </SectionCard>

        <SectionCard title="New user quick start" eyebrow="Controls">
          <div className="space-y-4 text-sm text-slate-300">
            <p>If you are new to fraud rules, start simple and tighten only when you see repeat abuse patterns.</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-medium text-white">Recommended order</div>
              <ul className="mt-3 space-y-2 text-slate-300">
                <li>1. Add one high-amount review rule</li>
                <li>2. Add one failed-login + new-device rule</li>
                <li>3. Track alert noise for 24-48 hours</li>
                <li>4. Upgrade only noisy rules from review to block</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-alarm/20 bg-alarm/10 p-4 text-slate-200">
              Default to <span className="font-semibold">review</span> for new rules. Move to block only after verification.
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
