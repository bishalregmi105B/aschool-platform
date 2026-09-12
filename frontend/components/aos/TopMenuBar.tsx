"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AOSLogo } from "@/components/aos/AOSIcons";
import {
  Sliders,
  Bell,
  ChevronDown,
  LayoutGrid,
  Smartphone,
  Monitor,
  Maximize,
  Minimize,
  Check,
} from "lucide-react";
import { SchoolRole } from "@/components/aos/types";
import { useServerTime } from "@/lib/use-server-time";
import { useAuth } from "@/lib/auth-context";
import { LanguageToggle } from "@/components/aos/LanguageToggle";
import { useAOSNavigate } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";
import { normalizeAOSModuleId } from "@/lib/aos-app-adapter";
import { DEFAULT_TOPBAR_ITEMS } from "@/lib/aos-settings";

/** Module info the menu bar needs (structural subset of PluginSidebarItem). */
export interface TopMenuBarNavItem {
  slug: string;
  label: string;
  /** Nepali manifest label — rendered when the i18n language is "ne". */
  label_nepali?: string | null;
  section?: string | null;
  route?: string | null;
  subitems?: Array<{ label: string; label_nepali?: string | null; route: string }>;
}

/** Open-window info the menu bar needs (structural subset of WindowInstance). */
export interface TopMenuBarWindowInfo {
  id: string;
  title: string;
  moduleId?: string;
  route?: string;
  icon?: React.ReactNode;
  isOpen?: boolean;
  isMinimized?: boolean;
  isMaximized?: boolean;
}

interface TopMenuBarProps {
  currentRole?: SchoolRole;
  onOpenRoleSwitcher?: () => void;
  onToggleControlCenter: () => void;
  onToggleNotifications: () => void;
  onToggleWidgets: () => void;
  onOpenApp: (appId: string) => void;
  unreadCount?: number;
  onToggleAppDrawer?: () => void;
  onToggleAppSwitcher?: () => void;
  systemMode?: "desktop" | "mobile";
  onToggleSystemMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  topBarHeight?: "compact" | "standard" | "large";
  /** Plugin manifest nav items — drives the focused-app Navigate menu and the desktop section menus. */
  sidebarItems?: TopMenuBarNavItem[];
  /** Open AOS windows — drives the focused-app menus and the Window menu. */
  windows?: TopMenuBarWindowInfo[];
  activeWindowId?: string | null;
  onFocusWindow?: (id: string) => void;
  onMinimizeActive?: () => void;
  onMaximizeActive?: () => void;
  onCloseActive?: () => void;
  /** Persisted left-side quick items (from useAOSUserSettings.topbar_items). */
  topbarItems?: string[];
  onChangeTopbarItems?: (items: string[]) => void;
  /** Legacy props kept for interface compatibility (search now lives in Spotlight, Cmd+Space). */
  onToggleSearch?: () => void;
  onToggleSpotlight?: () => void;
}

/** Items toggleable from the "Edit Menu Bar…" dialog (Apple menu). */
const EDITABLE_TOPBAR_ITEMS: Array<{ id: string; label: string; description: string }> = [
  {
    id: "sections",
    label: "Section groups",
    description: "All module sections, grouped by name inside the Apps menu",
  },
  {
    id: "vault",
    label: "Vault",
    description: "Dashboard link to the AOS File Manager inside the Apps menu",
  },
  {
    id: "store",
    label: "Store",
    description: "Dashboard link to the AOS App Store inside the Apps menu",
  },
  {
    id: "widgets",
    label: "Widgets",
    description: "Widgets board toggle shown in the menu bar",
  },
];

const ROLE_COLORS: Record<string, string> = {
  student: "#0284c7",
  teacher: "#10b981",
  admin: "#6366f1",
  superadmin: "#8b5cf6",
  accountant: "#f59e0b",
  parent: "#ec4899",
};

/* ------------------------------------------------------------------ */
/* Small acrylic menu primitives (11.css tokens, existing menubar idiom) */
/* ------------------------------------------------------------------ */

function MenuSeparator() {
  return <div style={{ height: "1px", background: "var(--w11-border-subtle)", margin: "4px 2px" }} />;
}

function MenuRow({
  label,
  onClick,
  disabled,
  danger,
  checked,
  hint,
  hintColor,
  isHeader,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** When defined, reserves a leading check slot (checkmark when true). */
  checked?: boolean;
  hint?: string;
  hintColor?: string;
  /** Non-interactive section header row (collapsed "Sections" menu). */
  isHeader?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (isHeader) {
    return (
      <div
        style={{
          padding: "7px 10px 3px",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--w11-text-tertiary)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    );
  }

  const interactive = !disabled && Boolean(onClick);
  return (
    <div
      role="menuitem"
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
      style={{
        padding: "5px 10px",
        borderRadius: "4px",
        cursor: interactive ? "pointer" : "default",
        opacity: disabled ? 0.45 : 1,
        color: danger ? "#ef4444" : "var(--w11-text-primary)",
        backgroundColor:
          hovered && interactive ? "var(--w11-control-hover)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        transition: "background 0.12s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
        {checked !== undefined && (
          <span
            style={{
              width: "14px",
              display: "inline-flex",
              flexShrink: 0,
              color: "var(--w11-text-secondary)",
            }}
          >
            {checked ? <Check size={12} /> : null}
          </span>
        )}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </span>
      {hint && (
        <span
          style={{
            color: hintColor || "var(--w11-text-tertiary)",
            fontSize: "11px",
            flexShrink: 0,
            fontWeight: hintColor ? 700 : 400,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function MenuDropdown({
  top,
  minWidth = 210,
  children,
}: {
  top: number;
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}px`,
        left: 0,
        minWidth: `${minWidth}px`,
        background: "var(--w11-surface-flyout)",
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
        border: "1px solid var(--w11-acrylic-border)",
        borderRadius: "8px",
        boxShadow: "0 14px 35px rgba(0,0,0,0.4)",
        padding: "5px",
        zIndex: 10002,
        fontSize: "12px",
        color: "var(--w11-text-primary)",
        maxHeight: "min(420px, 70vh)",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/**
 * Small acrylic dialog. Rendered through a portal to document.body — the
 * menu bar's backdrop-filter would otherwise become the containing block
 * for fixed-position children.
 */
function ModalDialog({
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dialog = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10060,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="win11-dialog"
        style={{ width: "400px", maxWidth: "92vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="dialog-header"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          {icon}
          <span>{title}</span>
        </div>
        <div className="dialog-body" style={{ fontSize: "13px", lineHeight: 1.55 }}>
          {children}
        </div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}

/* ------------------------------------------------------------------ */
/* Top menu bar                                                        */
/* ------------------------------------------------------------------ */

export default function TopMenuBar({
  currentRole,
  onOpenRoleSwitcher,
  onToggleControlCenter,
  onToggleNotifications,
  onToggleWidgets,
  onOpenApp,
  unreadCount = 0,
  onToggleAppDrawer,
  onToggleAppSwitcher,
  systemMode = "desktop",
  onToggleSystemMode,
  isFullscreen = false,
  onToggleFullscreen,
  topBarHeight = "standard",
  sidebarItems,
  windows,
  activeWindowId,
  onFocusWindow,
  onMinimizeActive,
  onMaximizeActive,
  onCloseActive,
  topbarItems,
  onChangeTopbarItems,
}: TopMenuBarProps) {
  // Exactly one dropdown open at a time: "system" | "app" | "window" |
  // "help" | "apps" (the desktop Apps dropdown).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [aboutTarget, setAboutTarget] = useState<{
    name: string;
    description: string;
    route?: string;
    icon?: React.ReactNode;
  } | null>(null);

  // Authoritative server clock
  const serverTime = useServerTime();

  // Real user authentication
  const { user, logout } = useAuth();

  // In-process navigation: opens/focuses the window for a route without ever
  // touching the browser URL (provided by the shell's AOSNavigateProvider).
  const aosNavigate = useAOSNavigate();

  // Bilingual manifest labels — Nepali renders when the language toggle is "ne".
  const { lang } = useI18n();
  const pickLabel = useCallback(
    (en: string, ne?: string | null) => (lang === "ne" && ne ? ne : en),
    [lang]
  );

  // Responsive: below 1100px the section menus collapse into a single
  // "Sections" menu and the mode-switcher pill hides.
  const [viewportWidth, setViewportWidth] = useState(1280);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isNarrow = viewportWidth < 1100;

  const closeMenus = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback((id: string) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);
  // macOS drag-across: once a menu is open, hovering another title opens it.
  const hoverMenu = useCallback((id: string) => {
    setOpenMenu((prev) => (prev && prev !== id ? id : prev));
  }, []);
  const runMenuAction = useCallback((fn: () => void) => {
    fn();
    setOpenMenu(null);
  }, []);

  // Escape closes any open menu or dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenMenu(null);
      setIsEditDialogOpen(false);
      setAboutTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Editable topbar quick items (desktop view). Absent setting = defaults.
  const enabledTopbarItems = useMemo(
    () => new Set(topbarItems ?? DEFAULT_TOPBAR_ITEMS),
    [topbarItems]
  );
  const showTopbarItem = useCallback(
    (id: string) => enabledTopbarItems.has(id),
    [enabledTopbarItems]
  );
  const toggleTopbarItem = useCallback(
    (id: string) => {
      if (!onChangeTopbarItems) return;
      const next = EDITABLE_TOPBAR_ITEMS.map((e) => e.id).filter((eid) =>
        eid === id ? !enabledTopbarItems.has(eid) : enabledTopbarItems.has(eid)
      );
      onChangeTopbarItems(next);
    },
    [onChangeTopbarItems, enabledTopbarItems]
  );

  // Dynamic section menus from plugin manifests — group modules by their
  // manifest section (desktop view only). Manifest Nepali labels render
  // when the i18n language is "ne".
  const sectionMenus = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const item of sidebarItems || []) {
      const section = item.section;
      if (!section || section === "bottom_nav") continue;
      const list = groups.get(section) || [];
      list.push({ id: item.slug, name: pickLabel(item.label, item.label_nepali) });
      groups.set(section, list);
    }
    return [...groups.entries()]
      .map(([name, apps]) => ({ name, apps }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sidebarItems, pickLabel]);

  // The focused window and its manifest entry — these drive the macOS-style
  // focused-app menus (Navigate / Window / Help).
  const activeWindow = useMemo(
    () => (windows || []).find((w) => w.id === activeWindowId) || null,
    [windows, activeWindowId]
  );

  const activeModule = useMemo(() => {
    if (!activeWindow) return null;
    const targetId = normalizeAOSModuleId(
      activeWindow.moduleId || activeWindow.id,
      activeWindow.route
    );
    const items = sidebarItems || [];
    const byId = targetId
      ? items.find(
          (it) => normalizeAOSModuleId(it.slug, it.route || undefined) === targetId
        )
      : undefined;
    const item =
      byId ||
      items.find(
        (it) =>
          it.route &&
          activeWindow.route &&
          it.route.split("?")[0] === activeWindow.route.split("?")[0]
      );
    return item ? { item, moduleId: targetId || item.slug } : null;
  }, [activeWindow, sidebarItems]);

  const appName =
    pickLabel(activeModule?.item.label || "", activeModule?.item.label_nepali) ||
    activeWindow?.title ||
    "AOS";

  // Navigate menu entries: the module hub itself plus the manifest's
  // sub-pages (deduped by route path). Nepali subitem labels render when
  // the i18n language is "ne".
  const navigateMenuEntries = useMemo(() => {
    if (!activeModule) return [];
    const hubRoute = activeModule.item.route || `/dashboard/${activeModule.moduleId}`;
    const entries: Array<{ label: string; route: string }> = [
      { label: `${appName} Home`, route: hubRoute },
    ];
    const seen = new Set([hubRoute.split("?")[0]]);
    for (const sub of activeModule.item.subitems || []) {
      if (!sub.route) continue;
      const path = sub.route.split("?")[0];
      if (seen.has(path)) continue;
      seen.add(path);
      entries.push({ label: pickLabel(sub.label, sub.label_nepali), route: sub.route });
    }
    return entries;
  }, [activeModule, appName, pickLabel]);

  const openWindows = useMemo(
    () => (windows || []).filter((w) => w.isOpen !== false),
    [windows]
  );

  const navigateToRoute = useCallback(
    (route: string, fallbackAppId?: string) => {
      if (aosNavigate) {
        aosNavigate(route);
      } else if (fallbackAppId) {
        onOpenApp(fallbackAppId);
      }
    },
    [aosNavigate, onOpenApp]
  );

  const heightPx = topBarHeight === "large" ? 38 : topBarHeight === "compact" ? 26 : 30;
  const fontSizePx = topBarHeight === "large" ? "14px" : topBarHeight === "compact" ? "12px" : "13px";
  const dropdownTop = heightPx + 2;

  // Derive user info
  const effectiveRole = (user?.role || currentRole || "student").toLowerCase();
  const userName = user?.full_name || "User";
  const roleLabel = effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1);
  const badgeColor = ROLE_COLORS[effectiveRole] || "#0284c7";

  const timeStr = useMemo(() => {
    const d = serverTime ? new Date(serverTime.epochMs) : new Date();
    return (
      d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      "  " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    );
  }, [serverTime]);

  const handleLogout = () => {
    try {
      logout();
    } catch {
      window.location.href = "/login";
    }
  };

  const aboutWorkstation = () =>
    alert(
      `AOS (A School OS) Version 3.4.0\nAcademic Kernel 16.3\n(C) 2026 AOS Educational Foundation\nActive User: ${userName} (${roleLabel})`
    );

  const openAboutModule = () => {
    setAboutTarget({
      name: appName,
      description: activeModule?.item.section
        ? `${activeModule.item.section} module • ASchool OS`
        : "ASchool OS module",
      route:
        activeWindow?.route ||
        activeModule?.item.route ||
        undefined,
      icon: activeWindow?.icon,
    });
  };

  return (
    <div
      className="macos-menubar"
      style={{ height: `${heightPx}px`, fontSize: fontSizePx }}
      onClick={closeMenus}
    >
      {/* Left area: AOS system menu + focused app menus (or the desktop's
          minimal "Finder-like" set when no window is focused). */}
      <div className="menubar-left">
        {/* AOS System ("Apple") Menu */}
        <div
          className={`menubar-apple ${openMenu === "system" ? "is-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu("system");
          }}
          onMouseEnter={() => hoverMenu("system")}
          title="AOS System Menu"
          style={{ position: "relative" }}
        >
          <AOSLogo size={18} />
          {openMenu === "system" && (
            <MenuDropdown top={dropdownTop} minWidth={250}>
              <MenuRow label="About This Workstation" onClick={() => runMenuAction(aboutWorkstation)} />
              {onOpenRoleSwitcher && (
                <MenuRow
                  label="Switch School User..."
                  hint={effectiveRole.toUpperCase()}
                  hintColor={badgeColor}
                  onClick={() => runMenuAction(onOpenRoleSwitcher)}
                />
              )}
              <MenuRow
                label="System & Desktop Settings..."
                onClick={() => runMenuAction(() => onOpenApp("settings"))}
              />
              <MenuSeparator />
              <MenuRow
                label="Edit Menu Bar..."
                disabled={!onChangeTopbarItems}
                onClick={() => runMenuAction(() => setIsEditDialogOpen(true))}
              />
              <MenuSeparator />
              <MenuRow
                label="Lock Station (Exam Mode)"
                onClick={() => runMenuAction(() => alert("Station locked into Exam Proctoring Mode."))}
              />
              <MenuRow
                label={`Log Out ${userName}`}
                danger
                onClick={() => runMenuAction(handleLogout)}
              />
              <MenuRow
                label="Restart Workstation..."
                danger
                onClick={() => runMenuAction(() => alert("Restarting AOS workstation..."))}
              />
            </MenuDropdown>
          )}
        </div>

        {activeWindow ? (
          <>
            {/* Focused app name (bold) — its dropdown is the Navigate menu:
                the module hub plus the manifest's sub-pages. */}
            {navigateMenuEntries.length > 0 ? (
              <div
                className={`menubar-item ${openMenu === "app" ? "is-active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu("app");
                }}
                onMouseEnter={() => hoverMenu("app")}
                title={`${appName} — module pages`}
                style={{ position: "relative", fontWeight: 700 }}
              >
                {appName}
                {openMenu === "app" && (
                  <MenuDropdown top={dropdownTop} minWidth={240}>
                    {navigateMenuEntries.map((entry) => (
                      <MenuRow
                        key={entry.route}
                        label={entry.label}
                        onClick={() =>
                          runMenuAction(() =>
                            navigateToRoute(entry.route, activeModule?.moduleId)
                          )
                        }
                      />
                    ))}
                  </MenuDropdown>
                )}
              </div>
            ) : (
              <span className="menubar-app-title" title="Active window">
                {appName}
              </span>
            )}

            {/* Window menu: active-window ops + every open window. */}
            <div
              className={`menubar-item ${openMenu === "window" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu("window");
              }}
              onMouseEnter={() => hoverMenu("window")}
              title="Window"
              style={{ position: "relative" }}
            >
              Window
              {openMenu === "window" && (
                <MenuDropdown top={dropdownTop} minWidth={250}>
                  <MenuRow
                    label="Minimize"
                    hint="⌘M"
                    disabled={!activeWindow || !onMinimizeActive}
                    onClick={() => runMenuAction(() => onMinimizeActive?.())}
                  />
                  <MenuRow
                    label="Zoom"
                    disabled={!activeWindow || !onMaximizeActive}
                    onClick={() => runMenuAction(() => onMaximizeActive?.())}
                  />
                  <MenuSeparator />
                  <MenuRow
                    label="Close"
                    hint="⌘W"
                    disabled={!activeWindow || !onCloseActive}
                    onClick={() => runMenuAction(() => onCloseActive?.())}
                  />
                  <MenuSeparator />
                  {openWindows.length === 0 ? (
                    <MenuRow label="No Open Windows" disabled />
                  ) : (
                    openWindows.map((w) => (
                      <MenuRow
                        key={w.id}
                        label={w.title}
                        hint={w.isMinimized ? "minimized" : undefined}
                        checked={w.id === activeWindowId}
                        onClick={() => runMenuAction(() => onFocusWindow?.(w.id))}
                      />
                    ))
                  )}
                </MenuDropdown>
              )}
            </div>

            {/* Help menu */}
            <div
              className={`menubar-item ${openMenu === "help" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu("help");
              }}
              onMouseEnter={() => hoverMenu("help")}
              title="Help"
              style={{ position: "relative" }}
            >
              Help
              {openMenu === "help" && (
                <MenuDropdown top={dropdownTop} minWidth={230}>
                  <MenuRow
                    label={`About ${appName}...`}
                    onClick={() => runMenuAction(openAboutModule)}
                  />
                  <MenuSeparator />
                  <MenuRow
                    label="About AOS Workstation..."
                    onClick={() => runMenuAction(aboutWorkstation)}
                  />
                </MenuDropdown>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Desktop (Finder-like) state — exactly three items after the
                logo: "AOS", one Apps dropdown (pinned quick links + every
                module section as a grouped list), and Widgets. This keeps
                the menubar at ≤4 top-level items in any mode. */}
            <span className="menubar-app-title">AOS</span>

            {/* Apps: one dropdown holding the pinned quick links (Dashboard,
                Vault, Store) and every module section as grouped headers with
                their apps beneath. The topbar_items setting controls what
                appears INSIDE this dropdown. */}
            <div
              className={`menubar-item ${openMenu === "apps" ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu("apps");
              }}
              onMouseEnter={() => hoverMenu("apps")}
              style={{ position: "relative", display: "flex", alignItems: "center", gap: "5px" }}
              title="All AOS apps and quick links"
            >
              <LayoutGrid size={13} />
              <span>Apps</span>
              <ChevronDown size={11} />
              {openMenu === "apps" && (
                <MenuDropdown top={dropdownTop} minWidth={280}>
                  {/* Pinned quick links — always-on Dashboard, plus the
                      user-toggled Vault / Store shortcuts. */}
                  <MenuRow
                    label="Dashboard"
                    onClick={() => runMenuAction(() => onOpenApp("dashboard"))}
                  />
                  {showTopbarItem("vault") && (
                    <MenuRow
                      label="Vault"
                      onClick={() => runMenuAction(() => onOpenApp("filemanager"))}
                    />
                  )}
                  {showTopbarItem("store") && (
                    <MenuRow
                      label="Store"
                      onClick={() => runMenuAction(() => onOpenApp("appstore"))}
                    />
                  )}

                  {/* Every module section as a grouped header with its apps
                      beneath (user-toggled via topbar_items: sections). */}
                  {showTopbarItem("sections") &&
                    sectionMenus.length > 0 &&
                    sectionMenus.map((section, i) => (
                      <React.Fragment key={section.name}>
                        {i > 0 && <MenuSeparator />}
                        <MenuRow label={section.name} isHeader />
                        {section.apps.map((app) => (
                          <MenuRow
                            key={app.id}
                            label={app.name}
                            onClick={() => runMenuAction(() => onOpenApp(app.id))}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                </MenuDropdown>
              )}
            </div>

            {/* Widgets board toggle (user-toggled via topbar_items). */}
            {showTopbarItem("widgets") && (
              <span
                className="menubar-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWidgets();
                }}
              >
                Widgets
              </span>
            )}
          </>
        )}
      </div>

      {/* Right area: status & tray — decluttered to fullscreen, mode pill,
          language, role badge, control center, notifications, clock. */}
      <div className="menubar-right">
        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <div
            className="menubar-action-icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </div>
        )}

        {/* Two-Mode Switcher Toggle Pill (hidden on narrow viewports) */}
        {onToggleSystemMode && !isNarrow && (
          <div
            className="aos-mode-switcher-pill"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSystemMode();
            }}
            title={`Current: ${systemMode.toUpperCase()} Mode. Click to switch to ${systemMode === "desktop" ? "Mobile (iOS)" : "Desktop"} mode`}
          >
            {systemMode === "desktop" ? <Smartphone size={12} /> : <Monitor size={12} />}
            <span>{systemMode === "desktop" ? "iOS Mobile View" : "Desktop Mode"}</span>
          </div>
        )}

        {/* Language Switcher */}
        <LanguageToggle />

        {/* User Role Badge */}
        <div
          className="menubar-pill role-badge"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenRoleSwitcher) onOpenRoleSwitcher();
          }}
          title="Click to switch School Role"
          style={{
            background: `${badgeColor}22`,
            borderColor: `${badgeColor}50`,
            color: badgeColor,
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: badgeColor }} />
          <span>{userName} ({roleLabel})</span>
          {onOpenRoleSwitcher && <ChevronDown size={12} />}
        </div>

        {/* Control Center Toggle */}
        <div
          className="menubar-action-icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleControlCenter();
          }}
          title="AOS Control Center"
        >
          <Sliders size={14} />
        </div>

        {/* Notifications Center Toggle */}
        <div
          className="menubar-action-icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotifications();
          }}
          title="Notification Center"
          style={{ position: "relative" }}
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "1px",
                right: "1px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 4px #ef4444",
              }}
            />
          )}
        </div>

        {/* Clock */}
        <div
          className="menubar-clock"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotifications();
          }}
          title="Calendar & Notifications"
        >
          {timeStr || "Mon Sep 12 10:48 AM"}
        </div>
      </div>

      {/* Edit Menu Bar dialog (opened from the AOS system menu) */}
      {isEditDialogOpen && (
        <ModalDialog
          title="Edit Menu Bar"
          icon={<LayoutGrid size={18} style={{ color: "var(--w11-accent)" }} />}
          onClose={() => setIsEditDialogOpen(false)}
          footer={
            <>
              <button
                className="subtle"
                style={{ fontSize: "12px" }}
                disabled={!onChangeTopbarItems}
                onClick={() => onChangeTopbarItems?.([...DEFAULT_TOPBAR_ITEMS])}
              >
                Reset to Defaults
              </button>
              <button
                className="accent"
                style={{ fontSize: "12px" }}
                onClick={() => setIsEditDialogOpen(false)}
              >
                Done
              </button>
            </>
          }
        >
          <p style={{ margin: "0 0 12px" }}>
            Choose what appears inside the Apps menu while on the desktop — the
            Vault and Store quick links, and the module sections grouped beneath
            them. The Widgets toggle lives in the menu bar itself, and a focused
            app always takes over the menu bar with its own menus.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {EDITABLE_TOPBAR_ITEMS.map((entry) => {
              const enabled = enabledTopbarItems.has(entry.id);
              return (
                <label
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: onChangeTopbarItems ? "pointer" : "default",
                    background: "var(--w11-card-bg)",
                    border: "1px solid var(--w11-border-subtle)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!onChangeTopbarItems}
                    onChange={() => toggleTopbarItem(entry.id)}
                    style={{ accentColor: "var(--w11-accent)", marginTop: "2px" }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        color: "var(--w11-text-primary)",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      {entry.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--w11-text-tertiary)",
                      }}
                    >
                      {entry.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </ModalDialog>
      )}

      {/* About-module dialog (from the Help menu) */}
      {aboutTarget && (
        <ModalDialog
          title={`About ${aboutTarget.name}`}
          onClose={() => setAboutTarget(null)}
          footer={
            <button
              className="accent"
              style={{ fontSize: "12px" }}
              onClick={() => setAboutTarget(null)}
            >
              OK
            </button>
          }
        >
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            {aboutTarget.icon && <div style={{ flexShrink: 0 }}>{aboutTarget.icon}</div>}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "var(--w11-text-primary)",
                  fontWeight: 700,
                  fontSize: "15px",
                }}
              >
                {aboutTarget.name}
              </div>
              <div style={{ marginTop: "2px" }}>{aboutTarget.description}</div>
              {aboutTarget.route && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "var(--w11-text-tertiary)",
                    wordBreak: "break-all",
                  }}
                >
                  {aboutTarget.route}
                </div>
              )}
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
