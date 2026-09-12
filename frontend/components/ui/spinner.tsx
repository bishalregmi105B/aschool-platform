import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Fluent ring spinner. Inside the `.win11` scope the `win11-spinner` class
 * paints the ring (accent top arc over `--w11-border-default`, sizes
 * 16/28/48px) and spins it with the w11-spin keyframes. Outside the scope —
 * plain pages, auth screens — the mirrored Tailwind utilities keep a ring
 * visible, with `currentColor` as the accent fallback.
 */
const sizeMap = {
  sm: "sm h-4 w-4 border-2",
  md: "h-7 w-7 border-[3px]",
  lg: "lg h-12 w-12 border-4",
} as const;

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <div
      className={cn(
        "win11-spinner inline-block animate-spin rounded-full border-solid border-[var(--w11-border-default,transparent)] border-t-[var(--w11-accent,currentColor)]",
        sizeMap[size],
        className
      )}
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <span className="text-[13px] text-[var(--w11-text-secondary,#5d5d5d)]">{label}</span>
    </div>
  );
}
