"use client";

import { useCallback } from "react";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { GraduationCap, LayoutDashboard, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import { getWidgetDefinition, isWidgetAvailableForRole } from "@/components/aos/widgets/registry";
import KpiOverviewWidget from "@/components/aos/widgets/KpiOverviewWidget";
import TodayScheduleWidget from "@/components/aos/widgets/TodayScheduleWidget";
import RecentNoticesWidget from "@/components/aos/widgets/RecentNoticesWidget";
import NotificationsWidget from "@/components/aos/widgets/NotificationsWidget";

interface WidgetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  /** Optional route opener; defaults to a client-side navigation that the AOS shell converts into a window. */
  onOpenRoute?: (route: string) => void;
}

/** Card chrome for compact widgets that render bare content (KPI strip). */
function FlyoutCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--w11-control-bg)",
        border: "1px solid var(--w11-control-border)",
        borderRadius: "10px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {icon}
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * WidgetsPanel — the AOS widgets flyout (acrylic left panel).
 *
 * Data-driven replacement for the static demo board: real compact widgets
 * from the home-widget registry — (a) a KPI snapshot for roles that can see
 * analytics, (b) today's schedule (teachers) or recent notices, (c) recent
 * notifications. Each widget fetches its own data and handles its own
 * loading/error/empty states.
 */
export default function WidgetsPanel({
  isOpen,
  onClose,
  accentColor = "#0078d4",
  onOpenRoute,
}: WidgetsPanelProps) {
  const router = useAOSRouterNavigate();
  const { user } = useAuth();
  const role = user?.role;

  // Default route opening: client-side navigate so the AOS shell's pathname
  // effect converts the route into a window, then close the flyout.
  const openRoute = useCallback(
    (route: string) => {
      if (onOpenRoute) {
        onOpenRoute(route);
        return;
      }
      onClose();
      router(route);
    },
    [onOpenRoute, onClose, router]
  );

  if (!isOpen) return null;

  const canSeeKpis = isWidgetAvailableForRole(
    getWidgetDefinition("kpi-overview")!,
    role
  );
  const isTeacher = role === "teacher";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9998,
        }}
      />

      <div
        role="dialog"
        aria-label="Widgets"
        style={{
          position: "fixed",
          top: "12px",
          left: "12px",
          bottom: "60px",
          width: "480px",
          maxWidth: "92vw",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(35px) saturate(180%)",
          WebkitBackdropFilter: "blur(35px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "14px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          padding: "20px",
          zIndex: 9999,
          userSelect: "none",
          overflowY: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #0078d4, #005a9e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <GraduationCap size={16} />
            </div>
            <div>
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--w11-text-primary)",
                  display: "block",
                  lineHeight: 1.1,
                }}
              >
                AOS Widgets
              </span>
              <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                {displayBS(new Date().toISOString())} • Live
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close widgets panel"
            style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-secondary)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* (a) KPI snapshot — roles that can see school analytics */}
        {canSeeKpis && (
          <FlyoutCard
            icon={<LayoutDashboard size={16} color={accentColor} />}
            title="School Snapshot"
          >
            <KpiOverviewWidget compact onOpenRoute={openRoute} />
          </FlyoutCard>
        )}

        {/* (b) Today's schedule (teachers) or recent notices */}
        {isTeacher ? (
          <TodayScheduleWidget compact onOpenRoute={openRoute} />
        ) : (
          <RecentNoticesWidget compact onOpenRoute={openRoute} />
        )}

        {/* (c) Recent notifications */}
        <NotificationsWidget compact onOpenRoute={openRoute} />
      </div>
    </>
  );
}
