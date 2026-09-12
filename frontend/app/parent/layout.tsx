"use client";

import { ReactNode } from "react";

export default function ParentLayout({ children }: { children: ReactNode }) {
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
            <span className="text-sm" style={{ opacity: 0.85 }}>Parent Portal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/parent" className="hover:opacity-80">Dashboard</a>
            <a href="/parent/attendance" className="hover:opacity-80">Attendance</a>
            <a href="/parent/results" className="hover:opacity-80">Results</a>
            <a href="/parent/fees" className="hover:opacity-80">Fees</a>
            <a href="/parent/notices" className="hover:opacity-80">Notices</a>
            <a href="/parent/bus" className="hover:opacity-80">Bus Tracker</a>
            <a href="/parent/health" className="hover:opacity-80">Health</a>
            <a href="/parent/wellbeing" className="hover:opacity-80">Wellbeing</a>
            <a href="/parent/conferences" className="hover:opacity-80">PT Conferences</a>
            <a href="/parent/chat" className="hover:opacity-80">Messages</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
