"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Alert } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";

type AlertManagerProps = {
  initialAlerts: Alert[];
};

type AlertFilter = "all" | "open" | "acknowledged";

function nextStepForAlert(alert: Alert) {
  if (alert.severity === "critical") {
    return "Escalate to a case now.";
  }
  if (alert.severity === "high") {
    return "Review transaction and device history.";
  }
  if (alert.severity === "medium") {
    return "Acknowledge if expected, otherwise monitor account activity.";
  }
  return "Track only if repeated or linked to other alerts.";
}

export function AlertManager({ initialAlerts }: AlertManagerProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState<AlertFilter>("open");
  const [severity, setSeverity] = useState<"all" | Alert["severity"]>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const openCount = alerts.filter((item) => !item.acknowledgedAt).length;
    const criticalCount = alerts.filter((item) => item.severity === "critical").length;
    const highCount = alerts.filter((item) => item.severity === "high").length;

    return {
      total: alerts.length,
      open: openCount,
      acknowledged: alerts.length - openCount,
      critical: criticalCount,
      high: highCount
    };
  }, [alerts]);

  const visibleAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = alerts.filter((item) => {
      if (filter === "open" && item.acknowledgedAt) {
        return false;
      }
      if (filter === "acknowledged" && !item.acknowledgedAt) {
        return false;
      }
      if (severity !== "all" && item.severity !== severity) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = [item.id, item.alertType, item.summary, item.entityId].join(" ").toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((left, right) => {
      const leftAck = left.acknowledgedAt ? 1 : 0;
      const rightAck = right.acknowledgedAt ? 1 : 0;
      if (leftAck !== rightAck) {
        return leftAck - rightAck;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [alerts, filter, query, severity]);

  const visibleOpenAlertIds = useMemo(
    () => visibleAlerts.filter((alert) => !alert.acknowledgedAt).map((alert) => alert.id),
    [visibleAlerts]
  );

  async function acknowledge(alertId: string) {
    setError(null);
    setInfo(null);
    setMutatingId(alertId);

    try {
      const response = await fetch(`/api/alerts/${alertId}`, { method: "PATCH" });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; data?: { acknowledged_at?: string } }
        | null;

      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Failed to acknowledge alert.");
        return;
      }

      const acknowledgedAt = body.data.acknowledged_at ?? new Date().toISOString();
      setAlerts((current) =>
        current.map((item) => (item.id === alertId ? { ...item, acknowledgedAt } : item))
      );
      setInfo(`Alert ${alertId.slice(0, 8)} marked reviewed.`);
    } catch {
      setError("Network error while acknowledging alert.");
    } finally {
      setMutatingId(null);
    }
  }

  async function acknowledgeVisibleOpenAlerts() {
    if (visibleOpenAlertIds.length === 0) {
      return;
    }

    setError(null);
    setInfo(null);
    setMutatingId("bulk");

    let successCount = 0;
    for (const alertId of visibleOpenAlertIds) {
      try {
        const response = await fetch(`/api/alerts/${alertId}`, { method: "PATCH" });
        const body = (await response.json().catch(() => null)) as
          | { error?: string; data?: { acknowledged_at?: string } }
          | null;

        if (!response.ok || !body?.data) {
          continue;
        }

        const acknowledgedAt = body.data.acknowledged_at ?? new Date().toISOString();
        setAlerts((current) =>
          current.map((item) => (item.id === alertId ? { ...item, acknowledgedAt } : item))
        );
        successCount += 1;
      } catch {
        // Keep processing remaining alerts to avoid partial-update dead ends.
      }
    }

    if (successCount === 0) {
      setError("No alerts were acknowledged. Please retry.");
    } else {
      setInfo(`Marked ${successCount} alert${successCount === 1 ? "" : "s"} as reviewed.`);
    }

    setMutatingId(null);
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
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Acknowledged</div>
          <div className="mt-1 text-lg font-semibold text-emerald-300">{summary.acknowledged}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Critical</div>
          <div className="mt-1 text-lg font-semibold text-alarm">{summary.critical}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">High</div>
          <div className="mt-1 text-lg font-semibold text-orange-300">{summary.high}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
        <span className="text-slate-400">Show:</span>
        {([
          ["open", "Open first"],
          ["all", "All alerts"],
          ["acknowledged", "Acknowledged"]
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

        <span className="ml-2 text-slate-400">Severity:</span>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as "all" | Alert["severity"])}
          className="rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-slate-200"
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          type="button"
          onClick={acknowledgeVisibleOpenAlerts}
          disabled={visibleOpenAlertIds.length === 0 || mutatingId === "bulk"}
          className="rounded-md border border-white/15 bg-black/25 px-2.5 py-1.5 text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutatingId === "bulk" ? "Saving..." : `Mark visible open as reviewed (${visibleOpenAlertIds.length})`}
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by alert ID, type, entity, or summary..."
        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-pulse/60"
      />

      {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}
      {info ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-200">{info}</p> : null}

      {visibleAlerts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
          No alerts match your current filters.
        </div>
      ) : null}

      {visibleAlerts.map((alert) => (
        <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{alert.alertType}</span>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {alert.severity}
                </span>
                {alert.acknowledgedAt ? (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[11px] text-emerald-300">
                    reviewed
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-2 py-0.5 text-[11px] text-amber-200">
                    action needed
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-300">{alert.summary}</p>
              <p className="mt-2 text-xs text-cyan-200">Next step: {nextStepForAlert(alert)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {alert.acknowledgedAt ? (
                  <span className="text-xs text-emerald-300">
                    Acknowledged at {formatTimestamp(alert.acknowledgedAt)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => acknowledge(alert.id)}
                    disabled={mutatingId === alert.id}
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mutatingId === alert.id ? "Saving..." : "Mark reviewed"}
                  </button>
                )}
                {alert.severity === "critical" || alert.severity === "high" ? (
                  <Link
                    href="/cases"
                    className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:border-white/30"
                  >
                    Open cases queue
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="text-xs text-slate-400">{formatTimestamp(alert.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
