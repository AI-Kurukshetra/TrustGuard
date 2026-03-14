"use client";

import { useMemo, useState } from "react";
import type { IntegrationApiKey } from "@/lib/trustguard-data";

type ApiKeyManagerProps = {
  merchantId: string;
  initialKeys: IntegrationApiKey[];
};

type KeyRole = "admin" | "analyst" | "viewer";

type CreateKeyResponse = {
  api_key: string;
  data: IntegrationApiKey;
};

export function ApiKeyManager({ merchantId, initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("Primary backend");
  const [role, setRole] = useState<KeyRole>("analyst");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleKey = lastCreatedKey ?? "tg_live_replace_me";
  const curlExample = useMemo(
    () =>
      `curl -X POST "$BASE_URL/api/transactions/analyze" \\\n+  -H "x-api-key: ${sampleKey}" \\\n+  -H "x-merchant-id: ${merchantId}" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"amount":249.99,"currency":"USD","user_id":"external-123","country_code":"US"}'`,
    [merchantId, sampleKey]
  );

  async function createKey() {
    setIsSubmitting(true);
    setError(null);

    const parsedExpires = Number(expiresInDays);
    const payload = {
      name,
      role,
      expires_in_days: Number.isFinite(parsedExpires) && parsedExpires > 0 ? parsedExpires : undefined
    };

    try {
      const response = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => null)) as { error?: string } & Partial<CreateKeyResponse>;

      if (!response.ok || !body.data || !body.api_key) {
        setError(body?.error ?? "Failed to create API key.");
        setIsSubmitting(false);
        return;
      }

      setKeys((current) => [body.data as IntegrationApiKey, ...current]);
      setLastCreatedKey(body.api_key);
    } catch {
      setError("Network error while creating API key.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function revokeKey(id: string) {
    setError(null);
    const response = await fetch(`/api/integrations/keys/${id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "Failed to revoke API key.");
      return;
    }

    setKeys((current) =>
      current.map((item) =>
        item.id === id ? { ...item, active: false, revokedAt: new Date().toISOString() } : item
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Merchant ID</div>
        <div className="mt-2 break-all font-mono text-xs text-white">{merchantId}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-semibold text-white">Create API key</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
            placeholder="Key name"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as KeyRole)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
          >
            <option value="viewer">viewer</option>
            <option value="analyst">analyst</option>
            <option value="admin">admin</option>
          </select>
          <input
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
            placeholder="Expires in days (optional)"
          />
        </div>
        {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}
        <button
          type="button"
          onClick={createKey}
          disabled={isSubmitting || name.trim() === ""}
          className="mt-4 rounded-xl bg-pulse px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating..." : "Create key"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-semibold text-white">Integration request example</h3>
        <p className="mt-2 text-sm text-slate-300">
          Use this from your payment backend. Keep API keys server-side only.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
          {curlExample}
        </pre>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-semibold text-white">API keys</h3>
        <div className="mt-3 space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-slate-400">No API keys yet.</p>
          ) : (
            keys.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="mt-1 font-mono text-xs text-slate-300">{item.maskedKey}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    role={item.role} | last_used={item.lastUsedAt ?? "never"} | expires={item.expiresAt ?? "none"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => revokeKey(item.id)}
                  disabled={!item.active}
                  className="rounded-lg border border-alarm/40 bg-alarm/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-alarm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.active ? "Revoke" : "Revoked"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
