"use client";
/**
 * LanguageToggle — EN ⇄ नेपाली segmented control for the header.
 * Persists to the same `preferred_language` key the sidebar and plugin
 * labels already read, so the whole shell flips instantly.
 */
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={cn(
        "flex items-center h-8 rounded-md border bg-muted/60 p-0.5 gap-0.5",
        className
      )}
      role="group"
      aria-label="Language / भाषा"
    >
      <Languages className="h-3 w-3 mx-1.5 text-muted-foreground" aria-hidden />
      {(
        [
          { code: "en", label: "EN", title: "English" },
          { code: "ne", label: "ने", title: "नेपाली" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.code}
          type="button"
          title={opt.title}
          aria-pressed={lang === opt.code}
          onClick={() => setLang(opt.code)}
          className={cn(
            "h-7 px-2 rounded text-[11px] font-semibold transition-colors",
            lang === opt.code
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
