/**
 * Widget spec types — the client-side mirror of `widgets.yaml`.
 *
 * The server hands these through `GET /plugins/widgets` already normalized
 * (`app/plugins/widgets.py::_normalize_widget`), so the client never sees the
 * shorthand forms authors write in YAML.
 */

import type { WidgetFormat } from "./bindings";
import type { StatusTone } from "@/components/ui/status-pill";

export type WidgetType =
  | "stat-group"
  | "dashboard-card"
  | "table-panel"
  | "chart"
  | "list"
  | "form"
  | "detail-drawer"
  | "quick-action"
  | "settings-section"
  | "mobile-card"
  | "website-section";

export type WidgetSurface = "web" | "mobile" | "public_site" | "pdf";

export interface WidgetSlotRef {
  id: string;
  default: boolean;
  order: number;
  params_from?: Record<string, string>;
}

export interface WidgetSize {
  default: { w: number; h: number };
  min: { w: number; h: number };
  breakpoints?: Record<string, { w: number; h: number }>;
}

export interface WidgetDataSource {
  source?: "api" | "socket" | "static" | "aggregate";
  endpoint?: string;
  params?: Record<string, unknown>;
  refresh?: {
    mode?: "none" | "poll" | "socket" | "on_focus";
    interval_s?: number;
    socket_event?: string;
  };
  cache_ttl_s?: number;
  /** Dot-path into the ApiResponse envelope, e.g. `data.class_wise`. */
  select?: string;
  pagination?: {
    mode: "server" | "client";
    page_param?: string;
    size_param?: string;
    default_size?: number;
  };
  sort?: { mode: "server" | "client"; param?: string; default?: string };
  filters?: WidgetFilterSpec[];
}

export interface WidgetFilterSpec {
  key: string;
  type: string;
  label: string;
  label_ne?: string;
  entity?: string;
  calendar?: "bs" | "ad";
  options?: (string | { value: string; label: string })[];
}

export interface StatItemSpec {
  label: string;
  label_i18n?: string;
  value: string;
  format?: WidgetFormat;
  tone?: StatusTone;
  icon?: string;
}

export interface ColumnSpec {
  key: string;
  label: string;
  label_ne?: string;
  sortable?: boolean;
  width?: number;
  align?: "left" | "right" | "center";
  format?: WidgetFormat;
  /** Status → tone overrides for `format: status_pill`. */
  map?: Record<string, StatusTone>;
  /** Interpolated href, e.g. `/dashboard/students/$.student_id`. */
  link?: string;
}

export interface WidgetActionSpec {
  key: string;
  label: string;
  icon?: string;
  tone?: "default" | "success" | "danger";
  requires_permissions?: string[];
  action: {
    kind: "post" | "post_each" | "form" | "link" | "widget";
    endpoint?: string;
    href?: string;
    widget?: string;
    confirm?: boolean;
    confirm_body?: string;
    fields?: { key: string; type: string; label: string; required?: boolean }[];
  };
}

export interface ListItemSpec {
  title: string;
  subtitle?: string;
  meta?: string;
  meta_format?: WidgetFormat;
  timestamp?: string;
  timestamp_format?: WidgetFormat;
  badge?: { value: string; format?: string; map?: Record<string, StatusTone> };
  link?: string;
}

export interface WidgetSpecBody {
  items?: StatItemSpec[];
  link?: { label: string; href: string };
  columns?: ColumnSpec[];
  row_actions?: WidgetActionSpec[];
  bulk_actions?: WidgetActionSpec[];
  export?: { csv?: boolean; print?: boolean };
  item?: ListItemSpec;
  actions?: WidgetActionSpec[];
  chart?: "line" | "bar" | "pie" | "donut" | "heat";
  x?: { key: string; label?: string };
  series?: { key: string; label: string; format?: WidgetFormat; tone?: StatusTone }[];
  sort?: { by: string; direction: "asc" | "desc" };
  icon?: string;
  tone?: StatusTone;
  label?: string;
  label_i18n?: string;
  href?: string;
  mobile_route?: string;
  layout?: string;
  title?: string;
  tap?: { route: string };
  action?: { label: string; route: string; tone?: string };
  /** Max rows a list widget renders (the endpoint may return more). */
  limit?: number;
}

export interface WidgetStateSpec {
  empty?: {
    title: string;
    body?: string;
    action?: { label: string; href?: string };
  };
  error?: { title?: string; retry?: boolean };
  loading?: "skeleton" | "spinner" | "none";
  locked?: { title?: string; cta?: string };
}

export interface WidgetSpec {
  id: string;
  plugin_slug: string;
  key: string;
  title: string;
  title_i18n?: string | null;
  description?: string;
  type: WidgetType;
  renderer: "spec" | "component";
  /** Registry token for `renderer: component`. */
  component?: string | null;
  surfaces: WidgetSurface[];
  slots: WidgetSlotRef[];
  roles: string[];
  requires_permissions: string[];
  requires_plugins: string[];
  size: WidgetSize;
  data: WidgetDataSource;
  spec: WidgetSpecBody;
  config_schema?: { fields?: unknown[] };
  states: WidgetStateSpec;
  telemetry?: { impression?: boolean; click?: boolean };
  section_type?: string | null;
}

export interface WidgetsResponse {
  surface: string;
  slot: string | null;
  role: string;
  widgets: WidgetSpec[];
  default_layout: string[];
}
