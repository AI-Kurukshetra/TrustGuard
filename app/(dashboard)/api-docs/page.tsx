import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  API_AUTH_GUIDE,
  API_METHOD_REFERENCES,
  API_REFERENCE_GROUPS,
  type ApiAuthMode,
  type ApiRoleRequirement,
  type HttpMethod
} from "@/lib/api-reference";

export const metadata: Metadata = {
  title: "TrustGuard API Docs",
  description: "In-product API documentation for TrustGuard integration and endpoint contracts."
};

export const dynamic = "force-dynamic";

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  POST: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  PATCH: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  DELETE: "border-rose-400/40 bg-rose-500/10 text-rose-200"
};

function formatRole(role: ApiRoleRequirement) {
  if (role === "public") {
    return "public";
  }
  return role;
}

function formatAuth(auth: ApiAuthMode) {
  if (auth === "public") {
    return "public";
  }
  if (auth === "operator_session") {
    return "operator session";
  }
  return "operator session or API key";
}

export default function ApiDocsPage() {
  const authContext = getRequestAuthContext();
  const merchantId = authContext.merchantId ?? "your-merchant-id";

  const quickstartCurl = `curl -X POST "$BASE_URL/api/transactions/analyze" \\
  -H "x-api-key: tg_live_replace_me" \\
  -H "x-merchant-id: ${merchantId}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":249.99,"currency":"USD","user_id":"external-123","country_code":"US"}'`;

  const jsAgentExample = `import { TrustGuardJsAgent } from "@/lib/integrations/trustguard-js-agent";

const trustguard = new TrustGuardJsAgent({
  baseUrl: process.env.TRUSTGUARD_BASE_URL!,
  apiKey: process.env.TRUSTGUARD_API_KEY!,
  merchantId: "${merchantId}"
});

const result = await trustguard.scorePayment({
  transaction: {
    amount: 249.99,
    currency: "USD",
    user_id: "external-123",
    country_code: "US"
  }
});

if (result.analysis.decision === "block") {
  // deny authorization
}`;

  return (
    <PageShell
      pathname="/api-docs"
      title="API documentation"
      subtitle="Use this reference to integrate TrustGuard quickly and keep implementations aligned with live endpoints."
    >
      <SectionCard title="Quickstart" eyebrow="Integration flow">
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            1) Create an API key in <Link href="/integrations" className="text-pulse underline">Integrations</Link>.
            2) Send device and transaction traffic from your backend. 3) Handle decisions (`approve`, `review`,
            `block`) in your payment flow.
          </p>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
            {quickstartCurl}
          </pre>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
            {jsAgentExample}
          </pre>
          <p className="text-xs text-slate-400">
            Live documented method-path pairs: {API_METHOD_REFERENCES.length}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Auth guide" eyebrow="Request context">
        <div className="grid gap-3 md:grid-cols-3">
          {API_AUTH_GUIDE.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-xs text-slate-400">{item.appliesTo}</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                {item.headers.map((header) => (
                  <li key={header} className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono">
                    {header}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-400">{item.note}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      {API_REFERENCE_GROUPS.map((group) => {
        const entries = API_METHOD_REFERENCES.filter((entry) => entry.groupId === group.id);

        return (
          <SectionCard key={group.id} title={group.title} eyebrow="Endpoint reference">
            <p className="mb-4 text-sm text-slate-300">{group.description}</p>
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={`${entry.method}-${entry.path}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-2 py-1 text-xs font-semibold ${METHOD_CLASS[entry.method]}`}>
                      {entry.method}
                    </span>
                    <code className="rounded border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-200">
                      {entry.path}
                    </code>
                    <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                      role: {formatRole(entry.role)}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                      auth: {formatAuth(entry.auth)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{entry.summary}</p>
                  {entry.notes && entry.notes.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
                      {entry.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.requestExample ? (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Request</div>
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
                        {JSON.stringify(entry.requestExample, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {entry.responseExample ? (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Response</div>
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
                        {JSON.stringify(entry.responseExample, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </PageShell>
  );
}

