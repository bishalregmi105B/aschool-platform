"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { RoleRouteGuard } from "@/components/portal/role-route-guard";

const NAV = [
  { href: "/parent", label: "Home", labelNe: "गृह" },
  { href: "/parent/attendance", label: "Attendance", labelNe: "उपस्थिति" },
  { href: "/parent/results", label: "Results", labelNe: "नतिजा" },
  { href: "/parent/fees", label: "Fees", labelNe: "शुल्क" },
  { href: "/parent/homework", label: "Homework", labelNe: "गृहकार्य" },
  { href: "/parent/notices", label: "Notices", labelNe: "सूचना" },
  { href: "/parent/bus", label: "Bus", labelNe: "बस" },
  { href: "/parent/conferences", label: "Conferences", labelNe: "भेटघाट" },
  { href: "/parent/chat", label: "Messages", labelNe: "सन्देश" },
  { href: "/parent/health", label: "Health", labelNe: "स्वास्थ्य" },
  { href: "/parent/wellbeing", label: "Wellbeing", labelNe: "कल्याण" },
];

/** Parent portal shell — shared responsive chrome (was a desktop-only nav). */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRoles={["parent"]}>
      <PortalChrome title="Parent Portal" nav={NAV}>
        {children}
      </PortalChrome>
    </RoleRouteGuard>
  );
}
