"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Users, ClipboardCheck, BookOpen, Calendar, Bell } from "lucide-react";

export default function TeacherDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const res = await api.get("/analytics/teacher-dashboard");
      return res.data?.data;
    },
  });

  if (isLoading) return <PageLoader />;

  const stats = [
    { label: "My Classes", value: String(data?.stats?.my_classes || 0), icon: Users, color: "bg-emerald-50 text-emerald-600" },
    { label: "Recent Notices", value: String(data?.stats?.recent_notices || 0), icon: ClipboardCheck, color: "bg-blue-50 text-blue-600" },
    { label: "Assignments", value: String(data?.stats?.pending_assignments || 0), icon: BookOpen, color: "bg-orange-50 text-orange-600" },
    { label: "Today's Periods", value: String(data?.stats?.todays_periods || 0), icon: Calendar, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good Morning, Teacher! 👋</h1>
        <p className="text-muted-foreground">Here&apos;s your day at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Today&apos;s Schedule</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.schedule || []).map((period: any, i: number) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{period.time}</span>
                  <span className="font-medium">{period.subject}</span>
                  <span className="text-sm text-muted-foreground ml-auto">{period.class_name}</span>
                </div>
              ))}
              {(data?.schedule || []).length === 0 && <p className="text-sm text-muted-foreground">No timetable slots assigned for today.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Recent Notices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.notices || []).map((notice: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-2 ${notice.urgent ? "bg-red-500" : "bg-gray-300"}`} />
                  <div>
                    <p className="font-medium text-sm">{notice.title}</p>
                    <p className="text-xs text-muted-foreground">{notice.date ? new Date(notice.date).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
              ))}
              {(data?.notices || []).length === 0 && <p className="text-sm text-muted-foreground">No recent notices.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
