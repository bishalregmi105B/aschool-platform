"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { RoleRouteGuard } from "@/components/portal/role-route-guard";

const NAV = [
  { href: "/teacher", label: "Today", labelNe: "आज" },
  { href: "/teacher/attendance", label: "Attendance", labelNe: "उपस्थिति" },
  { href: "/teacher/marks", label: "Marks", labelNe: "अंक" },
  { href: "/teacher/assignments", label: "Assignments", labelNe: "असाइनमेन्ट" },
  { href: "/teacher/timetable", label: "Timetable", labelNe: "समयतालिका" },
  { href: "/teacher/notices", label: "Notices", labelNe: "सूचना" },
  { href: "/teacher/ai-tools", label: "AI Tools", labelNe: "एआई उपकरण" },
  { href: "/teacher/attendance/leave-requests", label: "My Leave", labelNe: "बिदा" },
];

/** Teacher portal shell — one responsive chrome for all staff surfaces (8.23). */
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRoles={["teacher"]}>
      <PortalChrome title="Teacher Portal" nav={NAV}>
        {children}
      </PortalChrome>
    </RoleRouteGuard>
  );
}
