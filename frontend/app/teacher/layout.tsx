"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";

const NAV = [
  { href: "/teacher", label: "Today" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/marks", label: "Marks" },
  { href: "/teacher/assignments", label: "Assignments" },
  { href: "/teacher/timetable", label: "Timetable" },
  { href: "/teacher/notices", label: "Notices" },
  { href: "/teacher/ai-tools", label: "AI Tools" },
  { href: "/teacher/attendance/leave-requests", label: "My Leave" },
];

/** Teacher portal shell — one responsive chrome for all staff surfaces (8.23). */
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <PortalChrome title="Teacher Portal" nav={NAV}>
      {children}
    </PortalChrome>
  );
}
