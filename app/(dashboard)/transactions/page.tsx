import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { TransactionsManager } from "@/components/transactions/transactions-manager";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getTransactionsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const authContext = getRequestAuthContext();
  const { transactions, users } = await getTransactionsData(
    authContext.merchantId ?? undefined,
    authContext.client ?? undefined
  );

  return (
    <PageShell
      pathname="/transactions"
      title="Transaction analysis"
      subtitle="Review every scored payment, apply clear triage actions (approve/review/block), and keep the queue focused on highest-risk decisions first."
    >
      <SectionCard title="Scored transactions" eyebrow="Queue">
        <TransactionsManager initialTransactions={transactions} users={users} />
      </SectionCard>
    </PageShell>
  );
}
