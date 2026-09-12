"use client";
/**
 * LanguageToggle — EN ⇄ नेपाली segmented control for AOS TopMenuBar.
 * Persists to `preferred_language` key in localStorage and re-renders i18n context.
 */
import React from "react";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "22px",
        borderRadius: "12px",
        background: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: "1px 2px",
        gap: "2px",
      }}
      role="group"
      aria-label="Language / भाषा"
    >
      <Languages size={11} style={{ margin: "0 3px", opacity: 0.7 }} aria-hidden />
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
          onClick={(e) => {
            e.stopPropagation();
            setLang(opt.code);
          }}
          style={{
            height: "18px",
            padding: "0 6px",
            borderRadius: "10px",
            fontSize: "10px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: lang === opt.code ? "rgba(255, 255, 255, 0.25)" : "transparent",
            color: lang === opt.code ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
            transition: "all 0.15s ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
