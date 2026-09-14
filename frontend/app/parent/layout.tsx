"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";

const NAV = [
  { href: "/parent", label: "Home" },
  { href: "/parent/attendance", label: "Attendance" },
  { href: "/parent/results", label: "Results" },
  { href: "/parent/fees", label: "Fees" },
  { href: "/parent/notices", label: "Notices" },
  { href: "/parent/bus", label: "Bus" },
  { href: "/parent/conferences", label: "Conferences" },
  { href: "/parent/chat", label: "Messages" },
  { href: "/parent/health", label: "Health" },
  { href: "/parent/wellbeing", label: "Wellbeing" },
];

/** Parent portal shell — shared responsive chrome (was a desktop-only nav). */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <PortalChrome title="Parent Portal" nav={NAV}>
      {children}
    </PortalChrome>
  );
}
