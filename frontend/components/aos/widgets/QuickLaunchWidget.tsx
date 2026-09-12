"use client";

import {
  GraduationCap,
  UserCog,
  ClipboardList,
  Receipt,
  Bell,
  FileCheck2,
  CalendarDays,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { DataPanel } from "@/components/aos/kit/page-kit";
import { WidgetLink, type AOSWidgetProps } from "./shared";

/** The eight core modules — one-click jumps into each. */
const QUICK_LAUNCH: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Students", href: "/dashboard/students", icon: GraduationCap },
  { label: "Teachers", href: "/dashboard/teachers", icon: UserCog },
  { label: "Attendance", href: "/dashboard/attendance", icon: ClipboardList },
  { label: "Fees", href: "/dashboard/fees", icon: Receipt },
  { label: "Notices", href: "/dashboard/notices", icon: Bell },
  { label: "Exams", href: "/dashboard/exams", icon: FileCheck2 },
  { label: "Timetable", href: "/dashboard/timetable", icon: CalendarDays },
  { label: "Academics", href: "/dashboard/academics", icon: BookOpen },
];

/**
 * quick-launch — static grid of the eight core module tiles. No data to
 * fetch, so there is no loading/error state; each tile is a real anchor the
 * AOS WindowManager turns into a window click.
 */
export default function QuickLaunchWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const tiles = compact ? QUICK_LAUNCH.slice(0, 6) : QUICK_LAUNCH;

  return (
    <DataPanel title="Quick Launch">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((item) => (
          <WidgetLink
            key={item.href}
            href={item.href}
            onOpenRoute={onOpenRoute}
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--w11-radius-md)] border border-[color:var(--w11-border-subtle)] p-3 text-center text-[12px] font-medium transition-colors hover:border-[color:var(--w11-accent)] hover:bg-[color:var(--w11-accent-light)]"
            style={{ color: "var(--w11-text-primary)" }}
          >
            <item.icon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
            {item.label}
          </WidgetLink>
        ))}
      </div>
    </DataPanel>
  );
}
