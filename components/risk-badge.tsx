import { cn } from "@/lib/utils";

export function RiskBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
      : score >= 60
        ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", tone)}>
      Risk {score}
    </span>
  );
}
