"use client";

import { Puzzle } from "lucide-react";
import { WidgetSlot } from "@/components/plugin-widgets/PluginWidgetHost";
import { DataPanel } from "@/components/aos/kit/page-kit";
import type { AOSWidgetProps } from "./shared";

/**
 * plugin-widgets — a thin board-level wrapper for the plugin WidgetSlot
 * system. WidgetSlot is self-sufficient (it fetches every installed plugin's
 * widgets for the slot, isolates crashes per widget, and renders its own
 * skeletons), so this widget only arranges the dashboard.main and
 * dashboard.side slots side by side.
 */
export default function PluginWidgetsWidget({ compact = false }: AOSWidgetProps) {
  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <Puzzle className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Plugin Widgets
        </span>
      }
    >
      <div className={compact ? "flex flex-col gap-3" : "grid grid-cols-1 gap-3 lg:grid-cols-2"}>
        <WidgetSlot
          id="dashboard.main"
          grid={false}
          className="flex flex-col gap-3"
          fallback={
            <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
              No plugin widgets are installed yet. Install plugins from the{" "}
              <a
                href="/dashboard/marketplace"
                className="hover:underline"
                style={{ color: "var(--w11-accent)" }}
              >
                marketplace
              </a>{" "}
              and their dashboard cards appear here.
            </p>
          }
        />
        <WidgetSlot id="dashboard.side" grid={false} className="flex flex-col gap-3" />
      </div>
    </DataPanel>
  );
}
