import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatusPill — ONE status vocabulary for the whole product.
 *
 * Before this existed, "paid" was a green Badge on the fees page, a green dot in
 * the receipts table, and the literal string "PAID" in the collections export.
 * Every status string in the app now maps to a tone here, so a colour means the
 * same thing on every screen: green = settled/present/approved, red =
 * failed/absent/rejected, amber = needs attention, blue = in progress, grey =
 * inert.
 */

export type StatusTone =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "muted"
  | "primary";

/**
 * Tone → 11.css chip modifier (+ mirrored arbitrary-value fallbacks for
 * surfaces outside the `.win11` scope). The scoped `win11-chip` class paints
 * the pill; the semantic text color also feeds the leading dot via
 * `bg-current`, so dot and label always agree.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "success border-[#107c10] bg-[rgba(16,124,16,0.12)] text-[#107c10]",
  danger:
    "error border-[#c42b1c] bg-[rgba(196,43,28,0.12)] text-[#c42b1c]",
  warning:
    "warning border-[#d83b01] bg-[rgba(216,59,1,0.12)] text-[#d83b01]",
  info: "accent border-[var(--w11-accent,#0067c0)] bg-[var(--w11-accent-light,rgba(0,103,192,0.12))] text-[var(--w11-accent,#0067c0)]",
  muted:
    "subtle border-[var(--w11-border-default,rgba(0,0,0,0.12))] bg-[var(--w11-control-hover,rgba(0,0,0,0.05))] text-[var(--w11-text-secondary,#5d5d5d)]",
  primary:
    "accent border-[var(--w11-accent,#0067c0)] bg-[var(--w11-accent-light,rgba(0,103,192,0.12))] text-[var(--w11-accent,#0067c0)]",
};

/**
 * Status string → tone. Keys are lowercase; unknown values fall back to `muted`,
 * which is the honest answer for a status we have no opinion about.
 */
export const STATUS_TONES: Record<string, StatusTone> = {
  // Attendance
  present: "success",
  absent: "danger",
  late: "warning",
  half_day: "warning",
  leave: "muted",
  excused: "muted",
  not_marked: "muted",
  // Payments / fees
  paid: "success",
  partial: "warning",
  pending: "warning",
  unpaid: "danger",
  overdue: "danger",
  refunded: "info",
  failed: "danger",
  waived: "muted",
  // Approvals
  approved: "success",
  rejected: "danger",
  submitted: "info",
  under_review: "info",
  withdrawn: "muted",
  // Lifecycle
  active: "success",
  inactive: "muted",
  draft: "muted",
  published: "primary",
  scheduled: "info",
  ongoing: "warning",
  completed: "success",
  cancelled: "muted",
  expired: "danger",
  archived: "muted",
  // Students / staff
  enrolled: "success",
  graduated: "primary",
  transferred: "info",
  suspended: "danger",
  on_leave: "warning",
  // Plugins / installs
  not_installed: "muted",
  trial: "info",
  // Delivery (SMS/push)
  sent: "success",
  queued: "info",
  delivered: "success",
  undelivered: "danger",
  bounced: "danger",
  // Exams
  pass: "success",
  fail: "danger",
  absent_exam: "muted",
  // Severity
  low: "muted",
  medium: "warning",
  high: "danger",
  critical: "danger",
  resolved: "success",
  open: "warning",
};

/** Nepali labels for the statuses users see daily. */
export const STATUS_LABELS_NE: Record<string, string> = {
  present: "उपस्थित",
  absent: "अनुपस्थित",
  late: "ढिलो",
  half_day: "आधा दिन",
  leave: "बिदा",
  paid: "भुक्तानी भयो",
  partial: "आंशिक",
  pending: "बाँकी",
  unpaid: "अभुक्तानी",
  overdue: "म्याद नाघेको",
  approved: "स्वीकृत",
  rejected: "अस्वीकृत",
  active: "सक्रिय",
  inactive: "निष्क्रिय",
  draft: "मस्यौदा",
  published: "प्रकाशित",
  completed: "सम्पन्न",
  pass: "उत्तीर्ण",
  fail: "अनुत्तीर्ण",
};

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "muted";
  return STATUS_TONES[String(status).toLowerCase().replace(/[\s-]+/g, "_")] ?? "muted";
}

/** "half_day" → "Half day". Titles a raw enum without a lookup table. */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const cleaned = String(status).replace(/[_-]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string | null | undefined;
  /** Override the derived tone (rare; prefer adding to STATUS_TONES). */
  tone?: StatusTone;
  /** Override the derived label. */
  label?: string;
  /** Show the Nepali label when the user reads Nepali. */
  language?: string;
  /** Leading dot, for dense tables where colour alone is too subtle. */
  dot?: boolean;
  size?: "sm" | "md";
}

function StatusPill({
  status,
  tone,
  label,
  language,
  dot = false,
  size = "sm",
  className,
  ...props
}: StatusPillProps) {
  const resolvedTone = tone ?? statusTone(status);
  const key = String(status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const resolvedLabel =
    label ??
    (language === "ne" && STATUS_LABELS_NE[key]) ??
    humanizeStatus(status);

  return (
    <span
      className={cn(
        "win11-chip inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE_CLASSES[resolvedTone],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      {resolvedLabel}
    </span>
  );
}

export { StatusPill };
