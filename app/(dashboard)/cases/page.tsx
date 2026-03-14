import { PageShell } from "@/components/page-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SectionCard } from "@/components/section-card";
import { getFraudCasesData } from "@/lib/trustguard-data";
import { formatTimestamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const { fraudCases, transactions } = await getFraudCasesData();

  return (
    <PageShell
      pathname="/cases"
      title="Fraud case management"
      subtitle="Analysts can review flagged transactions, see investigation history, and move decisions from triage to escalation with clear reasoning."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Case queue" eyebrow="Investigations">
          <div className="space-y-4">
            {fraudCases.map((fraudCase) => {
              const transaction = transactions.find((item) => item.id === fraudCase.transactionId);
              if (!transaction) {
                return null;
              }

              return (
                <div key={fraudCase.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{fraudCase.id}</div>
                      <div className="text-xs text-slate-400">{formatTimestamp(fraudCase.createdAt)}</div>
                    </div>
                    <div className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {fraudCase.status}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <RiskBadge score={transaction.riskScore} />
                    <span className="text-sm text-slate-300">{transaction.reason}</span>
                  </div>
                  <div className="mt-4 text-sm text-slate-300">{fraudCase.analystNotes}</div>
                  <div className="mt-3 text-xs text-slate-400">Owner: {fraudCase.owner}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Investigation workflow" eyebrow="Playbook">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "1. Intake",
                body: "Receive alert, attach transaction context, and lock analyst ownership."
              },
              {
                title: "2. Investigate",
                body: "Compare device history, travel pattern, login anomalies, and payment retries."
              },
              {
                title: "3. Decide",
                body: "Approve, reject, or escalate while preserving explainable notes for audit."
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
