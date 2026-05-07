"use client";

import { ReactNode } from "react";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-700 text-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">ASchool</span>
            <span className="text-emerald-200 text-sm">Teacher Portal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/teacher" className="hover:text-emerald-200">Dashboard</a>
            <a href="/teacher/attendance" className="hover:text-emerald-200">Attendance</a>
            <a href="/teacher/marks" className="hover:text-emerald-200">Marks</a>
            <a href="/teacher/assignments" className="hover:text-emerald-200">Assignments</a>
            <a href="/teacher/timetable" className="hover:text-emerald-200">Timetable</a>
            <a href="/teacher/notices" className="hover:text-emerald-200">Notices</a>
            <a href="/teacher/ai-tools" className="hover:text-emerald-200">AI Tools</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
