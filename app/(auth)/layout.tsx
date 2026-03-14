import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10 md:px-8">
      <div className="grid w-full gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section className="space-y-5">
          <BrandLogo
            variant="full"
            className="rounded-2xl border border-pulse/25 bg-pulse/10 px-3 py-2"
            markClassName="h-8 w-8 rounded-lg"
          />
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Fraud Detection & Prevention</div>
          <h2 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
            Protect payments in real time with AI scoring and analyst workflows.
          </h2>
          <p className="max-w-xl text-base text-slate-300">
            TrustGuard combines transaction risk scoring, device intelligence, and case management in one control
            plane for fintech and e-commerce teams.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</div>
              <div className="mt-2 text-sm text-white">Realtime transaction risk</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Decide</div>
              <div className="mt-2 text-sm text-white">Allow, review, or block</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Investigate</div>
              <div className="mt-2 text-sm text-white">Alerts and fraud cases</div>
            </div>
          </div>
        </section>
        <section>{children}</section>
      </div>
    </main>
  );
}
