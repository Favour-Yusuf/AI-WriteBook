import { cn } from "@/lib/utils";

/**
 * The Ledgerly mark: an "L" (for Ledgerly, and the corner of a ledger page)
 * holding two rising bars (a growing business).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      {/* Solid fill (no gradient id), so several logos on one page never clash. */}
      <rect width="32" height="32" rx="9" fill="oklch(0.55 0.13 165)" />
      <rect width="32" height="16" rx="9" fill="white" fillOpacity="0.07" />
      <path
        d="M10 8.5v13.25c0 .97.78 1.75 1.75 1.75H23"
        fill="none"
        stroke="white"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="14.75" y="15.5" width="2.75" height="4.75" rx="1.375" fill="white" fillOpacity="0.9" />
      <rect x="19.25" y="11" width="2.75" height="9.25" rx="1.375" fill="white" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && <span className="text-[17px] font-semibold tracking-tight text-foreground">Ledgerly</span>}
    </span>
  );
}
