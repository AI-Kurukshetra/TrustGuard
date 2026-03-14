"use client";

import { useMemo, useState } from "react";
import type { FraudCase, Transaction } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";
import { RiskBadge } from "@/components/risk-badge";

type CaseManagerProps = {
  initialCases: FraudCase[];
  transactions: Transaction[];
};

type CaseStatus = "open" | "in_review" | "escalated" | "resolved";
type CaseFilter = "all" | CaseStatus;

const caseStatusOptions: Array<{ status: CaseStatus; label: string }> = [
  { status: "open", label: "Open" },
  { status: "in_review", label: "In review" },
  { status: "escalated", label: "Escalated" },
  { status: "resolved", label: "Resolved" }
];

function recommendationForCase(riskScore: number, status: CaseStatus) {
  if (status === "resolved") {
    return "No further action unless new linked alerts appear.";
  }
  if (riskScore >= 85) {
    return "Escalate or keep blocked until identity and payment checks are completed.";
  }
  if (riskScore >= 60) {
    return "Move to in-review and confirm device, location, and payment evidence.";
  }
  return "Low risk signal. Resolve if supporting checks are clean.";
}

function recommendedStatusForCase(riskScore: number): CaseStatus {
  if (riskScore >= 85) {
    return "escalated";
  }
  if (riskScore >= 60) {
    return "in_review";
  }
  return "resolved";
}

export function CaseManager({ initialCases, transactions }: CaseManagerProps) {
  const [cases, setCases] = useState(initialCases);
  const [isMutatingCaseId, setIsMutatingCaseId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CaseFilter>("open");
  const [query, setQuery] = useState("");
  const [draftStatuses, setDraftStatuses] = useState<Record<string, CaseStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const txMap = useMemo(() => new Map(transactions.map((item) => [item.id, item])), [transactions]);

  const summary = useMemo(() => {
    return {
      total: cases.length,
      open: cases.filter((item) => item.status === "open").length,
      in_review: cases.filter((item) => item.status === "in_review").length,
      escalated: cases.filter((item) => item.status === "escalated").length,
      resolved: cases.filter((item) => item.status === "resolved").length
    };
  }, [cases]);

  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = cases.filter((item) => {
      if (filter !== "all" && item.status !== filter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const transaction = txMap.get(item.transactionId);
      const haystack = [
        item.id,
        item.transactionId,
        item.owner,
        item.analystNotes,
        transaction?.reason ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return filtered.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [cases, filter, query, txMap]);

  async function updateStatus(caseId: string, status: CaseStatus, note?: string) {
    setIsMutatingCaseId(caseId);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note ?? null })
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Failed to update case status.");
        return;
      }

      setCases((current) => current.map((item) => (item.id === caseId ? { ...item, status } : item)));
      setDraftStatuses((current) => ({ ...current, [caseId]: status }));
      setInfo(`Case ${caseId.slice(0, 8)} moved to ${status}.`);
    } catch {
      setError("Network error while updating case.");
    } finally {
      setIsMutatingCaseId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Total</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Open</div>
          <div className="mt-1 text-lg font-semibold text-amber-200">{summary.open}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">In review</div>
          <div className="mt-1 text-lg font-semibold text-cyan-200">{summary.in_review}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Escalated</div>
          <div className="mt-1 text-lg font-semibold text-alarm">{summary.escalated}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Resolved</div>
          <div className="mt-1 text-lg font-semibold text-emerald-300">{summary.resolved}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
        <span className="text-slate-400">Queue view:</span>
        {([
          ["open", "Open"],
          ["in_review", "In review"],
          ["escalated", "Escalated"],
          ["resolved", "Resolved"],
          ["all", "All"]
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-md px-2.5 py-1.5",
              filter === key ? "bg-pulse text-slate-950" : "border border-white/15 text-slate-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by case ID, transaction ID, owner, note, or reason..."
        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-pulse/60"
      />

      {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}
      {info ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}

      {visibleCases.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
          No cases match your filter.
        </div>
      ) : null}

      {visibleCases.map((fraudCase) => {
        const transaction = txMap.get(fraudCase.transactionId);
        if (!transaction) {
          return null;
        }

        const recommendedStatus = recommendedStatusForCase(transaction.riskScore);
        const draftStatus = draftStatuses[fraudCase.id] ?? fraudCase.status;

        return (
          <div key={fraudCase.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-white">Case {fraudCase.id}</div>
                <div className="text-xs text-slate-400">{formatTimestamp(fraudCase.createdAt)}</div>
              </div>
              <div className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {fraudCase.status}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <RiskBadge score={transaction.riskScore} />
              <div className="space-y-1 text-sm text-slate-300">
                <p>{transaction.reason}</p>
                <p className="text-xs text-cyan-200">Next step: {recommendationForCase(transaction.riskScore, fraudCase.status)}</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{fraudCase.analystNotes}</div>
            <div className="mt-2 text-xs text-slate-400">Owner: {fraudCase.owner}</div>

            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <select
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatuses((current) => ({
                    ...current,
                    [fraudCase.id]: event.target.value as CaseStatus
                  }))
                }
                disabled={isMutatingCaseId === fraudCase.id}
                className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-pulse/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {caseStatusOptions.map((entry) => (
                  <option key={entry.status} value={entry.status}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  updateStatus(
                    fraudCase.id,
                    draftStatus,
                    `Case status updated to ${draftStatus} from dashboard case queue.`
                  )
                }
                disabled={isMutatingCaseId === fraudCase.id || draftStatus === fraudCase.status}
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutatingCaseId === fraudCase.id ? "Saving..." : "Save status"}
              </button>
              <button
                type="button"
                onClick={() =>
                  updateStatus(
                    fraudCase.id,
                    recommendedStatus,
                    `Recommended status ${recommendedStatus} applied from risk score ${transaction.riskScore}.`
                  )
                }
                disabled={isMutatingCaseId === fraudCase.id || recommendedStatus === fraudCase.status}
                className="rounded-lg border border-pulse/45 bg-pulse/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-pulse transition hover:border-pulse/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply recommended ({recommendedStatus})
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Recommended path uses current risk score and keeps high-risk cases escalated first.
            </div>
          </div>
        );
      })}
    </div>
  );
}
