"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo } from "react";
import {
  LayoutDashboard,
  DollarSign,
  ClipboardCheck,
  CalendarDays,
  Bell,
  BellRing,
  HardDrive,
  Rocket,
  Puzzle,
  LineChart,
  BarChart3,
  BookOpen,
  Bus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAcceptablePluginSlugs } from "@/lib/plugin-aliases";
import type { AOSWidgetProps } from "./shared";
import KpiOverviewWidget from "./KpiOverviewWidget";
import FeeSummaryWidget from "./FeeSummaryWidget";
import AttendanceTodayWidget from "./AttendanceTodayWidget";
import TodayScheduleWidget from "./TodayScheduleWidget";
import RecentNoticesWidget from "./RecentNoticesWidget";
import NotificationsWidget from "./NotificationsWidget";
import StorageWidget from "./StorageWidget";
import QuickLaunchWidget from "./QuickLaunchWidget";
import PluginWidgetsWidget from "./PluginWidgetsWidget";
import FeesCollectionChartWidget from "./FeesCollectionChartWidget";
import AttendanceWeekWidget from "./AttendanceWeekWidget";
import LibraryCheckoutsWidget from "./LibraryCheckoutsWidget";
import TransportLiveWidget from "./TransportLiveWidget";

/**
 * AOS home-widget registry.
 *
 * One place declares every widget the user can put on their dashboard board or
 * desktop widget column: its key (persisted in /auth/aos-settings
 * home_widgets), presentation metadata for the "Add widget" picker, the
 * availability gating (system vs plugin scope + optional role restriction),
 * and the component that renders it. The board (HomeWidgetBoard), the desktop
 * widget column and the WidgetsPanel flyout all read from here — nothing else
 * hardcodes widgets.
 */

/** Resizable widget widths (desktop column; board maps s/m/l to 1/2/3 cols). */
export type AOSWidgetSize = "s" | "m" | "l";

export const WIDGET_SIZE_ORDER: readonly AOSWidgetSize[] = ["s", "m", "l"];

/** Desktop widget-column pixel widths per size. */
export const WIDGET_SIZE_WIDTHS: Record<AOSWidgetSize, number> = {
  s: 300,
  m: 460,
  l: 620,
};

/** Next size in the s → m → l → s cycle. */
export function nextWidgetSize(size: AOSWidgetSize): AOSWidgetSize {
  const index = WIDGET_SIZE_ORDER.indexOf(size);
  return WIDGET_SIZE_ORDER[(index + 1) % WIDGET_SIZE_ORDER.length];
}

/** The size a widget uses before the user customizes it (from defaultSpan). */
export function defaultWidgetSize(widget: AOSWidgetDefinition): AOSWidgetSize {
  if (widget.defaultSpan >= 3) return "l";
  if (widget.defaultSpan === 2) return "m";
  return "s";
}

export interface AOSWidgetDefinition {
  /** Persisted identifier (stored in AOSUserSettings.home_widgets). */
  key: string;
  /** Card title shown in the picker and edit chrome. */
  title: string;
  /** One sentence explaining what the widget shows (picker card body). */
  description: string;
  icon: ReactNode;
  /**
   * Where the widget comes from:
   * - "system" — ships with AOS, available to everyone (role permitting);
   * - { plugin } — only usable while that plugin is installed (and active).
   */
  scope: "system" | { plugin: string };
  /** Roles allowed to add the widget; undefined = every role. */
  roles?: string[];
  /** Grid columns the widget spans on a wide board. */
  defaultSpan: 1 | 2 | 3;
  Component: ComponentType<AOSWidgetProps>;
}

export const AOS_WIDGETS: AOSWidgetDefinition[] = [
  {
    key: "kpi-overview",
    title: "KPI Overview",
    description: "Students, staff, fees, attendance and events — with trend charts.",
    icon: <LayoutDashboard className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    roles: ["school_admin", "superadmin", "accountant"],
    defaultSpan: 3,
    Component: KpiOverviewWidget,
  },
  {
    key: "fee-summary",
    title: "Fee Summary",
    description: "Collection rate ring with expected vs collected and outstanding.",
    icon: <DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />,
    scope: "system",
    roles: ["school_admin", "superadmin", "accountant"],
    defaultSpan: 1,
    Component: FeeSummaryWidget,
  },
  {
    key: "attendance-today",
    title: "Attendance Today",
    description: "Present, absent and late counts with marking progress.",
    icon: <ClipboardCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    roles: ["school_admin", "superadmin", "teacher"],
    defaultSpan: 1,
    Component: AttendanceTodayWidget,
  },
  {
    key: "today-schedule",
    title: "Today's Schedule",
    description: "Teachers: your periods today. Admins: upcoming events.",
    icon: <CalendarDays className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    roles: ["school_admin", "superadmin", "teacher"],
    defaultSpan: 1,
    Component: TodayScheduleWidget,
  },
  {
    key: "recent-notices",
    title: "Recent Notices",
    description: "Latest school notices, pinned first.",
    icon: <Bell className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    defaultSpan: 1,
    Component: RecentNoticesWidget,
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Your latest in-app notifications with unread highlighted.",
    icon: <BellRing className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    defaultSpan: 1,
    Component: NotificationsWidget,
  },
  {
    key: "storage",
    title: "Storage",
    description: "File storage usage broken down by type.",
    icon: <HardDrive className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    roles: ["school_admin", "superadmin", "teacher"],
    defaultSpan: 1,
    Component: StorageWidget,
  },
  {
    key: "quick-launch",
    title: "Quick Launch",
    description: "One-click tiles for the eight core modules.",
    icon: <Rocket className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    defaultSpan: 2,
    Component: QuickLaunchWidget,
  },
  {
    key: "plugin-widgets",
    title: "Plugin Widgets",
    description: "Dashboard cards contributed by your installed plugins.",
    icon: <Puzzle className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: "system",
    defaultSpan: 3,
    Component: PluginWidgetsWidget,
  },
  {
    key: "fees-collection-chart",
    title: "Fee Collection Trend",
    description: "Monthly collected vs pending fee amounts over the last 6 months.",
    icon: <LineChart className="h-4 w-4" style={{ color: "#d83b01" }} />,
    scope: { plugin: "fees" },
    roles: ["school_admin", "superadmin", "accountant"],
    defaultSpan: 2,
    Component: FeesCollectionChartWidget,
  },
  {
    key: "attendance-week",
    title: "Attendance This Week",
    description: "Daily attendance rate for the last 7 days.",
    icon: <BarChart3 className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: { plugin: "attendance" },
    roles: ["school_admin", "superadmin", "teacher"],
    defaultSpan: 2,
    Component: AttendanceWeekWidget,
  },
  {
    key: "library-checkouts",
    title: "Library Checkouts",
    description: "Active checkouts, overdue books and the latest issues.",
    icon: <BookOpen className="h-4 w-4" style={{ color: "#107c10" }} />,
    scope: { plugin: "library_management" },
    defaultSpan: 1,
    Component: LibraryCheckoutsWidget,
  },
  {
    key: "transport-live",
    title: "Transport Today",
    description: "Active buses, GPS coverage and today's upcoming trips.",
    icon: <Bus className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    scope: { plugin: "gps_tracking" },
    defaultSpan: 1,
    Component: TransportLiveWidget,
  },
];

const WIDGETS_BY_KEY = new Map(AOS_WIDGETS.map((widget) => [widget.key, widget]));

const ADMIN_ROLES = new Set(["school_admin", "superadmin"]);

export function getWidgetDefinition(key: string): AOSWidgetDefinition | undefined {
  return WIDGETS_BY_KEY.get(key);
}

/**
 * Strict availability: a system widget needs only its role (if restricted);
 * a plugin widget additionally requires the plugin to be installed+active.
 * `installedSlugs` accepts raw plugin slugs (aliases are resolved here).
 */
export function isWidgetAvailable(
  widget: AOSWidgetDefinition,
  role: string | undefined,
  installedSlugs?: string[]
): boolean {
  if (widget.scope !== "system") {
    if (!installedSlugs || installedSlugs.length === 0) return false;
    const acceptable = getAcceptablePluginSlugs(widget.scope.plugin);
    if (!installedSlugs.some((slug) => acceptable.has(slug))) return false;
  }
  if (!widget.roles) return true;
  if (!role) return false;
  return widget.roles.includes(role);
}

/** Backwards-compatible name for system widgets (no plugin dependency). */
export function isWidgetAvailableForRole(
  widget: AOSWidgetDefinition,
  role: string | undefined,
  installedSlugs?: string[]
): boolean {
  return isWidgetAvailable(widget, role, installedSlugs);
}

/** Every widget the given role + installed plugin set is allowed to place. */
export function getAvailableWidgets({
  role,
  installedSlugs,
}: {
  role: string | undefined;
  installedSlugs?: string[];
}): AOSWidgetDefinition[] {
  return AOS_WIDGETS.filter((widget) => isWidgetAvailable(widget, role, installedSlugs));
}

/** Role-only availability (system widgets always resolve; plugin widgets need slugs). */
export function getWidgetsForRole(
  role: string | undefined,
  installedSlugs?: string[]
): AOSWidgetDefinition[] {
  return getAvailableWidgets({ role, installedSlugs });
}

/**
 * Role-appropriate default board (used when home_widgets is empty — a fresh
 * user or one who reset the board). Only system widgets — plugin widgets are
 * opt-in once their plugin is installed.
 */
export function getDefaultHomeWidgets(role: string | undefined): string[] {
  if (role && ADMIN_ROLES.has(role)) {
    return ["kpi-overview", "fee-summary", "attendance-today", "recent-notices", "quick-launch"];
  }
  if (role === "teacher") {
    return ["today-schedule", "attendance-today", "recent-notices", "quick-launch"];
  }
  return ["recent-notices", "notifications", "quick-launch"];
}

/**
 * Sanitize a persisted board: keep order, drop unknown keys and widgets the
 * current role may not use (or whose plugin is no longer installed), and fall
 * back to the role's defaults when the result would be empty.
 */
export function normalizeHomeWidgets(
  keys: string[] | undefined,
  role: string | undefined,
  installedSlugs?: string[]
): string[] {
  const persisted = (keys ?? []).filter((key) => {
    const widget = WIDGETS_BY_KEY.get(key);
    return widget !== undefined && isWidgetAvailable(widget, role, installedSlugs);
  });
  return persisted.length > 0 ? persisted : getDefaultHomeWidgets(role);
}

/**
 * Resolved widget availability for the signed-in user: role from auth,
 * installed plugin slugs from the plugin context (installed plugins ∪
 * sidebar-visible plugins). One hook for the board, the desktop column and
 * pickers so gating can never drift between surfaces.
 */
export function useWidgetAvailability(): {
  role: string | undefined;
  installedSlugs: string[];
  availableWidgets: AOSWidgetDefinition[];
} {
  const { user } = useAuth();
  const role = user?.role;
  const { installedPlugins, sidebarItems } = useInstalledPlugins();

  const installedSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const plugin of installedPlugins) {
      if (plugin.plugin_slug) slugs.add(plugin.plugin_slug);
    }
    // Sidebar visibility doubles as "installed" — the manifest only lists
    // modules the school actually has.
    for (const item of sidebarItems) {
      if (item.slug) slugs.add(item.slug);
    }
    return Array.from(slugs);
  }, [installedPlugins, sidebarItems]);

  const availableWidgets = useMemo(
    () => getAvailableWidgets({ role, installedSlugs }),
    [role, installedSlugs]
  );

  return { role, installedSlugs, availableWidgets };
}
