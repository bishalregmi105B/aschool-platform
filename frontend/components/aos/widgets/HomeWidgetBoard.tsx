"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAOSUserSettings } from "@/lib/aos-settings";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import type { AOSWidgetDefinition } from "./registry";
import {
  getWidgetsForRole,
  getWidgetDefinition,
  normalizeHomeWidgets,
} from "./registry";

/** Tailwind span classes per defaultSpan, keyed to the board's 3-col grid. */
const SPAN_CLASSES: Record<number, string> = {
  1: "",
  2: "md:col-span-2",
  3: "md:col-span-2 lg:col-span-3",
};

function EditChromeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-[var(--w11-radius-sm)] border border-[color:var(--w11-border-default)] transition-colors hover:bg-[color:var(--w11-control-hover)] disabled:opacity-40 disabled:pointer-events-none"
      style={{ color: "var(--w11-text-secondary)" }}
    >
      {children}
    </button>
  );
}

/**
 * HomeWidgetBoard — the dashboard home as a configurable widget board.
 *
 * The board order/selection lives in the per-user AOS settings
 * (home_widgets, persisted via useAOSUserSettings → PUT /auth/aos-settings;
 * empty list = role defaults). Every edit (add/remove/reorder/reset) writes
 * the full list immediately — the hook debounces the network PUT.
 *
 * Route opening: widgets render plain anchors, which the AOS WindowManager
 * intercepts (handleInternalAnchorNavigation) and converts into windows, so
 * no explicit navigation callback is needed when mounted inside a window.
 * Hosts outside a window can pass onOpenRoute.
 */
export default function HomeWidgetBoard({
  onOpenRoute,
}: {
  onOpenRoute?: (route: string) => void;
}) {
  const { user } = useAuth();
  const role = user?.role;
  const { settings, updateSettings } = useAOSUserSettings();
  const [isEditing, setIsEditing] = useState(false);

  const board = useMemo(
    () => normalizeHomeWidgets(settings.home_widgets, role),
    [settings.home_widgets, role]
  );

  const availableWidgets = useMemo(() => getWidgetsForRole(role), [role]);
  const addableWidgets = useMemo(
    () => availableWidgets.filter((widget) => !board.includes(widget.key)),
    [availableWidgets, board]
  );

  const persistBoard = (next: string[]) => {
    updateSettings({ home_widgets: next });
  };

  const removeWidget = (key: string) => persistBoard(board.filter((k) => k !== key));

  const moveWidget = (key: string, direction: -1 | 1) => {
    const index = board.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= board.length) return;
    const next = [...board];
    [next[index], next[target]] = [next[target], next[index]];
    persistBoard(next);
  };

  const addWidget = (key: string) => persistBoard([...board, key]);

  const resetBoard = () => persistBoard([]);

  return (
    <div className="flex flex-col gap-3">
      {/* Board toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
            Your Widgets
          </h2>
          <span className="text-[11px] truncate" style={{ color: "var(--w11-text-secondary)" }}>
            {isEditing
              ? "Remove, reorder or add widgets — changes save automatically."
              : `${board.length} ${board.length === 1 ? "widget" : "widgets"} on your board`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing && (
            <button
              type="button"
              className="win11-chip"
              onClick={resetBoard}
              title="Restore the default widget set for your role"
              style={{ color: "var(--w11-text-secondary)" }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </button>
          )}
          <button
            type="button"
            className={isEditing ? "win11-btn accent" : "win11-btn"}
            onClick={() => setIsEditing((prev) => !prev)}
            style={{ height: "32px", padding: "0 12px" }}
          >
            {isEditing ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Done
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit board
              </>
            )}
          </button>
        </div>
      </div>

      {/* The board grid — 1 col narrow, 2 cols medium, 3 cols wide */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {board.map((key, index) => {
          const definition = getWidgetDefinition(key);
          if (!definition) return null;
          return (
            <div
              key={key}
              className={`flex flex-col gap-1.5 ${SPAN_CLASSES[definition.defaultSpan] ?? ""}`}
            >
              {isEditing && (
                <div
                  className="flex items-center justify-between gap-2 rounded-[var(--w11-radius-sm)] border border-dashed px-2 py-1"
                  style={{ borderColor: "var(--w11-border-default)" }}
                >
                  <span
                    className="flex items-center gap-1.5 text-[11px] font-medium truncate min-w-0"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    {definition.icon}
                    {definition.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <EditChromeButton
                      label="Move up"
                      onClick={() => moveWidget(key, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </EditChromeButton>
                    <EditChromeButton
                      label="Move down"
                      onClick={() => moveWidget(key, 1)}
                      disabled={index === board.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </EditChromeButton>
                    <EditChromeButton label="Remove" onClick={() => removeWidget(key)}>
                      <X className="h-3.5 w-3.5" />
                    </EditChromeButton>
                  </div>
                </div>
              )}
              <definition.Component onOpenRoute={onOpenRoute} />
            </div>
          );
        })}
      </div>

      {/* Empty board — only reachable in edit mode (a wiped board resets to defaults) */}
      {board.length === 0 && (
        <DataPanel>
          <AOSEmptyState
            title="No widgets on your board"
            description="Add widgets from the picker below to build your dashboard."
          />
        </DataPanel>
      )}

      {/* Add-widget picker (edit mode) */}
      {isEditing && (
        <DataPanel
          title="Add widgets"
          actions={
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              {addableWidgets.length === 0
                ? "Everything available for your role is already on the board"
                : `${addableWidgets.length} available`}
            </span>
          }
        >
          {addableWidgets.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
              You&apos;ve added every widget available to your role. Remove one above to swap it
              for another.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {addableWidgets.map((widget: AOSWidgetDefinition) => (
                <button
                  key={widget.key}
                  type="button"
                  onClick={() => addWidget(widget.key)}
                  className="flex items-start gap-2.5 rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-subtle)] p-3 text-left transition-colors hover:border-[color:var(--w11-accent)] hover:bg-[color:var(--w11-accent-light)]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--w11-radius-md)]"
                    style={{ background: "var(--w11-accent-light)" }}
                  >
                    {widget.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: "var(--w11-text-primary)" }}
                    >
                      {widget.title}
                      <Plus className="h-3 w-3" style={{ color: "var(--w11-accent)" }} />
                    </span>
                    <span
                      className="block text-[11px] leading-snug"
                      style={{ color: "var(--w11-text-secondary)" }}
                    >
                      {widget.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DataPanel>
      )}
    </div>
  );
}
