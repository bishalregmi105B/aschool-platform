"use client";

/**
 * Writer v2 — Word-style ribbon chrome: primitives (grouped controls,
 * small labeled buttons, color grids) + the tabbed ribbon shell
 * (Home / Insert / Layout / Review / View) with collapse support.
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

// ── primitives ─────────────────────────────────────────────────────────

// ── primitives ─────────────────────────────────────────────────────────

/** A Word ribbon group: clustered controls with a bottom caption + divider. */
export function RibbonGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col shrink-0 px-2.5 pt-0.5 border-r border-slate-200/70 dark:border-slate-800 last:border-r-0", className)}>
      <div className="flex flex-1 items-center gap-1 min-h-[50px]">{children}</div>
      <div className="text-[9px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 text-center select-none pt-1 pb-0.5 uppercase">{label}</div>
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

/** Small ribbon button — icon (+ optional micro label), Word 365 style. */
export function RBtn({ icon, label, title, active, disabled, wide, onClick }: RBtnProps) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 rounded-lg px-2 flex items-center justify-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 select-none",
        "hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200/80 dark:active:bg-slate-700 transition-all duration-150",
        wide ? "min-w-[48px]" : "min-w-[28px]",
        active && "bg-blue-50 dark:bg-blue-950/80 text-[#0078d4] dark:text-[#38bdf8] font-semibold border border-blue-200 dark:border-blue-900 shadow-xs",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {icon}
      {label && <span className="truncate max-w-[80px] font-medium">{label}</span>}
    </button>
  );
}

export function VSep() {
  return <div className="w-px self-stretch my-1.5 bg-slate-200 dark:bg-slate-800 mx-1" />;
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
    <div className="p-2.5 w-[200px] bg-popover rounded-xl border border-border shadow-md">
      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={cn(
              "w-4 h-4 rounded-md border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform shadow-xs",
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
          className="mt-2 w-full text-center text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline pt-1 border-t border-border/50"
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
            <button type="button" title={`${title} — more colors`} className="h-7 w-3.5 rounded-r-md flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
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
    <div className="writer-ribbon shrink-0 border-b border-slate-200 dark:border-slate-800 bg-[#f0f4f9] dark:bg-slate-900 shadow-xs">
      {/* Word 365 tab strip */}
      <div className="flex items-center h-9 px-2 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); if (collapsed) onToggleCollapse(); }}
            className={cn(
              "word-ribbon-tab",
              tab === t.id && !collapsed && "active",
              collapsed && tab === t.id && "bg-[#dbe7f5] dark:bg-slate-800 text-[#0078d4] dark:text-[#38bdf8]",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title={collapsed ? "Pin ribbon (expand)" : "Collapse ribbon"}
          onClick={onToggleCollapse}
          className="ml-auto self-center h-6 w-6 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Ribbon tab content — Word 365 canvas */}
      {!collapsed && (
        <div className="flex items-stretch min-h-[82px] bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800 overflow-x-auto custom-scrollbar px-1 py-1">
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
