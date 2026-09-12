"use client";

import { ReactNode } from "react";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="win11 min-h-screen"
      style={{ background: "var(--w11-window-bg)" }}
    >
      <header
        style={{
          background: "var(--w11-accent)",
          color: "var(--w11-accent-text)",
          borderBottom: "1px solid var(--w11-border-default)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">ASchool</span>
            <span className="text-sm" style={{ opacity: 0.85 }}>Teacher Portal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/teacher" className="hover:opacity-80">Dashboard</a>
            <a href="/teacher/attendance" className="hover:opacity-80">Attendance</a>
            <a href="/teacher/marks" className="hover:opacity-80">Marks</a>
            <a href="/teacher/assignments" className="hover:opacity-80">Assignments</a>
            <a href="/teacher/timetable" className="hover:opacity-80">Timetable</a>
            <a href="/teacher/notices" className="hover:opacity-80">Notices</a>
            <a href="/teacher/ai-tools" className="hover:opacity-80">AI Tools</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
