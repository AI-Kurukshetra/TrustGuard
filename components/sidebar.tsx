import type { Route } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarLink {
  href: Route;
  label: string;
  meta: string;
}

const links: SidebarLink[] = [
  { href: "/", label: "Command Center", meta: "Realtime overview" },
  { href: "/transactions", label: "Transactions", meta: "Risk scoring queue" },
  { href: "/cases", label: "Cases", meta: "Analyst workflow" },
  { href: "/rules", label: "Rules", meta: "Policy controls" },
  { href: "/alerts", label: "Alerts", meta: "Incident stream" },
  { href: "/integrations", label: "Integrations", meta: "API keys & setup" }
];

export function Sidebar({ pathname, header }: { pathname: string; header?: ReactNode }) {
  return (
    <aside className="border-r border-white/10 bg-slate-950/65 backdrop-blur-xl">
      <div className="flex h-full flex-col gap-8 px-5 py-6">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-pulse/30 bg-pulse/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-pulse">
            TrustGuard
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Fraud Control Plane</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            AI-guided detection, analyst review, and low-latency protection for digital payments.
          </p>
        </div>

        <nav className="space-y-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block rounded-2xl border px-4 py-3 transition",
                  active
                    ? "border-pulse/50 bg-pulse/15 text-white shadow-panel"
                    : "border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                )}
              >
                <div className="font-medium">{link.label}</div>
                <div className="text-xs text-slate-400">{link.meta}</div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          {header}
          <div className="rounded-2xl border border-alarm/20 bg-alarm/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-alarm">MVP Focus</div>
            <p className="mt-2 text-sm text-slate-200">
              Payment fraud detection, device fingerprinting, velocity checks, rules, alerts, and analyst tooling.
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
