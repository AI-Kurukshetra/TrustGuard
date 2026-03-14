"use client";

import { useMemo, useState } from "react";
import type { FraudCase, Transaction } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";
import { RiskBadge } from "@/components/risk-badge";

type CaseManagerProps = {
  initialCases: FraudCase[];
  transactions: Transaction[];
};

type CaseStatus = "open" | "in_review" | "escalated" | "resolved";

const statuses: CaseStatus[] = ["open", "in_review", "escalated", "resolved"];

export function CaseManager({ initialCases, transactions }: CaseManagerProps) {
  const [cases, setCases] = useState(initialCases);
  const [isMutatingCaseId, setIsMutatingCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const txMap = useMemo(() => new Map(transactions.map((item) => [item.id, item])), [transactions]);

  async function updateStatus(caseId: string, status: CaseStatus) {
    setIsMutatingCaseId(caseId);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Failed to update case status.");
        return;
      }

      setCases((current) => current.map((item) => (item.id === caseId ? { ...item, status } : item)));
    } catch {
      setError("Network error while updating case.");
    } finally {
      setIsMutatingCaseId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}
      {cases.map((fraudCase) => {
        const transaction = txMap.get(fraudCase.transactionId);
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
            <div className="mt-2 text-xs text-slate-400">Owner: {fraudCase.owner}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatus(fraudCase.id, status)}
                  disabled={isMutatingCaseId === fraudCase.id || fraudCase.status === status}
                  className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
