"use client";

import { useState } from "react";
import type { RiskRule } from "@/lib/types";

type RulesManagerProps = {
  initialRules: RiskRule[];
};

type RuleActionForm = "approve" | "review" | "block";

function mapActionToApi(action: RuleActionForm) {
  if (action === "approve") {
    return "allow";
  }
  return action;
}

export function RulesManager({ initialRules }: RulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [action, setAction] = useState<RuleActionForm>("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRule() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: name,
          condition_expression: condition,
          action: mapActionToApi(action),
          active: true,
          priority: 100
        })
      });
      const body = (await response.json().catch(() => null)) as { error?: string; data?: Record<string, unknown> } | null;

      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Failed to create rule.");
        return;
      }

      const nextRule: RiskRule = {
        id: String(body.data.id),
        ruleName: String(body.data.rule_name),
        condition: String(body.data.condition_expression),
        action: action,
        active: Boolean(body.data.active),
        hitRate: Number(body.data.hit_count ?? 0)
      };

      setRules((current) => [...current, nextRule]);
      setName("");
      setCondition("");
      setAction("review");
    } catch {
      setError("Network error while creating rule.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleRule(id: string, active: boolean) {
    const response = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active })
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "Failed to update rule.");
      return;
    }
    setRules((current) => current.map((item) => (item.id === id ? { ...item, active: !active } : item)));
  }

  async function deleteRule(id: string) {
    const response = await fetch(`/api/rules/${id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "Failed to delete rule.");
      return;
    }
    setRules((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-medium text-white">Create rule</div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.2fr_auto_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Rule name"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
          />
          <input
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            placeholder="Condition expression"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
          />
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as RuleActionForm)}
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
          >
            <option value="approve">approve</option>
            <option value="review">review</option>
            <option value="block">block</option>
          </select>
          <button
            type="button"
            onClick={createRule}
            disabled={isSubmitting || !name.trim() || !condition.trim()}
            className="rounded-lg bg-pulse px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Add"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
      </div>

      {rules.map((rule) => (
        <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">{rule.ruleName}</div>
              <div className="mt-1 text-xs text-slate-400">{rule.id}</div>
            </div>
            <div className="rounded-full bg-pulse/10 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-pulse">
              {rule.action}
            </div>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">
            {rule.condition}
          </pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleRule(rule.id, rule.active)}
              className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
            >
              {rule.active ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={() => deleteRule(rule.id)}
              className="rounded-lg border border-alarm/40 bg-alarm/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-alarm"
            >
              Delete
            </button>
            <span className="text-xs text-slate-400">Weekly hit rate: {rule.hitRate}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
