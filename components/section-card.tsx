import { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  action,
  children
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-panel">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <div className="text-xs uppercase tracking-[0.2em] text-pulse">{eyebrow}</div>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
