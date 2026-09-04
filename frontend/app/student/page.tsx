"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { BookOpen, Calendar, Clock, Library, Bell, FileText, GraduationCap, MonitorPlay } from "lucide-react";
import Link from "next/link";

type TodayClass = {
  id?: string;
  period?: string;
  subject?: string;
  subject_name?: string;
  teacher?: string;
  start_time?: string;
  end_time?: string;
  is_current?: boolean;
  is_break?: boolean;
};

type PendingHomework = {
  id: string;
  title?: string;
  subject?: string;
  subject_name?: string;
  due_date?: string;
  priority?: string;
  is_overdue?: boolean;
};

type RecentResult = {
  id?: string;
  subject?: string;
  subject_name?: string;
  exam_name?: string;
  obtained?: number;
  full_marks?: number;
  grade?: string;
  gpa?: number | string;
};

type StudentNotice = {
  id: string;
  title: string;
  published_at?: string;
};

type StudentDashboardPayload = {
  student_name?: string;
  class_name?: string;
  roll_no?: number | string;
  attendance?: { percentage?: number; present_days?: number; absent_days?: number; late_days?: number; total_days?: number };
  today_classes?: TodayClass[];
  pending_homework?: PendingHomework[];
  recent_results?: RecentResult[];
  notices?: StudentNotice[];
};

/** The real student landing — GET /student/dashboard, zero mock data. */
export default function StudentDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentDashboardPayload>>("/student/dashboard");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        body="Your session may have expired — try again, or ask the school office if this persists."
        onRetry={() => refetch()}
      />
    );

  const classes = data?.today_classes || [];
  const homework = data?.pending_homework || [];
  const results = data?.recent_results || [];
  const notices = data?.notices || [];
  const attendance = data?.attendance || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Hey{data?.student_name ? `, ${data.student_name.split(" ")[0]}` : ""}! 🎓
        </h1>
        <p className="text-muted-foreground">
          {data?.class_name || "Class not assigned"}
          {data?.roll_no != null ? ` • Roll No. ${data.roll_no}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Attendance", value: `${attendance.percentage ?? 0}%`, icon: Calendar, href: "/student" },
          { label: "Pending Homework", value: homework.length, icon: BookOpen, href: "/student/homework" },
          { label: "Today's Classes", value: classes.length, icon: Clock, href: "/student/timetable" },
          { label: "Notices", value: notices.length, icon: Bell, href: "/student" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />Today&apos;s Timetable
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {classes.map((p, i) => (
                  <div
                    key={p.id || i}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                      p.is_current ? "bg-violet-50 border border-violet-200" : ""
                    }`}
                  >
                    <span className="text-sm text-muted-foreground w-24">
                      {p.start_time || p.period || "—"}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-medium">
                        {p.is_break ? "Break" : p.subject_name || p.subject || "—"}
                      </span>
                      {!p.is_break && p.teacher && (
                        <span className="text-xs text-muted-foreground ml-2">{p.teacher}</span>
                      )}
                    </div>
                    {p.is_current && <Badge className="text-xs">Now</Badge>}
                  </div>
                ))}
              </div>
            )}
            <Link href="/student/timetable" className="mt-3 inline-block text-sm text-primary hover:underline">
              Full timetable →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />Pending Homework
            </CardTitle>
          </CardHeader>
          <CardContent>
            {homework.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending — all caught up!</p>
            ) : (
              <div className="space-y-3">
                {homework.slice(0, 5).map((hw) => (
                  <div key={hw.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        hw.is_overdue || hw.priority === "high"
                          ? "bg-red-500"
                          : hw.priority === "medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{hw.title || "Homework"}</p>
                      <p className="text-xs text-muted-foreground">
                        {hw.subject_name || hw.subject || ""}
                        {hw.due_date ? ` • Due: ${hw.due_date}` : ""}
                        {hw.is_overdue ? " • OVERDUE" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/student/homework" className="mt-3 inline-block text-sm text-primary hover:underline">
              All homework →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />Recent Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published results yet.</p>
            ) : (
              <div className="space-y-2">
                {results.slice(0, 5).map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.subject_name || r.subject || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.exam_name || ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.grade && <Badge variant="outline">{r.grade}</Badge>}
                      {r.full_marks ? (
                        <span className="text-sm">
                          {r.obtained}/{r.full_marks}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/student/results" className="mt-3 inline-block text-sm text-primary hover:underline">
              All results →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notices right now.</p>
            ) : (
              <div className="space-y-2">
                {notices.slice(0, 5).map((n) => (
                  <div key={n.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div>
                      <p className="text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.published_at || ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Library", icon: Library, href: "/student/library" },
          { label: "E-Library", icon: FileText, href: "/student/elibrary" },
          { label: "LMS Courses", icon: MonitorPlay, href: "/student/lms" },
          { label: "AI Tutor", icon: GraduationCap, href: "/student/ai-tutor" },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6 flex flex-col items-center gap-2 text-center">
                <item.icon className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">{item.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
