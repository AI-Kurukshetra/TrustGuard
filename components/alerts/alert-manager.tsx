"use client";

import { useState } from "react";
import type { Alert } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

type AlertManagerProps = {
  initialAlerts: Alert[];
};

export function AlertManager({ initialAlerts }: AlertManagerProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  async function acknowledge(alertId: string) {
    setError(null);
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
    } catch {
      setError("Network error while acknowledging alert.");
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-white">{alert.alertType}</span>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {alert.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{alert.summary}</p>
              <div className="mt-3">
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
                    {mutatingId === alert.id ? "Saving..." : "Acknowledge"}
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-400">{formatTimestamp(alert.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
