"use client";

import type { Route } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface SidebarLink {
  href: Route;
  label: string;
  meta: string;
  icon: string;
}

interface SidebarSection {
  heading: string;
  links: SidebarLink[];
}

const sections: SidebarSection[] = [
  {
    heading: "Workspace",
    links: [
      { href: "/", label: "Command Center", meta: "Realtime overview", icon: "CC" },
      { href: "/billing", label: "Billing", meta: "Plans & invoices", icon: "BL" },
      { href: "/scorecard", label: "Scorecard", meta: "Plan & KPI view", icon: "SC" },
      { href: "/onboarding", label: "Onboarding", meta: "First-run guide", icon: "OB" }
    ]
  },
  {
    heading: "Operations",
    links: [
      { href: "/transactions", label: "Transactions", meta: "Risk scoring queue", icon: "TX" },
      { href: "/cases", label: "Cases", meta: "Analyst workflow", icon: "CS" },
      { href: "/rules", label: "Rules", meta: "Policy controls", icon: "RL" },
      { href: "/alerts", label: "Alerts", meta: "Incident stream", icon: "AL" }
    ]
  },
  {
    heading: "Developers",
    links: [
      { href: "/integrations", label: "Integrations", meta: "API keys & setup", icon: "IN" },
      { href: "/api-docs", label: "API Docs", meta: "Integration reference", icon: "API" }
    ]
  }
];

export function Sidebar({ pathname, header }: { pathname: string; header?: ReactNode }) {
  return <SidebarNavigation pathname={pathname} header={header} />;
}

type SidebarNavigationProps = {
  pathname: string;
  header?: ReactNode;
  className?: string;
  stickyDesktop?: boolean;
  onNavigate?: () => void;
};

export function SidebarNavigation({
  pathname,
  header,
  className,
  stickyDesktop = true,
  onNavigate
}: SidebarNavigationProps) {
  return (
    <aside
      className={cn(
        "border-b border-white/10 bg-slate-950/70 backdrop-blur-xl",
        stickyDesktop && "lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-b-0 lg:border-r",
        className
      )}
    >
      <div className="flex h-full flex-col gap-8 overflow-y-auto px-5 py-6">
        <div>
          <BrandLogo
            variant="full"
            className="rounded-2xl border border-pulse/30 bg-pulse/10 px-3 py-2"
            markClassName="h-8 w-8 rounded-lg"
          />
          <h1 className="mt-4 text-2xl font-semibold text-white">Fraud Control Plane</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            AI-guided detection, analyst review, and low-latency protection for digital payments.
          </p>
        </div>

        <nav className="space-y-5">
          {sections.map((section) => (
            <div key={section.heading}>
              <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">{section.heading}</div>
              <div className="space-y-2">
                {section.links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-start gap-3 rounded-2xl border px-3 py-3 transition",
                        active
                          ? "border-pulse/55 bg-pulse/15 text-white shadow-panel"
                          : "border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg border text-[10px] font-semibold leading-none",
                          active
                            ? "border-pulse/45 bg-pulse/20 text-pulse"
                            : "border-white/10 bg-black/25 text-slate-400 group-hover:border-white/20 group-hover:text-slate-200"
                        )}
                        aria-hidden="true"
                      >
                        {link.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{link.label}</span>
                        <span className="block text-xs text-slate-400">{link.meta}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          {header}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick Access</div>
            <div className="mt-3 space-y-2">
              <Link
                href="/onboarding"
                onClick={onNavigate}
                className="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-black/30"
              >
                Setup checklist
              </Link>
              <Link
                href="/api-docs"
                onClick={onNavigate}
                className="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-black/30"
              >
                API integration docs
              </Link>
            </div>
          </div>
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
