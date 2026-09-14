"use client";

import { ReactNode } from "react";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { RoleRouteGuard } from "@/components/portal/role-route-guard";

const NAV = [
  { href: "/student", label: "Today", labelNe: "आज" },
  { href: "/student/timetable", label: "Timetable", labelNe: "समयतालिका" },
  { href: "/student/homework", label: "Homework", labelNe: "गृहकार्य" },
  { href: "/student/exams", label: "Exams", labelNe: "परीक्षा" },
  { href: "/student/results", label: "Results", labelNe: "नतिजा" },
  { href: "/student/fees", label: "My Fees", labelNe: "शुल्क" },
  { href: "/student/notices", label: "Notices", labelNe: "सूचना" },
  { href: "/student/library", label: "Library", labelNe: "पुस्तकालय" },
  { href: "/student/elibrary", label: "E-Library", labelNe: "इ-पुस्तकालय" },
  { href: "/student/lms", label: "LMS", labelNe: "एलएमएस" },
  { href: "/student/ai-tutor", label: "AI Tutor", labelNe: "एआई शिक्षक" },
];

/** Student portal shell — same chrome as the parent/teacher portals (44.2/39). */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRouteGuard allowedRoles={["student"]}>
      <PortalChrome title="Student Portal" nav={NAV}>
        {children}
      </PortalChrome>
    </RoleRouteGuard>
  );
}
