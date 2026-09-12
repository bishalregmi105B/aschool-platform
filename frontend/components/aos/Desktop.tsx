"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  Trash2,
  FolderPlus,
  RefreshCw,
  Monitor,
  Palette,
  Eye,
  ArrowUpDown,
  MoreHorizontal,
  Folder,
  FolderOpen,
  FolderMinus,
  PenLine,
  ListPlus,
  ChevronRight,
  Plus,
  AppWindow,
  LayoutGrid,
  GripHorizontal,
  X,
  Check,
} from "lucide-react";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule, SECTION_GRADIENTS, type AOSApp } from "@/lib/aos-app-adapter";
import { useAOSNavigate } from "@/lib/aos-window-route";
import { useAOSUserSettings } from "@/lib/aos-settings";
import {
  getWidgetDefinition,
  normalizeHomeWidgets,
  getAvailableWidgets,
  defaultWidgetSize,
  nextWidgetSize,
  WIDGET_SIZE_WIDTHS,
  type AOSWidgetDefinition,
  type AOSWidgetSize,
} from "@/components/aos/widgets/registry";
import {
  createFolderId,
  generateUniqueFolderName,
  validateFolderName,
  parseDesktopLayout,
  FOLDER_NAME_MAX_LENGTH,
  type AOSDesktopFolder,
  type AOSDesktopIconPosition,
  type AOSDesktopLayout,
  type ResolvedAOSDesktopFolder,
} from "@/lib/aos-launcher";

interface DesktopProps {
  onOpenApp: (appId: string) => void;
  wallpaper: string;
  themeMode: "light" | "dark";
  brightness: number;
  currentRole?: string;
  showTopBar?: boolean;
  apps?: AOSApp[];
  /**
   * Resolved folder layout (folder -> live apps). When undefined the classic
   * folder-less desktop is rendered (backward compatibility).
   */
  folders?: ResolvedAOSDesktopFolder[];
  /** Persist the next folder list (called only on explicit user edits). */
  onUpdateFolders?: (folders: AOSDesktopFolder[]) => void;
  /**
   * Raw persisted desktop_layout (settings.desktop_layout) — icon grid
   * positions + widget sizes/order. Passed through parseDesktopLayout.
   */
  layout?: Record<string, unknown>;
  /** Persist the next desktop layout (icon positions + widget arrangement). */
  onUpdateLayout?: (layout: Record<string, unknown>) => void;
  children?: React.ReactNode;
}

type ContextMenuTarget =
  | { kind: "desktop" }
  | { kind: "folder"; folderId: string }
  | { kind: "app"; appId: string };

interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

type FolderDialog =
  | { type: "rename"; folderId: string; name: string }
  | { type: "remove"; folderId: string }
  | { type: "addApps"; folderId: string; selected: string[] }
  | { type: "newFolder"; appId: string; name: string };

const CONTEXT_MENU_WIDTH = 240;

// ── Icon canvas geometry ────────────────────────────────────────────────────
/** Snap grid: one cell = 92px tile + 4px gap. */
const GRID_STEP = 96;
const TILE_SIZE = 92;
/** Left margin of the icon canvas. */
const CANVAS_LEFT = 16;
/** Vertical margin below the menubar. */
const CANVAS_TOP_WITH_BAR = 50;
const CANVAS_TOP_WITHOUT_BAR = 16;
/** Space reserved at the bottom for the dock. */
const DOCK_RESERVE = 100;
/** Right edge kept clear when the widget column is visible (column + margin). */
const WIDGET_COLUMN_RESERVE = 336;
/** Pointer travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

/** Acrylic flyout surface shared by the context menu, submenus and folder popup. */
const acrylicSurfaceStyle: React.CSSProperties = {
  background: "var(--w11-surface-flyout, rgba(32, 32, 32, 0.85))",
  backdropFilter: "blur(30px) saturate(180%)",
  WebkitBackdropFilter: "blur(30px) saturate(180%)",
  border: "1px solid var(--w11-acrylic-border, rgba(255, 255, 255, 0.12))",
  boxShadow: "0 14px 35px rgba(0, 0, 0, 0.3)",
  color: "var(--w11-text-primary, #ffffff)",
};

/**
 * Folder-dialog text input. Sizing only — borders, control background and the
 * Fluent accent focus underline come from the element-level input styles, so
 * they must not be overridden inline.
 */
const dialogInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: "13px",
  boxSizing: "border-box",
};

function MenuDivider() {
  return (
    <div
      style={{
        height: "1px",
        background: "var(--w11-border-subtle, rgba(255,255,255,0.08))",
        margin: "4px 0",
      }}
    />
  );
}

function DesktopMenuItem({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 10px",
        borderRadius: "var(--w11-radius-sm)",
        cursor: "pointer",
        color: danger ? "#c42b1c" : "inherit",
        userSelect: "none",
        transition: "background var(--w11-transition-fast)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor =
          "var(--w11-control-hover, rgba(255,255,255,0.08))")
      }
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <span style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {trailing}
    </div>
  );
}

/** macOS-style stack tile: rounded gradient square with a folder glyph. */
function FolderTile({ name, size = 44 }: { name: string; size?: number }) {
  const sectionGradient = SECTION_GRADIENTS[name];
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size >= 52 ? "14px" : Math.max(6, Math.round(size * 0.22)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        // Solid accent fallback first so browsers without color-mix() degrade
        // to a flat accent tile instead of a transparent one.
        background: sectionGradient || "var(--w11-accent, #0078d4)",
        backgroundImage:
          sectionGradient ||
          "linear-gradient(135deg, var(--w11-accent, #0078d4) 0%, color-mix(in srgb, var(--w11-accent, #0078d4) 55%, #001a3a) 100%)",
        boxShadow:
          "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
      }}
    >
      <Folder
        size={Math.max(13, Math.round(size * 0.55))}
        strokeWidth={2.2}
        fill="rgba(255,255,255,0.18)"
      />
    </div>
  );
}

/** Shared chrome for desktop icons (app + folder + recycle bin). */
function DesktopIconTile({
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  icon,
  label,
  dragging,
  style,
}: {
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  icon: React.ReactNode;
  label: string;
  dragging?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: `${TILE_SIZE}px`,
        padding: "8px 4px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderRadius: "var(--w11-radius-lg)",
        cursor: "pointer",
        border: selected
          ? "1px solid rgba(255, 255, 255, 0.4)"
          : "1px solid transparent",
        background: selected ? "rgba(255, 255, 255, 0.22)" : "transparent",
        backdropFilter: selected ? "blur(12px)" : "none",
        transition: dragging ? "none" : "transform var(--w11-transition-fast)",
        touchAction: "none",
        ...(dragging
          ? {
              zIndex: 1000,
              boxShadow: "0 18px 38px rgba(0, 0, 0, 0.45)",
              background: "rgba(255, 255, 255, 0.28)",
              backdropFilter: "blur(12px)",
            }
          : {}),
        ...style,
      }}
      className="win11-desktop-icon"
    >
      <div style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.45))" }}>{icon}</div>
      <span
        style={{
          marginTop: "5px",
          fontSize: "11px",
          fontWeight: 500,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)",
          lineHeight: 1.2,
          wordBreak: "break-word",
          maxWidth: `${TILE_SIZE - 8}px`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** localStorage key persisting desktop-widget column visibility. */
const WIDGETS_VISIBLE_KEY = "aos-desktop-widgets-visible";
/** Wide-screen breakpoint: widgets default ON at/above this width. */
const WIDGETS_DEFAULT_MIN_WIDTH = 1200;

// ── Widget column helpers ───────────────────────────────────────────────────

/** Size label for the resize cycle button. */
const SIZE_LABELS: Record<AOSWidgetSize, string> = { s: "S", m: "M", l: "L" };

interface WidgetColumnProps {
  role: string;
  /** Installed plugin slugs (installed plugins ∪ sidebar-visible plugins). */
  installedSlugs: string[];
  /** CSS top offset (below the menubar + toggle button). */
  top: string;
  /** Persisted widget arrangement (sizes + order). */
  widgetLayout: AOSDesktopLayout["widgetLayout"];
  /** Commit the next widget arrangement (icon positions are preserved by the host). */
  onUpdateWidgetLayout: (widgetLayout: AOSDesktopLayout["widgetLayout"]) => void;
}

/**
 * macOS-style desktop widget column — the user's home_widgets board
 * (same list as the dashboard board → single config) rendered compact
 * along the right edge of the desktop. Widgets come from the registry so
 * role + plugin gating matches the board exactly; each fetches its own
 * data. Each widget can be reordered (drag handle), resized (S/M/L) or
 * removed (X); the arrangement persists in desktop_layout.widgetLayout.
 */
function DesktopWidgetColumn({
  role,
  installedSlugs,
  top,
  widgetLayout,
  onUpdateWidgetLayout,
}: WidgetColumnProps) {
  const navigate = useAOSNavigate();
  const { settings, updateSettings } = useAOSUserSettings();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Pointer reorder state: the dragged key + the insertion index among the
  // other widgets (a placeholder line renders at that gap).
  const [reorder, setReorder] = useState<{ key: string; overIndex: number } | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  const board = useMemo(
    () => normalizeHomeWidgets(settings.home_widgets, role, installedSlugs),
    [settings.home_widgets, role, installedSlugs]
  );

  const availableWidgets = useMemo(
    () => getAvailableWidgets({ role, installedSlugs }),
    [role, installedSlugs]
  );

  const sizeFor = useCallback(
    (key: string, definition: AOSWidgetDefinition): AOSWidgetSize =>
      widgetLayout[key]?.size ?? defaultWidgetSize(definition),
    [widgetLayout]
  );

  // Column order: explicit widgetLayout orders win; widgets without one keep
  // their board (home_widgets) order underneath the customized ones.
  const orderedBoard = useMemo(() => {
    const indexed = board.map((key, index) => ({ key, index }));
    indexed.sort((a, b) => {
      const oa = widgetLayout[a.key]?.order;
      const ob = widgetLayout[b.key]?.order;
      const ra = oa ?? a.index + 10000;
      const rb = ob ?? b.index + 10000;
      return ra - rb;
    });
    return indexed.map((entry) => entry.key);
  }, [board, widgetLayout]);

  const commitWidgetLayout = useCallback(
    (nextWidgetLayout: AOSDesktopLayout["widgetLayout"]) => {
      onUpdateWidgetLayout(nextWidgetLayout);
    },
    [onUpdateWidgetLayout]
  );

  const setWidgetSize = (key: string, size: AOSWidgetSize) => {
    const next = { ...widgetLayout };
    const existing = next[key];
    const order =
      existing?.order ?? Math.max(-1, ...Object.values(next).map((e) => e.order)) + 1;
    next[key] = { size, order };
    commitWidgetLayout(next);
  };

  const removeWidget = (key: string) => {
    updateSettings({ home_widgets: board.filter((k) => k !== key) });
    if (widgetLayout[key]) {
      const next = { ...widgetLayout };
      delete next[key];
      commitWidgetLayout(next);
    }
  };

  const addWidget = (key: string) => {
    updateSettings({ home_widgets: [...board, key] });
  };

  // ── Reorder drag (pointer-based, vertical) ────────────────────────────────
  const handleReorderPointerDown = (e: React.PointerEvent, key: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setReorder({ key, overIndex: orderedBoard.indexOf(key) });
  };

  const handleReorderPointerMove = (e: React.PointerEvent) => {
    if (!reorder) return;
    const others = orderedBoard.filter((k) => k !== reorder.key);
    let index = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = itemRefs.current.get(others[i]);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    if (index !== reorder.overIndex) {
      setReorder((prev) => (prev ? { ...prev, overIndex: index } : prev));
    }
  };

  const handleReorderPointerUp = () => {
    if (!reorder) return;
    const others = orderedBoard.filter((k) => k !== reorder.key);
    const nextOrder = [
      ...others.slice(0, reorder.overIndex),
      reorder.key,
      ...others.slice(reorder.overIndex),
    ];
    const next = { ...widgetLayout };
    nextOrder.forEach((key, index) => {
      const definition = getWidgetDefinition(key);
      next[key] = {
        size: next[key]?.size ?? (definition ? defaultWidgetSize(definition) : "s"),
        order: index,
      };
    });
    commitWidgetLayout(next);
    setReorder(null);
  };

  // Render list: the other widgets with a drop-indicator placeholder at the
  // insertion gap; the dragged widget stays in place, dimmed.
  const renderList: Array<{ key: string; placeholder: boolean }> = [];
  if (reorder) {
    const others = orderedBoard.filter((k) => k !== reorder.key);
    others.forEach((key, i) => {
      if (i === reorder.overIndex) renderList.push({ key: "", placeholder: true });
      renderList.push({ key, placeholder: false });
    });
    if (reorder.overIndex >= others.length) renderList.push({ key: "", placeholder: true });
  }

  const columnWidth = WIDGET_SIZE_WIDTHS.l;

  return (
    <div
      aria-label="Desktop widgets"
      style={{
        position: "absolute",
        top,
        right: "16px",
        bottom: "80px",
        width: `min(${columnWidth}px, calc(100vw - 130px))`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "12px",
        overflowY: "auto",
        pointerEvents: "auto",
        zIndex: 5,
        paddingBottom: "4px",
      }}
    >
      {/* Column header: board count + "Add widgets" popover trigger */}
      <div style={{ position: "relative", alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "var(--w11-radius-full)",
            ...acrylicSurfaceStyle,
            color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
          }}
        >
          Widgets · {board.length}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((prev) => !prev);
          }}
          title="Add widgets"
          aria-label="Add widgets"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "var(--w11-radius-full)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            ...acrylicSurfaceStyle,
            color: "var(--w11-accent, #0078d4)",
            transition:
              "background var(--w11-transition-fast), transform var(--w11-transition-fast)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--w11-control-hover, rgba(255,255,255,0.08))")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "")
          }
        >
          <Plus size={14} />
        </button>

        {/* Add-widgets popover — every widget available to this role/plugins */}
        {pickerOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 40 }}
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-label="Add widgets"
              style={{
                position: "absolute",
                top: "34px",
                right: 0,
                width: "300px",
                maxHeight: "420px",
                overflowY: "auto",
                ...acrylicSurfaceStyle,
                borderRadius: "var(--w11-radius-lg)",
                padding: "6px",
                zIndex: 41,
                fontSize: "12px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "6px 8px 8px",
                  fontSize: "11px",
                  color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                  borderBottom: "1px solid var(--w11-border-subtle, rgba(255,255,255,0.08))",
                  marginBottom: "4px",
                }}
              >
                Add widgets · {board.length} on your board
              </div>
              {availableWidgets.length === 0 && (
                <div style={{ padding: "8px", color: "var(--w11-text-secondary)" }}>
                  No widgets available for your role yet.
                </div>
              )}
              {availableWidgets.map((widget) => {
                const onBoard = board.includes(widget.key);
                return (
                  <div
                    key={widget.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "6px 8px",
                      borderRadius: "var(--w11-radius-sm)",
                      cursor: "pointer",
                      transition: "background var(--w11-transition-fast)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onBoard) removeWidget(widget.key);
                      else addWidget(widget.key);
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--w11-control-hover, rgba(255,255,255,0.08))")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <span style={{ display: "flex", flexShrink: 0 }}>{widget.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {widget.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: "10px",
                          color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {widget.description}
                      </span>
                    </span>
                    <span
                      title={onBoard ? "Remove from board" : "Add to board"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        width: "22px",
                        height: "22px",
                        borderRadius: "var(--w11-radius-sm)",
                        background: onBoard
                          ? "var(--w11-accent, #0078d4)"
                          : "var(--w11-control-hover, rgba(255,255,255,0.08))",
                        color: onBoard
                          ? "var(--w11-accent-text, #ffffff)"
                          : "var(--w11-text-primary, #ffffff)",
                        transition: "background var(--w11-transition-fast)",
                      }}
                    >
                      {onBoard ? <Check size={12} /> : <Plus size={12} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {(reorder ? renderList : orderedBoard.map((key) => ({ key, placeholder: false }))).map(
        ({ key, placeholder }, index) => {
          if (placeholder) {
            return (
              <div
                key={`placeholder-${index}`}
                style={{
                  alignSelf: "stretch",
                  height: "3px",
                  borderRadius: "2px",
                  background: "var(--w11-accent, #0078d4)",
                  boxShadow: "0 0 8px var(--w11-accent, #0078d4)",
                  margin: "-1px 0",
                }}
              />
            );
          }

          const definition = getWidgetDefinition(key);
          if (!definition) return null;
          const Widget = definition.Component;
          const size = sizeFor(key, definition);
          const width = WIDGET_SIZE_WIDTHS[size];
          const isDragged = reorder?.key === key;

          return (
            <div
              key={key}
              ref={(el) => {
                if (el) itemRefs.current.set(key, el);
                else itemRefs.current.delete(key);
              }}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey((prev) => (prev === key ? null : prev))}
              style={{
                position: "relative",
                width: `${width}px`,
                maxWidth: "100%",
                alignSelf: "flex-end",
                display: "flex",
                flexDirection: "column",
                opacity: isDragged ? 0.35 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {/* Drag handle — reorder within the column */}
              <div
                onPointerDown={(e) => handleReorderPointerDown(e, key)}
                onPointerMove={handleReorderPointerMove}
                onPointerUp={handleReorderPointerUp}
                onPointerCancel={handleReorderPointerUp}
                title="Drag to reorder"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "16px",
                  cursor: "grab",
                  touchAction: "none",
                  color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                }}
              >
                <GripHorizontal
                  size={14}
                  style={{ opacity: hoveredKey === key ? 0.9 : 0.4, transition: "opacity 0.15s ease" }}
                />
              </div>

              <div style={{ position: "relative" }}>
                {/* In-process navigation: opens the route as an AOS window. */}
                <Widget compact onOpenRoute={navigate ?? undefined} />

                {/* Remove — visible on hover */}
                <button
                  type="button"
                  title={`Remove ${definition.title}`}
                  aria-label={`Remove ${definition.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWidget(key);
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "var(--w11-radius-sm)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    ...acrylicSurfaceStyle,
                    color: "var(--w11-text-primary, #ffffff)",
                    opacity: hoveredKey === key ? 1 : 0,
                    pointerEvents: hoveredKey === key ? "auto" : "none",
                    transition: "opacity var(--w11-transition-fast)",
                  }}
                >
                  <X size={12} />
                </button>

                {/* Resize — cycles S → M → L */}
                <button
                  type="button"
                  title={`Resize (${SIZE_LABELS[size]} → ${SIZE_LABELS[nextWidgetSize(size)]})`}
                  aria-label={`Resize widget, currently ${SIZE_LABELS[size]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWidgetSize(key, nextWidgetSize(size));
                  }}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "var(--w11-radius-sm)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "nwse-resize",
                    fontSize: "10px",
                    fontWeight: 700,
                    ...acrylicSurfaceStyle,
                    color: "var(--w11-accent, #0078d4)",
                    opacity: hoveredKey === key ? 1 : 0,
                    pointerEvents: hoveredKey === key ? "auto" : "none",
                    transition: "opacity var(--w11-transition-fast)",
                  }}
                >
                  {SIZE_LABELS[size]}
                </button>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

// ── Icon position resolution ────────────────────────────────────────────────

/**
 * Resolve a grid cell for every tile: stored positions win when they are
 * in-bounds and collision-free; the rest auto-place column-major (macOS
 * flow) into the first free cell.
 */
function resolveTilePositions(
  ids: string[],
  stored: Record<string, AOSDesktopIconPosition>,
  maxCol: number,
  maxRow: number
): Record<string, AOSDesktopIconPosition> {
  const taken = new Set<string>();
  const out: Record<string, AOSDesktopIconPosition> = {};

  for (const id of ids) {
    const pos = stored[id];
    if (!pos || pos.col > maxCol || pos.row > maxRow) continue;
    const cellKey = `${pos.col},${pos.row}`;
    if (taken.has(cellKey)) continue;
    out[id] = pos;
    taken.add(cellKey);
  }

  outer: for (const id of ids) {
    if (out[id]) continue;
    for (let col = 0; col <= maxCol; col++) {
      for (let row = 0; row <= maxRow; row++) {
        const cellKey = `${col},${row}`;
        if (taken.has(cellKey)) continue;
        out[id] = { col, row };
        taken.add(cellKey);
        continue outer;
      }
    }
    // Grid completely full — stack at the origin (degenerate case).
    out[id] = { col: 0, row: 0 };
  }

  return out;
}

/** Nearest free cell to (col,row) by expanding rings — used on drop collisions. */
function nearestFreeCell(
  col: number,
  row: number,
  taken: Set<string>,
  maxCol: number,
  maxRow: number
): { col: number; row: number } | null {
  for (let radius = 0; radius <= Math.max(maxCol, maxRow) + 1; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c > maxCol || r > maxRow) continue;
        if (!taken.has(`${c},${r}`)) return { col: c, row: r };
      }
    }
  }
  return null;
}

export default function Desktop({
  onOpenApp,
  wallpaper,
  themeMode,
  brightness,
  currentRole = "admin",
  showTopBar = true,
  apps: externalApps,
  folders: resolvedFolders,
  onUpdateFolders,
  layout: layoutProp,
  onUpdateLayout,
  children,
}: DesktopProps) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [folderPopup, setFolderPopup] = useState<{
    folderId: string;
    left: number;
    top: number;
  } | null>(null);
  const [dialog, setDialog] = useState<FolderDialog | null>(null);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);

  // Desktop widget column visibility. Starts undetermined (null) so the
  // first paint matches SSR; the persisted/local default resolves in an
  // effect (no hydration mismatch).
  const [widgetsVisible, setWidgetsVisible] = useState<boolean | null>(null);

  const desktopRef = useRef<HTMLDivElement>(null);

  // Live viewport (for grid clamping); corrected right after mount.
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Desktop layout state (icon positions + widget arrangement) ───────────
  // Local state leads (instant drags/resizes); the shell persists it via
  // onUpdateLayout and the prop echo is skipped (lastEmitted guard).
  const parsedLayout = useMemo(() => parseDesktopLayout(layoutProp), [layoutProp]);
  const [liveLayout, setLiveLayout] = useState<AOSDesktopLayout>(parsedLayout);
  const lastEmittedLayoutRef = useRef<string | null>(null);

  useEffect(() => {
    const incoming = JSON.stringify(parsedLayout);
    if (lastEmittedLayoutRef.current === incoming) return;
    lastEmittedLayoutRef.current = null;
    setLiveLayout(parsedLayout);
  }, [parsedLayout]);

  const commitLayout = useCallback(
    (next: AOSDesktopLayout) => {
      const serialized = JSON.stringify(next);
      lastEmittedLayoutRef.current = serialized;
      setLiveLayout(next);
      onUpdateLayout?.(next);
    },
    [onUpdateLayout]
  );

  /** Widget-column commits keep the live icon positions untouched. */
  const commitWidgetLayout = useCallback(
    (widgetLayout: AOSDesktopLayout["widgetLayout"]) => {
      commitLayout({ iconPositions: liveLayout.iconPositions, widgetLayout });
    },
    [commitLayout, liveLayout.iconPositions]
  );

  // Folder mode is active as soon as the resolved layout is provided; without
  // it the desktop behaves exactly as before (loose icons only).
  const folderMode = resolvedFolders !== undefined;

  // Dynamic apps from plugins if externalApps not passed
  const { sidebarItems, installedPlugins } = useInstalledPlugins();

  // Installed plugin slugs: installed+active plugins ∪ sidebar-visible ones.
  const installedSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const plugin of installedPlugins) {
      if (plugin.plugin_slug) slugs.add(plugin.plugin_slug);
    }
    for (const item of sidebarItems) {
      if (item.slug) slugs.add(item.slug);
    }
    return Array.from(slugs);
  }, [installedPlugins, sidebarItems]);

  const folderedAppIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of resolvedFolders ?? []) {
      for (const app of folder.apps) ids.add(app.id);
    }
    return ids;
  }, [resolvedFolders]);

  // Persisted-shape folders (id/name/appIds) for edits + name validation.
  const currentFolders: AOSDesktopFolder[] = useMemo(
    () =>
      (resolvedFolders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        appIds: folder.appIds,
      })),
    [resolvedFolders]
  );

  const desktopIcons = useMemo(() => {
    const list: { id: string; name: string; icon: React.ReactNode }[] = externalApps
      ? externalApps.map((a) => ({ id: a.id, name: a.name, icon: a.icon }))
      : sidebarItems.map((item) => {
          const app = getAOSAppForModule(item);
          return { id: app.id, name: app.name, icon: app.icon };
        });

    // Sidebar subitems can normalize to the same module id as their parent
    // (e.g. Website → /settings/website-design); one desktop icon per module.
    const seen = new Set<string>();
    const deduped = list.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Foldered apps are represented by their folder icon instead.
    const loose = folderMode
      ? deduped.filter((item) => !folderedAppIds.has(item.id))
      : deduped;

    // Add Academic Archive (Recycle Bin) at the end
    loose.push({
      id: "recycle_bin",
      name: "Academic Archive",
      icon: (
        <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={38} color="#94a3b8" />
        </div>
      ),
    });

    return loose;
  }, [externalApps, sidebarItems, folderMode, folderedAppIds]);

  // Tile order: folders first, then loose apps (recycle bin last).
  const tileIds = useMemo(
    () => [
      ...(resolvedFolders ?? []).map((folder) => folder.id),
      ...desktopIcons.map((item) => item.id),
    ],
    [resolvedFolders, desktopIcons]
  );

  // ── Grid geometry ─────────────────────────────────────────────────────────
  const canvasTop = showTopBar ? CANVAS_TOP_WITH_BAR : CANVAS_TOP_WITHOUT_BAR;
  const maxCol = Math.max(
    0,
    Math.floor(
      (viewport.w - CANVAS_LEFT - (widgetsVisible ? WIDGET_COLUMN_RESERVE : 16) - TILE_SIZE) /
        GRID_STEP
    )
  );
  const maxRow = Math.max(
    0,
    Math.floor((viewport.h - DOCK_RESERVE - canvasTop - TILE_SIZE) / GRID_STEP)
  );

  const tilePositions = useMemo(
    () => resolveTilePositions(tileIds, liveLayout.iconPositions, maxCol, maxRow),
    [tileIds, liveLayout.iconPositions, maxCol, maxRow]
  );

  // ── Icon drag (pointer-based, snaps to the grid) ─────────────────────────
  const [drag, setDrag] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    originCol: number;
    originRow: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  /** Target cell for the current drag offset (collision-resolved). */
  const resolveDropCell = useCallback(
    (id: string, dx: number, dy: number): AOSDesktopIconPosition => {
      const origin = tilePositions[id] ?? { col: 0, row: 0 };
      const col = Math.max(0, Math.min(maxCol, Math.round((origin.col * GRID_STEP + dx) / GRID_STEP)));
      const row = Math.max(0, Math.min(maxRow, Math.round((origin.row * GRID_STEP + dy) / GRID_STEP)));
      const taken = new Set<string>();
      for (const [tileId, pos] of Object.entries(tilePositions)) {
        if (tileId !== id) taken.add(`${pos.col},${pos.row}`);
      }
      if (!taken.has(`${col},${row}`)) return { col, row };
      return nearestFreeCell(col, row, taken, maxCol, maxRow) ?? origin;
    },
    [tilePositions, maxCol, maxRow]
  );

  const handleTilePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // A fresh press clears any stale drag-click suppression.
    suppressClickRef.current = false;
    const pos = tilePositions[id] ?? { col: 0, row: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originCol: pos.col,
      originRow: pos.row,
      dx: 0,
      dy: 0,
      moved: false,
    });
  };

  const handleTilePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) suppressClickRef.current = true;
    setDrag((prev) => (prev ? { ...prev, dx, dy, moved: true } : prev));
  };

  const handleTilePointerUp = () => {
    if (!drag) return;
    if (drag.moved) {
      const cell = resolveDropCell(drag.id, drag.dx, drag.dy);
      commitLayout({
        iconPositions: { ...liveLayout.iconPositions, [drag.id]: cell },
        widgetLayout: liveLayout.widgetLayout,
      });
    }
    setDrag(null);
  };

  // Drop-target preview cell while dragging.
  const dragPreviewCell =
    drag && drag.moved ? resolveDropCell(drag.id, drag.dx, drag.dy) : null;

  const popupFolder = useMemo(
    () =>
      folderPopup
        ? (resolvedFolders ?? []).find((f) => f.id === folderPopup.folderId) ?? null
        : null,
    [folderPopup, resolvedFolders]
  );

  const dialogFolder = useMemo(() => {
    if (!dialog || dialog.type === "newFolder") return null;
    return (resolvedFolders ?? []).find((f) => f.id === dialog.folderId) ?? null;
  }, [dialog, resolvedFolders]);

  // Resolve widget-column visibility: stored preference wins; otherwise
  // default to visible on wide screens, hidden below 1200px.
  useEffect(() => {
    const stored = window.localStorage.getItem(WIDGETS_VISIBLE_KEY);
    if (stored === "true" || stored === "false") {
      setWidgetsVisible(stored === "true");
    } else {
      setWidgetsVisible(window.innerWidth >= WIDGETS_DEFAULT_MIN_WIDTH);
    }
  }, []);

  const toggleWidgetColumn = () => {
    setWidgetsVisible((prev) => {
      const next = !(prev ?? false);
      try {
        window.localStorage.setItem(WIDGETS_VISIBLE_KEY, String(next));
      } catch {
        // Private-mode / storage disabled — toggle still works for the session.
      }
      return next;
    });
  };

  // Close the folder popup / dialogs on Escape (matches shell flyout behavior).
  useEffect(() => {
    if (!folderPopup && !dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFolderPopup(null);
        setDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [folderPopup, dialog]);

  const getWallpaperBackground = () => {
    if (wallpaper.startsWith("custom:")) {
      const url = wallpaper.replace("custom:", "");
      return `url('${url}') center / cover no-repeat`;
    }

    switch (wallpaper) {
      case "bloom-dark":
        return "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)";
      case "bloom-light":
        return "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)";
      case "sonoma":
        return "linear-gradient(135deg, #f6d365 0%, #fda085 100%)";
      case "ventura":
        return "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)";
      case "blueprint":
        return "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%)";
      case "nebula":
        return "radial-gradient(ellipse at top, #312e81, #0c0a09)";
      case "forest":
        return "linear-gradient(135deg, #14532d 0%, #166534 50%, #052e16 100%)";
      case "minimal":
        return "linear-gradient(135deg, #f5f5f5, #e5e5e5)";
      default:
        return themeMode === "dark"
          ? "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)"
          : "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)";
    }
  };

  // ── Folder popup positioning ──────────────────────────────────────────────
  // Anchored below/beside the trigger point, clamped into the viewport (and
  // flipped above the anchor when it would overflow the bottom edge).
  const computePopupPosition = (
    folder: ResolvedAOSDesktopFolder,
    centerX: number,
    anchorBottom: number,
    anchorTop: number
  ) => {
    const POPUP_WIDTH = 300;
    const estimatedHeight = Math.min(64 + folder.apps.length * 56, 420);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = centerX - POPUP_WIDTH / 2;
    left = Math.max(12, Math.min(left, vw - POPUP_WIDTH - 12));

    let top = anchorBottom + 10;
    if (top + estimatedHeight > vh - 12) {
      const above = anchorTop - estimatedHeight - 10;
      top = above >= 12 ? above : Math.max(12, vh - estimatedHeight - 12);
    }
    return { left, top };
  };

  const openFolderPopupFromIcon = (
    folder: ResolvedAOSDesktopFolder,
    e: React.MouseEvent
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { left, top } = computePopupPosition(
      folder,
      rect.left + rect.width / 2,
      rect.bottom,
      rect.top
    );
    setFolderPopup({ folderId: folder.id, left, top });
  };

  // ── Folder mutations (each commits the full next folder list) ─────────────
  const commitFolders = (next: AOSDesktopFolder[]) => {
    onUpdateFolders?.(next);
  };

  const addAppToFolder = (folderId: string, appId: string) => {
    commitFolders(
      currentFolders.map((f) =>
        f.id === folderId && !f.appIds.includes(appId)
          ? { ...f, appIds: [...f.appIds, appId] }
          : f
      )
    );
  };

  const nameDialog =
    dialog && (dialog.type === "rename" || dialog.type === "newFolder") ? dialog : null;
  const nameError = nameDialog
    ? validateFolderName(
        nameDialog.name,
        currentFolders,
        nameDialog.type === "rename" ? nameDialog.folderId : undefined
      )
    : null;

  const submitRename = () => {
    if (!dialog || dialog.type !== "rename" || nameError) return;
    const { folderId, name } = dialog;
    commitFolders(
      currentFolders.map((f) => (f.id === folderId ? { ...f, name: name.trim() } : f))
    );
    setDialog(null);
  };

  const submitNewFolder = () => {
    if (!dialog || dialog.type !== "newFolder" || nameError) return;
    const { appId, name } = dialog;
    const trimmed = name.trim();
    commitFolders([
      ...currentFolders,
      { id: createFolderId(trimmed, currentFolders), name: trimmed, appIds: [appId] },
    ]);
    setDialog(null);
  };

  const submitAddApps = () => {
    if (!dialog || dialog.type !== "addApps" || dialog.selected.length === 0) return;
    const { folderId, selected } = dialog;
    commitFolders(
      currentFolders.map((f) =>
        f.id === folderId
          ? {
              ...f,
              appIds: [...f.appIds, ...selected.filter((id) => !f.appIds.includes(id))],
            }
          : f
      )
    );
    setDialog(null);
  };

  const submitRemoveFolder = () => {
    if (!dialog || dialog.type !== "remove") return;
    const { folderId } = dialog;
    // Apps in the folder simply return loose — no appIds to migrate.
    commitFolders(currentFolders.filter((f) => f.id !== folderId));
    setDialog(null);
  };

  const looseAppsForDialog = desktopIcons.filter((item) => item.id !== "recycle_bin");

  // ── Pointer / selection plumbing (unchanged behavior) ─────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target !== desktopRef.current) return;

    setSelectedIcon(null);
    setContextMenu(null);

    setSelectionBox({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      active: true,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!selectionBox || !selectionBox.active) return;
    setSelectionBox({
      ...selectionBox,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  const handlePointerUp = () => {
    if (selectionBox?.active) {
      setSelectionBox(null);
    }
  };

  const openContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 16));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 360));
    setSubmenuOpen(false);
    setFolderPopup(null);
    setContextMenu({ x, y, target });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 16));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 360));
    setSubmenuOpen(false);
    setFolderPopup(null);
    setContextMenu({ x, y, target: { kind: "desktop" } });
  };

  const getBoxStyles = () => {
    if (!selectionBox) return {};
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  // ── Context menu fragments ────────────────────────────────────────────────
  const contextMenuShell = (content: React.ReactNode) => (
    <div
      style={{
        position: "fixed",
        top: `${contextMenu!.y}px`,
        left: `${contextMenu!.x}px`,
        width: `${CONTEXT_MENU_WIDTH}px`,
        ...acrylicSurfaceStyle,
        borderRadius: "var(--w11-radius-lg)",
        padding: "6px",
        zIndex: 9999,
        fontSize: "12px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );

  const renderFolderMenu = (folderId: string) => {
    const folder = (resolvedFolders ?? []).find((f) => f.id === folderId);
    if (!folder) return null;
    return contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<FolderOpen size={14} />}
          label="Open"
          onClick={() => {
            const { left, top } = computePopupPosition(
              folder,
              contextMenu!.x + 80,
              contextMenu!.y,
              contextMenu!.y
            );
            setFolderPopup({ folderId: folder.id, left, top });
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <DesktopMenuItem
          icon={<PenLine size={14} />}
          label="Rename Folder"
          onClick={() => {
            setDialog({ type: "rename", folderId, name: folder.name });
            setContextMenu(null);
          }}
        />
        <DesktopMenuItem
          icon={<ListPlus size={14} />}
          label="Add Apps to Folder…"
          onClick={() => {
            setDialog({ type: "addApps", folderId, selected: [] });
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <DesktopMenuItem
          icon={<FolderMinus size={14} />}
          label="Remove Folder"
          danger
          onClick={() => {
            setDialog({ type: "remove", folderId });
            setContextMenu(null);
          }}
        />
      </>
    );
  };

  const renderAppMenu = (appId: string) => {
    const app = desktopIcons.find((item) => item.id === appId);
    if (!app) return null;
    const submenuFitsRight =
      contextMenu!.x + CONTEXT_MENU_WIDTH + 210 < window.innerWidth;
    return contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<AppWindow size={14} />}
          label="Open"
          onClick={() => {
            onOpenApp(appId);
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          <DesktopMenuItem
            icon={<FolderPlus size={14} />}
            label="Add to Folder"
            trailing={<ChevronRight size={14} style={{ opacity: 0.8, flexShrink: 0 }} />}
          />
          {submenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "-6px",
                width: "200px",
                ...(submenuFitsRight
                  ? { left: "calc(100% + 4px)" }
                  : { right: "calc(100% + 4px)" }),
                ...acrylicSurfaceStyle,
                borderRadius: "var(--w11-radius-lg)",
                padding: "6px",
                fontSize: "12px",
                boxShadow: "0 14px 35px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {currentFolders.length === 0 && (
                <div
                  style={{
                    padding: "6px 10px",
                    color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                  }}
                >
                  No folders yet
                </div>
              )}
              {currentFolders.map((folder) => (
                <DesktopMenuItem
                  key={folder.id}
                  icon={<Folder size={14} />}
                  label={folder.name}
                  trailing={
                    <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>
                      {folder.appIds.length}
                    </span>
                  }
                  onClick={() => {
                    addAppToFolder(folder.id, appId);
                    setContextMenu(null);
                  }}
                />
              ))}
              {currentFolders.length > 0 && <MenuDivider />}
              <DesktopMenuItem
                icon={<Plus size={14} />}
                label="New Folder…"
                onClick={() => {
                  setDialog({
                    type: "newFolder",
                    appId,
                    name: generateUniqueFolderName(currentFolders),
                  });
                  setContextMenu(null);
                }}
              />
            </div>
          )}
        </div>
      </>
    );
  };

  const renderDesktopMenu = () =>
    contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<Eye size={14} />}
          label="View"
        />

        <DesktopMenuItem icon={<ArrowUpDown size={14} />} label="Sort by" />

        <DesktopMenuItem
          icon={<RefreshCw size={14} />}
          label="Refresh"
          onClick={() => setContextMenu(null)}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<FolderPlus size={14} />}
          label="Open School Vault"
          onClick={() => {
            onOpenApp("files");
            setContextMenu(null);
          }}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<Monitor size={14} />}
          label="Display settings"
          onClick={() => {
            onOpenApp("settings");
            setContextMenu(null);
          }}
        />

        <DesktopMenuItem
          icon={<Palette size={14} />}
          label="Personalize Wallpaper"
          onClick={() => {
            onOpenApp("settings");
            setContextMenu(null);
          }}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<MoreHorizontal size={14} />}
          label="Show more options"
          onClick={() => alert("AOS (A School OS) 2026.1 System Information")}
        />
      </>
    );

  // ── Folder dialogs (win11-dialog pattern) ─────────────────────────────────
  const renderNameHelper = (name: string) => {
    if (name.trim().length === 0) {
      return (
        <div style={{ fontSize: 11, marginTop: 6, color: "var(--w11-text-secondary)" }}>
          Enter a name for this folder.
        </div>
      );
    }
    if (nameError) {
      return (
        <div style={{ fontSize: 11, marginTop: 6, color: "#c42b1c" }}>{nameError}</div>
      );
    }
    return (
      <div
        style={{
          fontSize: 11,
          marginTop: 6,
          color: "var(--w11-text-secondary)",
          textAlign: "right",
        }}
      >
        {name.trim().length}/{FOLDER_NAME_MAX_LENGTH}
      </div>
    );
  };

  const renderDialog = () => {
    if (!dialog || (dialog.type !== "newFolder" && !dialogFolder)) return null;

    return (
      <div
        className="win11-modal-backdrop"
        onClick={() => setDialog(null)}
      >
        <div
          className="win11-dialog"
          style={{ width: "420px", maxWidth: "92vw" }}
          onClick={(e) => e.stopPropagation()}
        >
          {dialog.type === "rename" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <PenLine size={18} style={{ color: "var(--w11-accent)" }} />
                <span>Rename Folder</span>
              </div>
              <div className="dialog-body">
                <input
                  autoFocus
                  type="text"
                  value={dialog.name}
                  maxLength={FOLDER_NAME_MAX_LENGTH}
                  placeholder="Folder name"
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                  }}
                  style={dialogInputStyle}
                />
                {renderNameHelper(dialog.name)}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", ...(nameError ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                  disabled={!!nameError}
                  onClick={submitRename}
                >
                  Save
                </button>
              </div>
            </>
          )}

          {dialog.type === "remove" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FolderMinus size={18} style={{ color: "#c42b1c" }} />
                <span>Remove Folder?</span>
              </div>
              <div className="dialog-body">
                Remove &ldquo;{dialogFolder.name}&rdquo;? Its {dialogFolder.apps.length}{" "}
                {dialogFolder.apps.length === 1 ? "app" : "apps"} will return to the
                desktop. This does not uninstall anything.
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", background: "#c42b1c" }}
                  onClick={submitRemoveFolder}
                >
                  Remove Folder
                </button>
              </div>
            </>
          )}

          {dialog.type === "addApps" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <ListPlus size={18} style={{ color: "var(--w11-accent)" }} />
                <span>Add Apps to {dialogFolder.name}</span>
              </div>
              <div className="dialog-body">
                {looseAppsForDialog.length === 0 ? (
                  <div style={{ color: "var(--w11-text-secondary)" }}>
                    Every app is already in a folder.
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "240px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    {looseAppsForDialog.map((app) => {
                      const checked = dialog.selected.includes(app.id);
                      return (
                        <label
                          key={app.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "4px 8px",
                            borderRadius: "var(--w11-radius-sm)",
                            cursor: "pointer",
                            transition: "background var(--w11-transition-fast)",
                            background: checked
                              ? "var(--w11-accent-light, rgba(0, 120, 212, 0.12))"
                              : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setDialog({
                                ...dialog,
                                selected: checked
                                  ? dialog.selected.filter((id) => id !== app.id)
                                  : [...dialog.selected, app.id],
                              })
                            }
                          />
                          {app.icon}
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--w11-text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {app.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{
                    fontSize: "12px",
                    ...(dialog.selected.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}
                  disabled={dialog.selected.length === 0}
                  onClick={submitAddApps}
                >
                  Add {dialog.selected.length > 0 ? `(${dialog.selected.length})` : ""}
                </button>
              </div>
            </>
          )}

          {dialog.type === "newFolder" && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FolderPlus size={18} style={{ color: "var(--w11-accent)" }} />
                <span>New Folder</span>
              </div>
              <div className="dialog-body">
                <div style={{ marginBottom: "10px", color: "var(--w11-text-secondary)" }}>
                  &ldquo;{desktopIcons.find((a) => a.id === dialog.appId)?.name ?? dialog.appId}
                  &rdquo; will be added to the new folder.
                </div>
                <input
                  autoFocus
                  type="text"
                  value={dialog.name}
                  maxLength={FOLDER_NAME_MAX_LENGTH}
                  placeholder="Folder name"
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewFolder();
                  }}
                  style={dialogInputStyle}
                />
                {renderNameHelper(dialog.name)}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", ...(nameError ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                  disabled={!!nameError}
                  onClick={submitNewFolder}
                >
                  Create Folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Shared per-tile drag props (position via transform for smooth snapping).
  const tilePointerHandlers = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => handleTilePointerDown(e, id),
    onPointerMove: handleTilePointerMove,
    onPointerUp: handleTilePointerUp,
    onPointerCancel: handleTilePointerUp,
  });

  const tileTransform = (id: string): React.CSSProperties => {
    const pos = tilePositions[id] ?? { col: 0, row: 0 };
    const isDragging = drag?.id === id && drag.moved;
    const x = pos.col * GRID_STEP + (isDragging ? drag!.dx : 0);
    const y = pos.row * GRID_STEP + (isDragging ? drag!.dy : 0);
    return {
      transform: `translate3d(${x}px, ${y}px, 0)${isDragging ? " scale(1.05)" : ""}`,
    };
  };

  return (
    <div
      ref={desktopRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenu(null)}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: getWallpaperBackground(),
        overflow: "hidden",
        userSelect: "none",
        transition: "background 0.3s ease",
      }}
    >
      {/* Brightness Dimmer Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000000",
          opacity: ((100 - brightness) / 100) * 0.7,
          pointerEvents: "none",
          zIndex: 1,
          transition: "opacity 0.1s ease",
        }}
      />

      {/* Desktop Shortcut Icons — absolutely positioned grid canvas.
          The container is a zero-size origin point so it never intercepts
          pointer events (marquee selection still starts on the desktop). */}
      <div
        style={{
          position: "absolute",
          top: `${canvasTop}px`,
          left: `${CANVAS_LEFT}px`,
          width: 0,
          height: 0,
          zIndex: 5,
        }}
      >
        {/* Drop-target preview (snapped cell under the dragged tile) */}
        {dragPreviewCell && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${TILE_SIZE}px`,
              height: `${TILE_SIZE}px`,
              borderRadius: "var(--w11-radius-lg)",
              border: "2px solid var(--w11-accent, #0078d4)",
              background: "color-mix(in srgb, var(--w11-accent, #0078d4) 18%, transparent)",
              transform: `translate3d(${dragPreviewCell.col * GRID_STEP}px, ${
                dragPreviewCell.row * GRID_STEP
              }px, 0)`,
              transition: "transform var(--w11-transition-fast)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Folder icons render first, before loose apps */}
        {folderMode &&
          (resolvedFolders ?? []).map((folder) => (
            <DesktopIconTile
              key={folder.id}
              selected={selectedIcon === folder.id}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                setSelectedIcon(folder.id);
                setContextMenu(null);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openFolderPopupFromIcon(folder, e);
              }}
              onContextMenu={(e) => openContextMenu(e, { kind: "folder", folderId: folder.id })}
              icon={<FolderTile name={folder.name} />}
              label={folder.name}
              dragging={drag?.id === folder.id && drag.moved}
              style={tileTransform(folder.id)}
              {...tilePointerHandlers(folder.id)}
            />
          ))}

        {desktopIcons.map((item) => {
          const isSelected = selectedIcon === item.id;
          return (
            <DesktopIconTile
              key={item.id}
              selected={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                setSelectedIcon(item.id);
                setContextMenu(null);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (item.id === "recycle_bin") {
                  alert("Academic Archive is clean.");
                } else {
                  onOpenApp(item.id);
                }
              }}
              onContextMenu={(e) => {
                // Loose apps get their own menu in folder mode; the recycle
                // bin and the classic desktop keep the background menu.
                if (item.id === "recycle_bin" || !folderMode) return;
                openContextMenu(e, { kind: "app", appId: item.id });
              }}
              icon={item.icon}
              label={item.name}
              dragging={drag?.id === item.id && drag.moved}
              style={tileTransform(item.id)}
              {...tilePointerHandlers(item.id)}
            />
          );
        })}
      </div>

      {/* macOS-style widget column — compact home widgets stacked along the
          right edge (below windows, above the wallpaper). */}
      {widgetsVisible && (
        <DesktopWidgetColumn
          role={currentRole}
          installedSlugs={installedSlugs}
          top={showTopBar ? "94px" : "60px"}
          widgetLayout={liveLayout.widgetLayout}
          onUpdateWidgetLayout={commitWidgetLayout}
        />
      )}

      {/* Widget column toggle — small round acrylic button, below the menubar */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleWidgetColumn();
        }}
        title={widgetsVisible ? "Hide desktop widgets" : "Show desktop widgets"}
        aria-label={widgetsVisible ? "Hide desktop widgets" : "Show desktop widgets"}
        aria-pressed={widgetsVisible ?? false}
        style={{
          position: "absolute",
          top: showTopBar ? "50px" : "16px",
          right: "16px",
          width: "32px",
          height: "32px",
          borderRadius: "var(--w11-radius-full)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 6,
          ...acrylicSurfaceStyle,
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
          color: widgetsVisible ? "var(--w11-accent, #0078d4)" : "var(--w11-text-secondary, rgba(255,255,255,0.65))",
          transition:
            "background var(--w11-transition-fast), color var(--w11-transition-fast)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor =
            "var(--w11-control-hover, rgba(255,255,255,0.08))")
        }
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
      >
        <LayoutGrid size={15} />
      </button>

      {/* Windows Manager Layer */}
      {children}

      {/* Marquee Selection Rectangle */}
      {selectionBox?.active && (
        <div
          style={{
            position: "absolute",
            border: "1px solid var(--w11-accent)",
            background: "var(--w11-accent-light)",
            borderRadius: "var(--w11-radius-sm)",
            pointerEvents: "none",
            zIndex: 900,
            ...getBoxStyles(),
          }}
        />
      )}

      {/* Folder popup — acrylic panel listing the folder's apps.
          Stays open until the backdrop is clicked. */}
      {folderPopup && popupFolder && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10010 }}
            onClick={() => setFolderPopup(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderPopup(null);
            }}
          />
          <div
            style={{
              position: "fixed",
              left: `${folderPopup.left}px`,
              top: `${folderPopup.top}px`,
              width: "300px",
              maxWidth: "340px",
              ...acrylicSurfaceStyle,
              borderRadius: "var(--w11-radius-lg)",
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.4)",
              padding: "10px",
              zIndex: 10020,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "2px 6px 10px",
                borderBottom: "1px solid var(--w11-border-subtle, rgba(255,255,255,0.08))",
                marginBottom: "6px",
              }}
            >
              <FolderTile name={popupFolder.name} size={28} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{popupFolder.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                }}
              >
                {popupFolder.apps.length} {popupFolder.apps.length === 1 ? "app" : "apps"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: "360px",
                overflowY: "auto",
              }}
            >
              {popupFolder.apps.map((app) => (
                <div
                  key={app.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderPopup(null);
                    onOpenApp(app.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "4px 8px",
                    borderRadius: "var(--w11-radius-sm)",
                    cursor: "pointer",
                    transition: "background var(--w11-transition-fast)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--w11-control-hover, rgba(255,255,255,0.08))")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {app.icon}
                  <span
                    style={{
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {app.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Desktop Context Menus */}
      {contextMenu?.target.kind === "desktop" && renderDesktopMenu()}
      {contextMenu?.target.kind === "folder" && renderFolderMenu(contextMenu.target.folderId)}
      {contextMenu?.target.kind === "app" && renderAppMenu(contextMenu.target.appId)}

      {/* Folder management dialogs */}
      {renderDialog()}
    </div>
  );
}
