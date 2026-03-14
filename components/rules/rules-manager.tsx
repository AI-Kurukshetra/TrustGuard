"use client";

import { useMemo, useState } from "react";
import type { RiskRule } from "@/lib/types";

type RulesManagerProps = {
  initialRules: RiskRule[];
};

type RuleActionForm = "approve" | "review" | "block";
type BuilderMode = "guided" | "advanced";

type RuleTemplate = {
  id: string;
  label: string;
  description: string;
  defaultName: string;
  fieldLabel: string;
  fieldDefault: number;
  buildCondition: (value: number) => string;
};

const ruleTemplates: RuleTemplate[] = [
  {
    id: "high_amount",
    label: "High amount check",
    description: "Flag unusually large transactions.",
    defaultName: "High amount protection",
    fieldLabel: "Amount threshold (USD)",
    fieldDefault: 1500,
    buildCondition: (value) => `transaction_amount >= ${Math.max(1, Math.round(value))}`
  },
  {
    id: "velocity_spike",
    label: "Velocity spike",
    description: "Catch bursts of rapid transactions.",
    defaultName: "Velocity spike guard",
    fieldLabel: "Transactions in 1 hour",
    fieldDefault: 5,
    buildCondition: (value) => `velocity_count >= ${Math.max(1, Math.round(value))}`
  },
  {
    id: "ato_compound",
    label: "Account takeover pattern",
    description: "Catch new-device sessions with failed login bursts.",
    defaultName: "ATO compound protection",
    fieldLabel: "Failed login threshold",
    fieldDefault: 3,
    buildCondition: (value) =>
      `failed_login_count >= ${Math.max(1, Math.round(value))} AND device_is_new = true`
  },
  {
    id: "geo_risk",
    label: "Impossible travel",
    description: "Catch very fast location jumps.",
    defaultName: "Impossible travel check",
    fieldLabel: "Travel speed km/h",
    fieldDefault: 900,
    buildCondition: (value) => `travel_speed_kmh >= ${Math.max(100, Math.round(value))}`
  },
  {
    id: "behavior_risk",
    label: "Behavior anomaly",
    description: "Respond to unusual typing/touch behavior.",
    defaultName: "Behavior anomaly check",
    fieldLabel: "Behavior score threshold",
    fieldDefault: 70,
    buildCondition: (value) => `behavioral_anomaly_score >= ${Math.max(1, Math.round(value))}`
  }
];

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
  const [builderMode, setBuilderMode] = useState<BuilderMode>("guided");
  const [selectedTemplateId, setSelectedTemplateId] = useState(ruleTemplates[0]?.id ?? "high_amount");
  const [templateValue, setTemplateValue] = useState(String(ruleTemplates[0]?.fieldDefault ?? 1500));
  const [action, setAction] = useState<RuleActionForm>("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => ruleTemplates.find((item) => item.id === selectedTemplateId) ?? ruleTemplates[0],
    [selectedTemplateId]
  );

  const guidedCondition = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }
    const numericValue = Number(templateValue);
    if (!Number.isFinite(numericValue)) {
      return "";
    }

    return selectedTemplate.buildCondition(numericValue);
  }, [selectedTemplate, templateValue]);

  function applyTemplate(templateId: string) {
    const template = ruleTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setTemplateValue(String(template.fieldDefault));
    setName((current) => (current.trim() ? current : template.defaultName));
  }

  async function createRule() {
    setIsSubmitting(true);
    setError(null);

    try {
      const resolvedName = name.trim() || selectedTemplate.defaultName;
      const resolvedCondition = builderMode === "guided" ? guidedCondition.trim() : condition.trim();
      if (!resolvedName || !resolvedCondition) {
        setError("Rule name and condition are required.");
        return;
      }

      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: resolvedName,
          condition_expression: resolvedCondition,
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
        action,
        active: Boolean(body.data.active),
        hitRate: Number(body.data.hit_count ?? 0)
      };

      setRules((current) => [...current, nextRule]);
      setName("");
      setCondition("");
      setTemplateValue(String(selectedTemplate.fieldDefault));
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-white">Create rule</div>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 text-xs">
            <button
              type="button"
              onClick={() => setBuilderMode("guided")}
              className={`rounded-md px-2.5 py-1.5 ${
                builderMode === "guided" ? "bg-pulse text-slate-950" : "text-slate-300"
              }`}
            >
              Guided
            </button>
            <button
              type="button"
              onClick={() => setBuilderMode("advanced")}
              className={`rounded-md px-2.5 py-1.5 ${
                builderMode === "advanced" ? "bg-pulse text-slate-950" : "text-slate-300"
              }`}
            >
              Advanced
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          New users should start with guided templates. You can move to advanced mode any time.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Rule name (optional with guided mode)"
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
        </div>

        {builderMode === "guided" ? (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <select
                value={selectedTemplateId}
                onChange={(event) => applyTemplate(event.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
              >
                {ruleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              <input
                value={templateValue}
                onChange={(event) => setTemplateValue(event.target.value)}
                placeholder={selectedTemplate.fieldLabel}
                className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
              />
            </div>
            <p className="text-xs text-slate-300">{selectedTemplate.description}</p>
            <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              Generated condition: <span className="text-white">{guidedCondition || "Invalid threshold"}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="Condition expression, e.g. transaction_amount >= 1500 AND device_is_new = true"
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-pulse/60"
            />
            <p className="text-xs text-slate-400">
              Use variables like <code>transaction_amount</code>, <code>velocity_count</code>, <code>failed_login_count</code>, <code>geo_mismatch</code>.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Tip: start with <span className="text-slate-200">review</span> action to reduce false positive blocks.
          </p>
          <button
            type="button"
            onClick={createRule}
            disabled={
              isSubmitting ||
              !(name.trim() || selectedTemplate.defaultName) ||
              !(builderMode === "guided" ? guidedCondition.trim() : condition.trim())
            }
            className="rounded-lg bg-pulse px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Add rule"}
          </button>
        </div>

        {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-sm font-medium text-white">Quick examples</div>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-slate-200">High amount + new device</div>
            <pre className="mt-2 overflow-x-auto text-[11px] text-slate-400">
              transaction_amount &gt;= 1500 AND device_is_new = true
            </pre>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-slate-200">Failed login burst</div>
            <pre className="mt-2 overflow-x-auto text-[11px] text-slate-400">
              failed_login_count &gt;= 3 OR velocity_count &gt;= 5
            </pre>
          </div>
        </div>
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
