import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Fluent pill badge on the 11.css `win11-chip` base. Inside the `.win11`
 * scope the chip class (and its semantic modifiers) supplies the background,
 * border, radius and 12px/500 typography at higher specificity than Tailwind;
 * the mirrored arbitrary-value utilities are the fallback for surfaces
 * rendered outside the scope, so a badge is never unstyled.
 */
const badgeVariants = cva(
  "win11-chip inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "accent border-[var(--w11-accent,#0067c0)] bg-[var(--w11-accent-light,rgba(0,103,192,0.12))] text-[var(--w11-accent,#0067c0)]",
        secondary:
          "subtle border-[var(--w11-border-default,rgba(0,0,0,0.12))] bg-[var(--w11-control-hover,rgba(0,0,0,0.05))] text-[var(--w11-text-secondary,#5d5d5d)]",
        destructive:
          "error border-[#c42b1c] bg-[rgba(196,43,28,0.12)] text-[#c42b1c]",
        outline:
          "subtle border-[var(--w11-border-strong,rgba(0,0,0,0.35))] text-[var(--w11-text-primary,#1b1b1b)]",
        success:
          "success border-[#107c10] bg-[rgba(16,124,16,0.12)] text-[#107c10]",
        warning:
          "warning border-[#d83b01] bg-[rgba(216,59,1,0.12)] text-[#d83b01]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
