"use client";

import { ReactNode } from "react";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">ASchool</span>
            <span className="text-blue-200 text-sm">Parent Portal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/parent" className="hover:text-blue-200">Dashboard</a>
            <a href="/parent/attendance" className="hover:text-blue-200">Attendance</a>
            <a href="/parent/results" className="hover:text-blue-200">Results</a>
            <a href="/parent/fees" className="hover:text-blue-200">Fees</a>
            <a href="/parent/notices" className="hover:text-blue-200">Notices</a>
            <a href="/parent/bus" className="hover:text-blue-200">Bus Tracker</a>
            <a href="/parent/chat" className="hover:text-blue-200">Messages</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
