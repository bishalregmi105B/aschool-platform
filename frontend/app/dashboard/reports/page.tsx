"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  Users,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface ReportDashboard {
  attendance_summary: {
    average_percentage: number;
    best_class: string;
    worst_class: string;
    by_class?: { class_name: string; percentage: number }[];
  };
  fee_summary: {
    total_collected: number;
    total_pending: number;
    collection_rate: number;
    by_month?: { month: string; collected: number; pending: number }[];
  };
  exam_summary: {
    average_score: number;
    pass_rate: number;
    top_subject: string;
    by_subject?: { subject: string; average: number; pass_rate: number }[];
  };
}

const COLORS = ["#2563eb", "#16a34a", "#eab308", "#ef4444", "#8b5cf6", "#f97316"];

export default function ReportsPage() {
  return (
    <PluginGate slug="basic_reports">
      <ReportsContent />
    </PluginGate>
  );
}

function ReportsContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReportDashboard>>("/analytics/overview");
      return res.data.data;
    },
    retry: 1,
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load reports. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const attendanceByClass = data?.attendance_summary?.by_class ?? [];
  const feeByMonth = data?.fee_summary?.by_month ?? [];
  const examBySubject = data?.exam_summary?.by_subject ?? [];

  const feeCollected = data?.fee_summary?.total_collected ?? 0;
  const feePending = data?.fee_summary?.total_pending ?? 0;
  const feePieData = [
    { name: "Collected", value: feeCollected },
    { name: "Pending", value: feePending },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Overview of school performance metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Average</span>
              <span className="font-bold">
                {data?.attendance_summary?.average_percentage ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Best Class</span>
              <span className="text-sm font-medium">
                {data?.attendance_summary?.best_class ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Needs Attention</span>
              <span className="text-sm font-medium">
                {data?.attendance_summary?.worst_class ?? "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Fee Collection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Collected</span>
              <span className="font-bold">
                {formatCurrency(data?.fee_summary?.total_collected ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="text-sm font-medium text-amber-600">
                {formatCurrency(data?.fee_summary?.total_pending ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Collection Rate</span>
              <span className="font-bold">
                {data?.fee_summary?.collection_rate ?? 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Score</span>
              <span className="font-bold">
                {data?.exam_summary?.average_score ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pass Rate</span>
              <span className="text-sm font-medium">
                {data?.exam_summary?.pass_rate ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Top Subject</span>
              <span className="text-sm font-medium">
                {data?.exam_summary?.top_subject ?? "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Attendance by Class + Fee Collection Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance by Class</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceByClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class_name" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="percentage" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee Collection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {feePieData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#16a34a" : "#eab308"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Fee Monthly Trend + Exam Subject Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Fee Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={feeByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={examBySubject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="average"
                  name="Average Score"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="pass_rate"
                  name="Pass Rate"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
