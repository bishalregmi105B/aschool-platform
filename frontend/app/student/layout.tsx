"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";

const NAV = [
  { href: "/student", label: "Today" },
  { href: "/student/timetable", label: "Timetable" },
  { href: "/student/homework", label: "Homework" },
  { href: "/student/results", label: "Results" },
  { href: "/student/library", label: "Library" },
  { href: "/student/elibrary", label: "E-Library" },
  { href: "/student/lms", label: "LMS" },
  { href: "/student/ai-tutor", label: "AI Tutor" },
];

/** Student portal shell — same chrome as the parent/teacher portals (44.2/39). */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <PortalChrome title="Student Portal" nav={NAV}>
      {children}
    </PortalChrome>
  );
}
