import { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer";
import { Sidebar } from "@/components/sidebar";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export async function PageShell({
  pathname,
  title,
  subtitle,
  children
}: {
  pathname: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const authContext = getRequestAuthContext();
  let companyName: string | null = null;
  if (authContext.client && authContext.merchantId) {
    const { data: merchant } = await authContext.client
      .from("merchants")
      .select("name")
      .eq("id", authContext.merchantId)
      .maybeSingle();
    companyName = merchant?.name ?? null;
  }

  const sidebarHeader = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Coverage</div>
      <div className="mt-2 text-sm text-white">Web transactions</div>
      <div className="text-sm text-slate-400">Fintech and e-commerce workflows</div>
    </div>
  );

  return (
    <div className="dashboard-grid min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">
        <Sidebar pathname={pathname} header={sidebarHeader} companyName={companyName} />
      </div>
      <main className="px-5 py-6 md:px-8 md:py-8">
        <MobileSidebarDrawer pathname={pathname} companyName={companyName} />
        <header className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-gradient-to-r from-pulse/15 via-white/[0.04] to-alarm/10 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <BrandLogo variant="compact" className="rounded-xl border border-pulse/25 bg-pulse/10 px-3 py-2" />
            <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
          </div>
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Decisions</div>
              <div className="mt-1 text-white">Explainable outcomes</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Actions</div>
              <div className="mt-1 text-white">Approve, review, block</div>
            </div>
          </div>
        </header>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
