import { CaseManager } from "@/components/cases/case-manager";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getFraudCasesData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const authContext = getRequestAuthContext();
  const { fraudCases, transactions } = await getFraudCasesData(
    authContext.merchantId ?? undefined,
    authContext.client ?? undefined
  );

  return (
    <PageShell
      pathname="/cases"
      title="Fraud case management"
      subtitle="Use the case queue to move work from open to review, escalate high-risk cases, and close only after evidence checks."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Case queue" eyebrow="Investigations">
          <CaseManager initialCases={fraudCases} transactions={transactions} />
        </SectionCard>

        <SectionCard title="Investigation workflow" eyebrow="Playbook">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "1. Intake",
                body: "Start with open cases, claim ownership, and confirm alert + transaction context."
              },
              {
                title: "2. Investigate",
                body: "Check device history, location changes, failed logins, and payment evidence."
              },
              {
                title: "3. Decide",
                body: "Escalate high risk, resolve low risk, and keep notes clear for audit."
              }
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-medium text-white">{step.title}</div>
                <p className="mt-2 text-sm text-slate-300">{step.body}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
