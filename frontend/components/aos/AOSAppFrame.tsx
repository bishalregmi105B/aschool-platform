"use client";

/**
 * AOSAppFrame — the universal per-app navigation frame.
 *
 * Every plugin-module window (anything with a manifest sidebar item) gets a
 * macOS/VS Code-style collapsible left drawer: module header, "Home" + the
 * manifest subitems, and an About section. Navigation happens fully
 * in-process via useAOSNavigate() — the browser URL never leaves /dashboard.
 *
 * The frame is a flex row: [drawer][content flex-1 min-w-0]. The page keeps
 * its own AOSPageHeader — the drawer sits LEFT of the content and the
 * content wrapper owns its scroll.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Home, Info, Menu, PanelLeft, PanelRight } from "lucide-react";
import type { WindowInstance } from "./WindowManager";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule, normalizeAOSModuleId } from "@/lib/aos-app-adapter";
import { useAOSNavigate, useAOSWindowRoute } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";
import { ICON_MAP } from "@/lib/icon-map";

const DRAWER_WIDTH = 220;
const COLLAPSED_STORAGE_KEY = "aos-frame-collapsed";

/**
 * Modules that ship their own in-app sidebar/hero navigation — the universal
 * frame would duplicate it, so they opt out.
 */
const SELF_NAV_MODULE_IDS = new Set(["aos-settings", "appstore", "filemanager", "files"]);

/** Should this window's content be wrapped in the universal app frame? */
export function shouldUseAOSAppFrame(moduleId?: string): boolean {
  if (!moduleId) return false;
  const m = moduleId.trim().toLowerCase();
  if (!m) return false;
  if (SELF_NAV_MODULE_IDS.has(m)) return false;
  if (m.startsWith("plugin-")) return false;
  return true;
}

/** Optional per-module version strings for the About dialog. */
const APP_VERSIONS: Record<string, string> = {};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  Academics: "Manage day-to-day academic records, classes and coursework.",
  Learning: "Tools for creating and delivering learning content.",
  Money: "Billing, payments and financial operations.",
  Operations: "Keep school operations running smoothly.",
  Communication: "Reach students, parents and staff.",
  Insights: "Reports and analytics across the school.",
  "Student Life": "Everything around student life on campus.",
  "Safety & Compliance": "Health, safety and compliance tracking.",
  Growth: "Admissions, outreach and school growth.",
  Admin: "Administrative tools for school management.",
};

function stripQuery(route: string): string {
  return String(route || "").split("?")[0].replace(/\/+$/, "");
}

interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: React.ReactNode;
}

export default function AOSAppFrame({
  window: win,
  children,
}: {
  window: WindowInstance;
  children: React.ReactNode;
}) {
  const { sidebarItems } = useInstalledPlugins();
  const navigate = useAOSNavigate();
  const routeInfo = useAOSWindowRoute();
  const { lang } = useI18n();

  const [collapsed, setCollapsed] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Hydrate the persisted collapsed flag + track the narrow viewport.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
    } catch {
      // storage unavailable — keep default
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // The window's manifest sidebar item (slug → normalized module id).
  const moduleItem = useMemo(() => {
    const moduleId = normalizeAOSModuleId(win.moduleId || "", win.route);
    if (!moduleId) return null;
    return (
      sidebarItems.find((item) => normalizeAOSModuleId(item.slug, item.route) === moduleId) ||
      null
    );
  }, [sidebarItems, win.moduleId, win.route]);

  const app = useMemo(
    () => (moduleItem ? getAOSAppForModule(moduleItem, 26) : null),
    [moduleItem]
  );

  const homeRoute = app?.route || moduleItem?.route || `/dashboard/${win.moduleId || win.id}`;
  const moduleLabel =
    lang === "ne" && moduleItem?.label_nepali ? moduleItem.label_nepali : moduleItem?.label || win.title;

  // "Home" (module hub) + every manifest subitem. Subitem Nepali labels are
  // read defensively — manifests may include label_nepali on subitems.
  const navItems = useMemo<NavItem[]>(() => {
    if (!moduleItem) return [];
    const homeIcon = (() => {
      const Comp = (moduleItem.icon && ICON_MAP[moduleItem.icon]) || Home;
      return <Comp size={15} />;
    })();
    const items: NavItem[] = [
      {
        key: "home",
        label: lang === "ne" ? "गृह" : "Home",
        route: homeRoute,
        icon: homeIcon,
      },
    ];
    for (const sub of moduleItem.subitems || []) {
      const nepali = (sub as { label_nepali?: string | null }).label_nepali;
      items.push({
        key: sub.route,
        label: lang === "ne" && nepali ? nepali : sub.label,
        route: sub.route,
        icon: <ChevronRight size={15} />,
      });
    }
    return items;
  }, [moduleItem, homeRoute, lang]);

  const currentPath = stripQuery(routeInfo?.route || win.route || homeRoute);

  const handleNavigate = (route: string) => {
    setOverlayOpen(false);
    navigate?.(route);
  };

  // No manifest entry for this module (or no items at all) — render the page
  // unframed rather than an empty drawer.
  if (!moduleItem || !app) {
    return <>{children}</>;
  }

  const drawerInner = (
    <>
      {/* Drawer header: module identity + collapse toggle */}
      <div
        className="flex items-center gap-2.5"
        style={{
          flexShrink: 0,
          padding: "10px 10px 10px 12px",
          borderBottom: "1px solid var(--w11-border-subtle)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{app.icon}</span>
        <span
          className="truncate"
          title={moduleLabel}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--w11-text-primary)",
          }}
        >
          {moduleLabel}
        </span>
        <button
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="icon-button"
          onClick={toggleCollapsed}
          style={{ width: 24, height: 24, minWidth: 24, color: "var(--w11-text-secondary)" }}
        >
          <PanelLeft size={14} />
        </button>
      </div>

      {/* Nav items */}
      <nav
        className="flex flex-col gap-0.5"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px" }}
      >
        {navItems.map((item) => {
          const isActive = stripQuery(item.route) === currentPath;
          return (
            <button
              key={item.key}
              onClick={() => handleNavigate(item.route)}
              title={item.label}
              className="relative flex items-center gap-2.5 w-full text-left"
              style={{
                padding: "7px 10px",
                borderRadius: "var(--w11-radius-sm)",
                fontSize: "12.5px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--w11-accent)" : "var(--w11-text-primary)",
                background: isActive ? "var(--w11-accent-light)" : "transparent",
                transition: "background var(--w11-transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--w11-control-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 5,
                    bottom: 5,
                    width: 3,
                    borderRadius: 2,
                    background: "var(--w11-accent)",
                  }}
                />
              )}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  color: isActive ? "var(--w11-accent)" : "var(--w11-text-secondary)",
                }}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* About */}
      <div style={{ flexShrink: 0, padding: "8px", borderTop: "1px solid var(--w11-border-subtle)" }}>
        <button
          onClick={() => setAboutOpen(true)}
          className="flex items-center gap-2.5 w-full text-left"
          style={{
            padding: "7px 10px",
            borderRadius: "var(--w11-radius-sm)",
            fontSize: "12.5px",
            color: "var(--w11-text-primary)",
            transition: "background var(--w11-transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--w11-control-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: "var(--w11-text-secondary)" }}>
            <Info size={15} />
          </span>
          <span className="truncate">
            {lang === "ne" ? "बारेमा" : "About"} {moduleLabel}
          </span>
        </button>
      </div>
    </>
  );

  const showInlineDrawer = !isNarrow && !collapsed;
  const version = APP_VERSIONS[app.id] ?? "—";
  const description =
    SECTION_DESCRIPTIONS[app.category] ||
    `${app.name} — part of the ${app.category} suite in ASchool OS.`;

  return (
    <div className="h-full flex relative min-h-0" style={{ minWidth: 0 }}>
      {/* Inline drawer (desktop, expanded) */}
      {showInlineDrawer && (
        <aside
          className="h-full flex flex-col flex-shrink-0"
          style={{
            width: DRAWER_WIDTH,
            background: "var(--w11-mica-alt)",
            borderRight: "1px solid var(--w11-border-subtle)",
          }}
        >
          {drawerInner}
        </aside>
      )}

      {/* Expand toggle when the inline drawer is collapsed on desktop */}
      {!isNarrow && collapsed && (
        <button
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="icon-button"
          onClick={toggleCollapsed}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 30,
            width: 24,
            height: 24,
            minWidth: 24,
            background: "var(--w11-surface)",
            border: "1px solid var(--w11-border-subtle)",
            color: "var(--w11-text-secondary)",
            boxShadow: "var(--w11-elevation-card)",
          }}
        >
          <PanelRight size={14} />
        </button>
      )}

      {/* Narrow viewport: the drawer becomes an overlay opened from the edge */}
      {isNarrow && (
        <button
          aria-label="Open navigation"
          title="Open navigation"
          className="icon-button"
          onClick={() => setOverlayOpen(true)}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 30,
            width: 24,
            height: 24,
            minWidth: 24,
            background: "var(--w11-surface)",
            border: "1px solid var(--w11-border-subtle)",
            color: "var(--w11-text-secondary)",
            boxShadow: "var(--w11-elevation-card)",
          }}
        >
          <Menu size={14} />
        </button>
      )}
      {isNarrow && overlayOpen && (
        <div
          className="absolute inset-0"
          style={{ zIndex: 40 }}
          onClick={() => setOverlayOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
          <aside
            className="flex flex-col"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: DRAWER_WIDTH,
              background: "var(--w11-mica-alt)",
              borderRight: "1px solid var(--w11-border-subtle)",
              boxShadow: "4px 0 20px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {drawerInner}
          </aside>
        </div>
      )}

      {/* Content — keeps its own page header; owns the scroll */}
      <div className="flex-1 min-w-0 min-h-0 overflow-auto relative">{children}</div>

      {/* About dialog — acrylic backdrop scoped to this window */}
      {aboutOpen && (
        <div
          className="absolute inset-0"
          style={{
            zIndex: 50,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="win11-dialog"
            style={{ width: 380, maxWidth: "90%", padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="dialog-header"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 10px" }}
            >
              {getAOSAppForModule(moduleItem, 40).icon}
              <span style={{ fontSize: 16 }}>
                {lang === "ne" ? "बारेमा" : "About"} {moduleLabel}
              </span>
            </div>
            <div
              className="dialog-body"
              style={{ fontSize: 13, padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div className="flex items-center gap-2">
                <span className="win11-chip subtle">{app.category}</span>
                <span
                  className="win11-chip subtle"
                  title={lang === "ne" ? "संस्करण" : "Version"}
                >
                  v{version}
                </span>
              </div>
              <p style={{ lineHeight: 1.55, color: "var(--w11-text-secondary)" }}>{description}</p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 12px",
                  borderRadius: "var(--w11-radius-sm)",
                  background: "var(--w11-control-bg)",
                  border: "1px solid var(--w11-border-subtle)",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--w11-text-tertiary)" }}>
                  {lang === "ne" ? "गृह मार्ग" : "Home route"}
                </span>
                <code style={{ fontFamily: "var(--w11-font-mono)", fontSize: 11.5, color: "var(--w11-text-primary)" }}>
                  {homeRoute}
                </code>
                <span style={{ fontSize: 11, color: "var(--w11-text-tertiary)", marginTop: 4 }}>
                  {lang === "ne" ? "हालको मार्ग" : "Current route"}
                </span>
                <code style={{ fontFamily: "var(--w11-font-mono)", fontSize: 11.5, color: "var(--w11-text-primary)" }}>
                  {routeInfo?.route || homeRoute}
                </code>
              </div>
            </div>
            <div className="dialog-footer" style={{ padding: "12px 20px" }}>
              <button className="win11-btn accent" onClick={() => setAboutOpen(false)}>
                {lang === "ne" ? "बन्द गर्नुहोस्" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
