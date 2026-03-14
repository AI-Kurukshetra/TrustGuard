import { DashboardMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatCard({ metric }: { metric: DashboardMetric }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-panel">
      <div className="text-sm text-slate-400">{metric.label}</div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="text-3xl font-semibold text-white">{metric.value}</div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            metric.tone === "positive"
              ? "bg-emerald-500/15 text-emerald-300"
              : metric.tone === "warning"
                ? "bg-amber-500/15 text-amber-200"
                : "bg-slate-700/70 text-slate-300"
          )}
        >
          {metric.delta}
        </div>
      </div>
    </div>
  );
}
