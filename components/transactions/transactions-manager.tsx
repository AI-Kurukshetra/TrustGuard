"use client";

import { useMemo, useState } from "react";
import type { Transaction, User } from "@/lib/types";
import { RiskBadge } from "@/components/risk-badge";
import { cn, formatCurrency, formatTimestamp } from "@/lib/utils";

type TransactionsManagerProps = {
  initialTransactions: Transaction[];
  users: User[];
};

type TransactionStatusFilter = "all" | Transaction["status"];
type TransactionStatus = Transaction["status"];

const statusFilters: Array<{ key: TransactionStatusFilter; label: string }> = [
  { key: "review", label: "Review first" },
  { key: "blocked", label: "Blocked" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" }
];

const statusActions: Array<{ status: TransactionStatus; label: string }> = [
  { status: "approved", label: "Approve" },
  { status: "review", label: "Send to review" },
  { status: "blocked", label: "Block" }
];

function recommendedStatusForRisk(score: number): TransactionStatus {
  if (score >= 85) {
    return "blocked";
  }
  if (score >= 60) {
    return "review";
  }
  return "approved";
}

function recommendationText(status: TransactionStatus) {
  if (status === "blocked") {
    return "Keep blocked until investigation confirms safe recovery.";
  }
  if (status === "review") {
    return "Prioritize analyst review before authorization.";
  }
  return "Safe to approve with monitoring.";
}

export function TransactionsManager({ initialTransactions, users }: TransactionsManagerProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState<TransactionStatusFilter>("review");
  const [query, setQuery] = useState("");
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const summary = useMemo(() => {
    const approved = transactions.filter((item) => item.status === "approved").length;
    const review = transactions.filter((item) => item.status === "review").length;
    const blocked = transactions.filter((item) => item.status === "blocked").length;

    return {
      total: transactions.length,
      approved,
      review,
      blocked
    };
  }, [transactions]);

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return transactions
      .filter((transaction) => (filter === "all" ? true : transaction.status === filter))
      .filter((transaction) => {
        if (!normalizedQuery) {
          return true;
        }

        const user = usersById.get(transaction.userId);
        const haystack = [
          transaction.id,
          user?.email ?? "",
          transaction.location,
          transaction.channel,
          transaction.reason
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [filter, query, transactions, usersById]);

  async function updateTransactionStatus(transactionId: string, status: TransactionStatus) {
    setError(null);
    setInfo(null);
    setMutatingId(transactionId);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Unable to update transaction.");
        return;
      }

      setTransactions((current) =>
        current.map((item) => (item.id === transactionId ? { ...item, status } : item))
      );
      setInfo(`Transaction ${transactionId.slice(0, 8)} moved to ${status}.`);
    } catch {
      setError("Network error while updating transaction.");
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Total</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Review</div>
          <div className="mt-1 text-lg font-semibold text-amber-200">{summary.review}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Blocked</div>
          <div className="mt-1 text-lg font-semibold text-alarm">{summary.blocked}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Approved</div>
          <div className="mt-1 text-lg font-semibold text-emerald-300">{summary.approved}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Queue view:</span>
          {statusFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5",
                filter === item.key ? "bg-pulse text-slate-950" : "border border-white/15 text-slate-300"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by transaction ID, user email, location, channel, or signal..."
          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-pulse/60"
        />
      </div>

      {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}
      {info ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}

      {visibleTransactions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
          No transactions match your current filter.
        </div>
      ) : null}

      {visibleTransactions.map((transaction) => {
        const user = usersById.get(transaction.userId);
        const recommendedStatus = recommendedStatusForRisk(transaction.riskScore);

        return (
          <div key={transaction.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{transaction.id}</div>
                <div className="mt-1 text-xs text-slate-400">{formatTimestamp(transaction.createdAt)}</div>
                <div className="mt-2 text-sm text-slate-300">
                  {formatCurrency(transaction.amount, transaction.currency)} via {transaction.channel} in{" "}
                  {transaction.location}
                </div>
                <div className="mt-1 text-xs text-slate-400">{(user?.email ?? transaction.userId) || "Unknown user"}</div>
              </div>
              <div className="flex items-center gap-3">
                <RiskBadge score={transaction.riskScore} />
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {transaction.status}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              <div>{transaction.reason}</div>
              <div className="mt-2 text-xs text-cyan-200">
                Recommended: {recommendedStatus} • {recommendationText(recommendedStatus)}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {statusActions
                .filter((item) => item.status !== transaction.status)
                .map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => updateTransactionStatus(transaction.id, item.status)}
                    disabled={mutatingId === transaction.id}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50",
                      item.status === recommendedStatus
                        ? "border-pulse/45 bg-pulse/20 text-pulse hover:border-pulse/60"
                        : "border-white/15 bg-black/25 text-slate-200 hover:border-white/30"
                    )}
                  >
                    {mutatingId === transaction.id ? "Saving..." : item.label}
                  </button>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
