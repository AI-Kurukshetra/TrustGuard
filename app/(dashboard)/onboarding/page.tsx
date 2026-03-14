import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getIntegrationApiKeysData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const authContext = getRequestAuthContext();
  const merchantId = authContext.merchantId ?? "";
  const keys = await getIntegrationApiKeysData(merchantId || undefined, authContext.client ?? undefined);

  return (
    <PageShell
      pathname="/onboarding"
      title="First-run onboarding"
      subtitle="Follow this checklist to go from new signup to live fraud decisions in a few minutes."
    >
      <SectionCard title="Setup checklist" eyebrow="Start here">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">1. Confirm workspace</div>
            <p className="mt-2 text-sm text-slate-300">
              You are operating merchant <span className="font-mono text-xs text-white">{merchantId || "N/A"}</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">2. Create an integration API key</div>
            <p className="mt-2 text-sm text-slate-300">
              Open Integrations and generate a key for your payment backend.
            </p>
            <Link
              href="/integrations"
              className="mt-3 inline-flex rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
            >
              Go to Integrations
            </Link>
            <p className="mt-2 text-xs text-slate-400">Current keys: {keys.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">3. Send your first transaction call</div>
            <p className="mt-2 text-sm text-slate-300">
              Call <code>POST /api/transactions/analyze</code> from your backend using <code>x-api-key</code> and{" "}
              <code>x-merchant-id</code>.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
{`curl -X POST "$BASE_URL/api/transactions/analyze" \\
  -H "x-api-key: tg_live_replace_me" \\
  -H "x-merchant-id: ${merchantId || "your-merchant-id"}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":249.99,"currency":"USD","user_id":"external-123","country_code":"US"}'`}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium text-white">4. Review outcomes and tune controls</div>
            <p className="mt-2 text-sm text-slate-300">
              Track activity in Transactions/Cases/Alerts and adjust policy behavior in Rules.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/transactions"
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
              >
                Transactions
              </Link>
              <Link
                href="/cases"
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
              >
                Cases
              </Link>
              <Link
                href="/alerts"
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
              >
                Alerts
              </Link>
              <Link
                href="/rules"
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
              >
                Rules
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
