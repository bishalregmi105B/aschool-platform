/**
 * Component-widget registry — the escape hatch, kept compile-time.
 *
 * `renderer: spec` widgets need no frontend code. `renderer: component` ones
 * name a TOKEN here (`"exams/MarksGrid"`), never an import path, so a plugin can
 * never make the host load arbitrary code: the token either exists in this
 * bundle or the widget renders a plain "not available in this app version"
 * notice. That is the whole security model, and it is why module federation was
 * rejected — a school-management dashboard should not be able to execute code
 * shipped by a third-party plugin author at runtime.
 *
 * Adding a component widget is therefore a deliberate host change: add the
 * component, register its token here, and declare the same token in the plugin's
 * `ui/index.web.json` (the contract validator cross-checks the two).
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { WidgetSpec } from "./types";

export interface ComponentWidgetProps {
  widget: WidgetSpec;
  context?: Record<string, string | number | null | undefined>;
  /** Per-school widget config from `SchoolPlugin.config`. */
  config?: Record<string, unknown>;
}

/**
 * Token → component. Loaded lazily so a heavy canvas widget costs nothing on a
 * dashboard that does not place it.
 */
export const COMPONENT_WIDGETS: Record<
  string,
  ComponentType<ComponentWidgetProps>
> = {
  // Declared by modules/exams/widgets.yaml (marks_entry_grid). The grid is a
  // keyboard-first spreadsheet with per-cell validation — not expressible as a
  // declarative spec, which is exactly what this registry is for.
  "exams/MarksGrid": dynamic(
    () => import("@/components/plugin-widgets/components/MarksGridWidget"),
    { ssr: false }
  ),
};

export function resolveComponentWidget(
  token: string | null | undefined
): ComponentType<ComponentWidgetProps> | null {
  if (!token) return null;
  return COMPONENT_WIDGETS[token] ?? null;
}

export function isComponentTokenKnown(token: string): boolean {
  return token in COMPONENT_WIDGETS;
}

/** Every registered token — used by the contract test to catch drift. */
export function registeredComponentTokens(): string[] {
  return Object.keys(COMPONENT_WIDGETS);
}
