import { cn } from "@/lib/utils";

type BrandLogoVariant = "full" | "compact" | "mark";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  markClassName?: string;
};

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-pulse/45 bg-gradient-to-br from-pulse/35 via-slate-900 to-ink shadow-[0_0_0_1px_rgba(8,182,217,0.25),0_8px_28px_rgba(8,182,217,0.18)]",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M12 2.5 18 4.7v5.9c0 5.3-3.5 9.3-6 10.9-2.5-1.6-6-5.6-6-10.9V4.7z" fill="rgba(8,182,217,0.18)" />
        <path
          d="m7.8 12 2.6 2.7L16.2 9"
          fill="none"
          stroke="rgba(125,241,255,0.95)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-slate-950 bg-alarm" />
    </span>
  );
}

export function BrandLogo({ variant = "full", className, markClassName }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <div className={cn("inline-flex", className)} aria-label="TrustGuard logo">
        <BrandMark className={markClassName} />
      </div>
    );
  }

  const isCompact = variant === "compact";

  return (
    <div className={cn("inline-flex items-center gap-3", className)} aria-label="TrustGuard">
      <BrandMark className={cn(isCompact ? "h-8 w-8 rounded-lg" : "", markClassName)} />
      <div>
        <div className={cn("font-semibold leading-none text-white", isCompact ? "text-sm" : "text-base")}>TrustGuard</div>
        <div className={cn("mt-1 uppercase text-slate-400", isCompact ? "text-[9px] tracking-[0.2em]" : "text-[10px] tracking-[0.24em]")}>
          {isCompact ? "Fraud Defense" : "Fraud Control Plane"}
        </div>
      </div>
    </div>
  );
}
