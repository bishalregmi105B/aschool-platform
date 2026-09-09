"use client";
/**
 * ServerClock — live time from the backend clock (+ BS date beside it).
 * One subscription (useServerTime) shared across every mounted consumer.
 */
import { useServerTime } from "@/lib/use-server-time";
import { useI18n } from "@/lib/i18n";
import { adToBS, BS_MONTHS, BS_MONTHS_NE, formatBSDate } from "@/lib/nepali_date";
import { Clock } from "lucide-react";

export function ServerClock({ className = "" }: { className?: string }) {
  const time = useServerTime();
  const { lang, t } = useI18n();

  if (!time) {
    // Reserve the slot so the header doesn't shift when the clock arrives.
    return (
      <div className={`hidden md:flex items-center h-8 w-[168px] shrink-0 ${className}`} aria-hidden />
    );
  }

  const d = new Date(time.epochMs);
  const hhmm = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const bs = adToBS(time.dateAD);
  const bsLabel = formatBSDate(bs, lang === "ne" ? "ne" : "en");
  void BS_MONTHS;
  void BS_MONTHS_NE;

  return (
    <div
      className={`hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md bg-muted/60 border text-[11px] leading-tight ${className}`}
      title={t("Server time (NPT)", "सर्भर समय (नेपाली समय)")}
    >
      <Clock className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
      <span className="font-semibold tabular-nums text-foreground">{hhmm}</span>
      <span className="text-muted-foreground tabular-nums">{bsLabel}</span>
    </div>
  );
}
