"use client";

import type { ComponentType, ReactNode } from "react";
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
} from "lucide-react";
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

/**
 * AOS home-widget registry.
 *
 * One place declares every widget the user can put on their dashboard board:
 * its key (persisted in /auth/aos-settings home_widgets), presentation
 * metadata for the "Add widget" picker, the roles that may use it, and the
 * component that renders it. The board (HomeWidgetBoard) and the
 * WidgetsPanel flyout both read from here — nothing else hardcodes widgets.
 */
export interface AOSWidgetDefinition {
  /** Persisted identifier (stored in AOSUserSettings.home_widgets). */
  key: string;
  /** Card title shown in the picker and edit chrome. */
  title: string;
  /** One sentence explaining what the widget shows (picker card body). */
  description: string;
  icon: ReactNode;
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
    roles: ["school_admin", "superadmin", "accountant"],
    defaultSpan: 3,
    Component: KpiOverviewWidget,
  },
  {
    key: "fee-summary",
    title: "Fee Summary",
    description: "Collection rate ring with expected vs collected and outstanding.",
    icon: <DollarSign className="h-4 w-4" style={{ color: "#d83b01" }} />,
    roles: ["school_admin", "accountant", "superadmin"],
    defaultSpan: 1,
    Component: FeeSummaryWidget,
  },
  {
    key: "attendance-today",
    title: "Attendance Today",
    description: "Present, absent and late counts with marking progress.",
    icon: <ClipboardCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    roles: ["school_admin", "teacher", "superadmin"],
    defaultSpan: 1,
    Component: AttendanceTodayWidget,
  },
  {
    key: "today-schedule",
    title: "Today's Schedule",
    description: "Teachers: your periods today. Admins: upcoming events.",
    icon: <CalendarDays className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    roles: ["teacher", "school_admin", "superadmin"],
    defaultSpan: 1,
    Component: TodayScheduleWidget,
  },
  {
    key: "recent-notices",
    title: "Recent Notices",
    description: "Latest school notices, pinned first.",
    icon: <Bell className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    defaultSpan: 1,
    Component: RecentNoticesWidget,
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Your latest in-app notifications with unread highlighted.",
    icon: <BellRing className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    defaultSpan: 1,
    Component: NotificationsWidget,
  },
  {
    key: "storage",
    title: "Storage",
    description: "File storage usage broken down by type.",
    icon: <HardDrive className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    defaultSpan: 1,
    Component: StorageWidget,
  },
  {
    key: "quick-launch",
    title: "Quick Launch",
    description: "One-click tiles for the eight core modules.",
    icon: <Rocket className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    defaultSpan: 2,
    Component: QuickLaunchWidget,
  },
  {
    key: "plugin-widgets",
    title: "Plugin Widgets",
    description: "Dashboard cards contributed by your installed plugins.",
    icon: <Puzzle className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
    defaultSpan: 3,
    Component: PluginWidgetsWidget,
  },
];

const WIDGETS_BY_KEY = new Map(AOS_WIDGETS.map((widget) => [widget.key, widget]));

const ADMIN_ROLES = new Set(["school_admin", "superadmin"]);

export function getWidgetDefinition(key: string): AOSWidgetDefinition | undefined {
  return WIDGETS_BY_KEY.get(key);
}

export function isWidgetAvailableForRole(
  widget: AOSWidgetDefinition,
  role: string | undefined
): boolean {
  if (!widget.roles) return true;
  if (!role) return false;
  return widget.roles.includes(role);
}

/** Every widget the given role is allowed to place on their board. */
export function getWidgetsForRole(role: string | undefined): AOSWidgetDefinition[] {
  return AOS_WIDGETS.filter((widget) => isWidgetAvailableForRole(widget, role));
}

/**
 * Role-appropriate default board (used when home_widgets is empty — a fresh
 * user or one who reset the board).
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
 * current role may not use, and fall back to the role's defaults when the
 * result would be empty.
 */
export function normalizeHomeWidgets(
  keys: string[] | undefined,
  role: string | undefined
): string[] {
  const persisted = (keys ?? []).filter(
    (key) => WIDGETS_BY_KEY.has(key) && isWidgetAvailableForRole(WIDGETS_BY_KEY.get(key)!, role)
  );
  return persisted.length > 0 ? persisted : getDefaultHomeWidgets(role);
}
