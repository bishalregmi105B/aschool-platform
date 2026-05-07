"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { api, type ApiResponse } from "@/lib/api";
import { CalendarCheck, CreditCard, Bus, Bell, Heart, Users } from "lucide-react";

type ParentChild = {
  id: string;
  name: string;
  class_name?: string;
  roll_no?: number;
  attendance_pct?: number;
  fees_due?: number;
  today_status?: string | null;
};

type ParentNotice = {
  id: string;
  title: string;
  date?: string;
};

type ParentDashboardPayload = {
  children: ParentChild[];
  recent_notices: ParentNotice[];
};

export default function ParentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ParentDashboardPayload>>("/parent/dashboard");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;

  const children = data?.children || [];
  const notices = data?.recent_notices || [];
  const totalDue = children.reduce((sum, child) => sum + (child.fees_due || 0), 0);
  const avgAttendance = children.length
    ? Math.round(children.reduce((sum, child) => sum + (child.attendance_pct || 0), 0) / children.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, Parent</h1>
        <p className="text-muted-foreground">Track all linked children from one account</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Linked Children", value: `${children.length}`, sub: "Active links", icon: Users, color: "text-blue-600 bg-blue-50", href: "/parent" },
          { label: "Attendance", value: `${avgAttendance}%`, sub: "Average", icon: CalendarCheck, color: "text-green-600 bg-green-50", href: "/parent/attendance" },
          { label: "Due Fees", value: `Rs. ${totalDue.toLocaleString()}`, sub: "Across children", icon: CreditCard, color: "text-red-600 bg-red-50", href: "/parent/fees" },
          { label: "Bus Status", value: "Live", sub: "Track routes", icon: Bus, color: "text-orange-600 bg-orange-50", href: "/parent/bus" },
          { label: "Notices", value: `${notices.length}`, sub: "Recent", icon: Bell, color: "text-blue-600 bg-blue-50", href: "/parent/notices" },
          { label: "Wellbeing", value: "View", sub: "Mood & notes", icon: Heart, color: "text-pink-600 bg-pink-50", href: "/parent/wellbeing" },
        ].map((card) => (
          <a key={card.label} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color} mb-3`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-sm font-medium">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Children Overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {children.length === 0 && <p className="text-sm text-muted-foreground">No students are linked to this parent account yet.</p>}
          {children.map((child) => (
            <div key={child.id} className="border rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                {(child.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium">{child.name}</p>
                <p className="text-sm text-muted-foreground">
                  {child.class_name || "Class not assigned"}
                  {child.roll_no ? ` • Roll ${child.roll_no}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={child.today_status === "present" ? "success" : "outline"}>
                  {child.today_status || "Not marked"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Due: Rs. {(child.fees_due || 0).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Notices</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notices.length === 0 && <p className="text-sm text-muted-foreground">No recent notices for parents.</p>}
            {notices.map((notice) => (
              <div key={notice.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <div>
                  <p className="text-sm">{notice.title}</p>
                  <p className="text-xs text-muted-foreground">{notice.date || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
