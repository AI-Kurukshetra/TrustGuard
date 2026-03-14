import { PageShell } from "@/components/page-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SectionCard } from "@/components/section-card";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getTransactionsData } from "@/lib/trustguard-data";
import { formatCurrency, formatTimestamp } from "@/lib/utils";

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
      subtitle="Review every scored payment with the signals that drove the decision, including device, geography, velocity, and historical behavior."
    >
      <SectionCard title="Scored transactions" eyebrow="Queue">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Signals</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40">
              {transactions.map((transaction) => {
                const user = users.find((item) => item.id === transaction.userId);
                return (
                  <tr key={transaction.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{transaction.id}</div>
                      <div className="text-xs text-slate-400">{formatTimestamp(transaction.createdAt)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white">{user?.email}</div>
                      <div className="text-xs text-slate-400">{transaction.location}</div>
                    </td>
                    <td className="px-4 py-4 text-white">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-4 py-4 text-slate-300">{transaction.reason}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <RiskBadge score={transaction.riskScore} />
                        <span className="capitalize text-slate-300">{transaction.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
