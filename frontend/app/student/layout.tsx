"use client";

import { ReactNode } from "react";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-violet-700 text-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">ASchool</span>
            <span className="text-violet-200 text-sm">Student Portal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/student" className="hover:text-violet-200">Dashboard</a>
            <a href="/student/timetable" className="hover:text-violet-200">Timetable</a>
            <a href="/student/homework" className="hover:text-violet-200">Homework</a>
            <a href="/student/results" className="hover:text-violet-200">Results</a>
            <a href="/student/library" className="hover:text-violet-200">Library</a>
            <a href="/student/lms" className="hover:text-violet-200">LMS</a>
            <a href="/student/ai-tutor" className="hover:text-violet-200">AI Tutor</a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
