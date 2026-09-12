"use client";

import { LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
} from "@/components/aos/kit/page-kit";
import HomeWidgetBoard from "@/components/aos/widgets/HomeWidgetBoard";

/**
 * The school dashboard — a configurable widget board.
 *
 * The user picks which widgets appear and in what order; the selection is
 * persisted per-user via /auth/aos-settings (home_widgets) and hydrated by
 * HomeWidgetBoard. Widget data comes from real API endpoints through
 * react-query; plugin-contributed widgets are available as the
 * "plugin-widgets" board widget.
 *
 * Route opening: widgets render plain anchors — the AOS WindowManager
 * intercepts anchor clicks (handleInternalAnchorNavigation) and converts
 * them into windows, so no navigation callback is wired here.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<LayoutDashboard className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={`Welcome back, ${user?.full_name?.split(" ")[0] || "Admin"}`}
        subtitle="Your board — the widgets you use most, in the order you want them."
      />
      <AOSPageBody>
        <HomeWidgetBoard />
      </AOSPageBody>
    </AOSPage>
  );
}
