"use client";
/**
 * DateTimeField — BS-first date + time combo emitting "YYYY-MM-DDTHH:mm"
 * (the same shape <input type="datetime-local"> used, so payloads and the
 * backend stay unchanged while the UI gets the Bikram Sambat picker).
 */
import { BSDateInput } from "@/components/ui/bs-date-input";
import { TimePicker } from "@/components/ui/time-picker";
import { useI18n } from "@/lib/i18n";

interface DateTimeFieldProps {
  /** "YYYY-MM-DDTHH:mm" or "" (datetime-local shape). */
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
}

function split(v?: string): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const [d, t = ""] = v.split("T");
  return { date: d || "", time: t.slice(0, 5) };
}

export function DateTimeField({ value, onChange, name, disabled, className }: DateTimeFieldProps) {
  const { t } = useI18n();
  const { date, time } = split(value);

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) return onChange?.("");
    onChange?.(`${nextDate}T${nextTime || "00:00"}`);
  }

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <BSDateInput
        value={date}
        disabled={disabled}
        placeholder={t("Date", "मिति")}
        onChange={(d) => emit(d, time)}
        className="flex-1"
      />
      <TimePicker
        value={time}
        disabled={disabled}
        step={5}
        onChange={(tm) => emit(date, tm)}
        className="w-[128px] shrink-0"
      />
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </div>
  );
}
