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

/** A Word ribbon group: clustered controls with a bottom caption + divider. */
export function RibbonGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col shrink-0 px-2 pt-0.5 border-r border-slate-200/80 last:border-r-0", className)}>
      <div className="flex flex-1 items-start gap-0.5">{children}</div>
      <div className="text-[9px] leading-4 text-slate-400 text-center select-none">{label}</div>
    </div>
  );
}

/** Column of stacked small buttons inside a group. */
export function BtnCol({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
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

/** Small ribbon button — icon (+ optional micro label), 28px tall. */
export function RBtn({ icon, label, title, active, disabled, wide, onClick }: RBtnProps) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 rounded px-1 flex items-center justify-center gap-1 text-[11px] text-slate-700",
        "hover:bg-slate-100 active:bg-slate-200 transition-colors",
        wide ? "min-w-[44px]" : "min-w-[28px]",
        active && "bg-blue-100 text-blue-800 hover:bg-blue-150",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {icon}
      {label && <span className="truncate max-w-[72px]">{label}</span>}
    </button>
  );
}

export function VSep() {
  return <div className="w-px self-stretch my-1 bg-slate-200/80 mx-0.5" />;
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
    <div className="p-2 w-[184px]">
      <div className="grid grid-cols-8 gap-1">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={cn(
              "w-4 h-4 rounded-sm border border-slate-300 hover:scale-110 transition-transform",
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
          className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-800 hover:underline"
        >
          No color
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
      <div className="flex">
        <RBtn icon={icon} title={title} onClick={() => onPick(currentColor || colors?.[0] || "#dc2626")} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title={`${title} — more colors`} className="h-7 w-3 rounded flex items-center justify-center hover:bg-slate-100">
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-0">
            <ColorGrid onPick={onPick} colors={colors} allowNone={allowNone} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className="block w-4 h-[3px] rounded-sm" style={{ background: currentColor || "transparent" }} />
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
    <div className="writer-ribbon shrink-0 border-b border-slate-300 bg-[#f7f9fc] shadow-sm">
      {/* tab strip */}
      <div className="flex items-stretch h-8 pl-1 pr-2 bg-[#eef2f7]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); if (collapsed) onToggleCollapse(); }}
            className={cn(
              "px-4 text-xs transition-colors",
              tab === t.id && !collapsed
                ? "bg-white text-blue-800 font-medium border-t-2 border-t-blue-600 border-x border-x-slate-200 -mb-px"
                : "text-slate-600 hover:bg-slate-200/70",
              collapsed && tab === t.id && "bg-[#dbe7f5] text-blue-900",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title={collapsed ? "Pin ribbon" : "Collapse ribbon"}
          onClick={onToggleCollapse}
          className="ml-auto self-center h-5 w-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* tab content */}
      {!collapsed && (
        <div className="flex items-stretch min-h-[76px] bg-white overflow-x-auto">
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
