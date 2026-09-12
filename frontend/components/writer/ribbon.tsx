"use client";

/**
 * Writer v2 — Word-style ribbon chrome: primitives (grouped controls,
 * small labeled buttons, color grids) + the tabbed ribbon shell
 * (Home / Insert / Layout / Review / View) with collapse support.
 *
 * All chrome is skinned with 11.css (Win11 Fluent) tokens — var(--w11-*) —
 * so the ribbon adapts to the AOS light AND dark themes. Command buttons
 * follow the commandbar-button pattern: borderless, control-hover on hover,
 * accent-light + accent text when active.
 */
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_COLORS, HIGHLIGHT_COLORS } from "@/lib/writer/settings";
import type { WriterCtx } from "@/components/writer/context";
import { HomeTab } from "@/components/writer/tabHome";
import { InsertTab } from "@/components/writer/tabInsert";
import { LayoutTab } from "@/components/writer/tabLayout";
import { ReviewTab } from "@/components/writer/tabReview";
import { ViewTab } from "@/components/writer/tabView";

export type RibbonTabId = "home" | "insert" | "layout" | "review" | "view";

export const TABS: { id: RibbonTabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "review", label: "Review" },
  { id: "view", label: "View" },
];

/** Shared Fluent micro-transition for chrome controls. */
const FAST = {
  transition: "background var(--w11-transition-fast), color var(--w11-transition-fast), border-color var(--w11-transition-fast)",
} as const;

// ── primitives ─────────────────────────────────────────────────────────

/** A Word ribbon group: clustered controls with a bottom caption + divider. */
export function RibbonGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col shrink-0 px-2.5 pt-0.5 border-r border-[var(--w11-border-subtle)] last:border-r-0", className)}>
      <div className="flex flex-1 items-center gap-1 min-h-[50px]">{children}</div>
      <div className="text-[9px] font-semibold tracking-wider text-[var(--w11-text-tertiary)] text-center select-none pt-1 pb-0.5 uppercase">{label}</div>
    </div>
  );
}

/** Column of stacked small buttons inside a group. */
export function BtnCol({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 justify-center">{children}</div>;
}

interface RBtnProps {
  icon: React.ReactNode;
  label?: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  wide?: boolean;
  onClick?: () => void;
}

/** Small ribbon button — icon (+ optional micro label), Fluent commandbar style. */
export function RBtn({ icon, label, title, active, disabled, wide, onClick }: RBtnProps) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: "var(--w11-radius-md)",
        transition: "background var(--w11-transition-fast), color var(--w11-transition-fast)",
        ...(active ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : null),
      }}
      className={cn(
        // commandbar-button (11.css): borderless, transparent, control-hover
        "commandbar-button h-7 !min-h-0 px-2 text-xs select-none",
        wide ? "min-w-[48px]" : "min-w-[28px]",
        active && "!font-semibold",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {icon}
      {label && <span className="truncate max-w-[80px] font-medium">{label}</span>}
    </button>
  );
}

export function VSep() {
  return <div className="w-px self-stretch my-1.5 bg-[var(--w11-border-subtle)] mx-1" />;
}

/** Color palette grid used by font color / highlight split buttons. */
export function ColorGrid({
  onPick, colors = THEME_COLORS, allowNone,
}: {
  onPick: (c: string) => void;
  colors?: string[];
  allowNone?: boolean;
}) {
  return (
    <div
      className="p-2.5 w-[200px] rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-default)] shadow-[var(--w11-elevation-flyout)]"
      style={{ background: "var(--w11-surface-flyout)" }}
    >
      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={cn(
              // important resets: keep the 16px swatch compact against the
              // 11.css element-level button chrome (min-height/padding/shadow)
              "!h-4 !w-4 !min-h-0 !p-0 !shadow-none rounded-[var(--w11-radius-sm)] border border-[var(--w11-border-default)] hover:scale-110 transition-transform",
              c === "none" && "bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)]",
            )}
            style={{ background: c === "none" ? undefined : c }}
          />
        ))}
      </div>
      {allowNone && (
        <button
          type="button"
          onClick={() => onPick("none")}
          className="mt-2 w-full text-center text-[10px] font-medium text-[var(--w11-text-secondary)] hover:text-[var(--w11-text-primary)] hover:underline pt-1 border-t border-[var(--w11-border-subtle)]"
        >
          No color (transparent)
        </button>
      )}
    </div>
  );
}

/** Split button: fixed-color action + dropdown palette. */
export function ColorSplitBtn({
  icon, title, currentColor, onPick, allowNone, colors,
}: {
  icon: React.ReactNode;
  title: string;
  currentColor?: string;
  onPick: (c: string) => void;
  allowNone?: boolean;
  colors?: string[];
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <RBtn icon={icon} title={title} onClick={() => onPick(currentColor || colors?.[0] || "#dc2626")} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={`${title} — more colors`}
              className="commandbar-button !h-7 !min-h-0 w-3.5 !px-0 text-[var(--w11-text-secondary)]"
              style={{ borderRadius: "var(--w11-radius-sm)", ...FAST }}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-0 border-0 bg-transparent shadow-none">
            <ColorGrid onPick={onPick} colors={colors} allowNone={allowNone} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className="block w-4 h-[3px] rounded-full mt-0.5" style={{ background: currentColor || "transparent" }} />
    </div>
  );
}

// ── ribbon shell ───────────────────────────────────────────────────────

export function Ribbon({
  ctx, collapsed, onToggleCollapse,
}: {
  ctx: WriterCtx;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [tab, setTab] = useState<RibbonTabId>("home");

  return (
    <div
      className="writer-ribbon shrink-0 border-b border-[var(--w11-border-default)] shadow-xs"
      style={{ background: "var(--w11-surface-solid)" }}
    >
      {/* Word 365 tab strip — commandbar buttons, accent underline when active */}
      <div className="flex items-center h-9 px-2 gap-1" style={{ background: "var(--w11-window-bg)" }}>
        {TABS.map((t) => {
          const isActive = tab === t.id && !collapsed;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); if (collapsed) onToggleCollapse(); }}
              style={{
                ...FAST,
                ...(isActive ? { color: "var(--w11-accent)" } : null),
                ...(collapsed && tab === t.id ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } : null),
              }}
              className={cn(
                // commandbar-button: borderless tab, control-hover on hover
                "commandbar-button relative h-[32px] !min-h-0 px-3.5 text-xs font-medium select-none",
                "after:content-[''] after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[2.5px] after:rounded-t-[2px] after:bg-transparent",
                isActive && "!font-semibold after:bg-[var(--w11-accent)]",
                !isActive && "text-[var(--w11-text-secondary)] hover:!text-[var(--w11-text-primary)]",
              )}
            >
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          title={collapsed ? "Pin ribbon (expand)" : "Collapse ribbon"}
          onClick={onToggleCollapse}
          className="commandbar-button ml-auto self-center !h-6 !min-h-0 w-6 text-[var(--w11-text-secondary)]"
          style={{ borderRadius: "var(--w11-radius-sm)", ...FAST }}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Ribbon tab content — Fluent control surface */}
      {!collapsed && (
        <div
          className="flex items-stretch min-h-[82px] border-t border-[var(--w11-border-subtle)] overflow-x-auto custom-scrollbar px-1 py-1"
          style={{ background: "var(--w11-surface-solid)" }}
        >
          {tab === "home" && <HomeTab ctx={ctx} />}
          {tab === "insert" && <InsertTab ctx={ctx} />}
          {tab === "layout" && <LayoutTab ctx={ctx} />}
          {tab === "review" && <ReviewTab ctx={ctx} />}
          {tab === "view" && <ViewTab ctx={ctx} />}
        </div>
      )}
    </div>
  );
}

export { Button };
