import Link from "next/link";
import { ApiKeyManager } from "@/components/integrations/api-key-manager";
import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getIntegrationApiKeysData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const authContext = getRequestAuthContext();
  const merchantId = authContext.merchantId ?? "";
  const keys = await getIntegrationApiKeysData(merchantId || undefined, authContext.client ?? undefined);

  return (
    <PageShell
      pathname="/integrations"
      title="Integration setup"
      subtitle="Connect your payment backend to TrustGuard APIs with merchant-scoped API keys."
    >
      <SectionCard title="Connect transaction traffic" eyebrow="Developer setup">
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Your backend should call `POST /api/transactions/analyze` before payment authorization. Use API keys for
            server-to-server calls and never expose them in browser code.
          </p>
          <p>
            Required request context: `x-api-key` and `x-merchant-id`. The API returns risk score and decision so you
            can allow, review, or block in real time.
          </p>
          <p>
            You can also use the built-in JS agent wrapper (`lib/integrations/trustguard-js-agent.ts`) to simplify
            request auth headers, retries, and timeout management.
          </p>
          <p>
            Need full endpoint contracts? Open{" "}
            <Link href="/api-docs" className="text-pulse underline">
              API documentation
            </Link>{" "}
            for role requirements, auth modes, and payload examples.
          </p>
        </div>
      </SectionCard>

      <ApiKeyManager merchantId={merchantId} initialKeys={keys} />
    </PageShell>
  );
}
