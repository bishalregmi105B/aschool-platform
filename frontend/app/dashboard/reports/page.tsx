"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { formatCurrency } from "@/lib/utils";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import {
  BarChart3,
  Users,
  DollarSign,
  ClipboardList,
  ChevronRight,
} from "lucide-react";

// Quick links — the basic_reports manifest ui.nav.subitems.
const QUICK_LINKS = [
  { label: "Exam Reports", desc: "Results and grade summaries", icon: "BookOpen", href: "/dashboard/reports/exam" },
  { label: "Expense Reports", desc: "School spending breakdowns", icon: "Receipt", href: "/dashboard/reports/expense" },
  { label: "Teacher Reports", desc: "Staff performance and workload", icon: "Users", href: "/dashboard/reports/teacher" },
];
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

const ACCENT = "#0067c0";
const GOOD = "#0f7b0f";
const WARN = "#9d5d00";

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
      <AOSPage>
        <AOSPageHeader
          icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Reports & Analytics"
          subtitle="Overview of school performance metrics"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load reports. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
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
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Reports & Analytics"
        subtitle="Overview of school performance metrics"
      />
      <AOSPageBody>
      <div className="space-y-6">
      {/* Dashboard — KPI stat grid from the overview this page loads */}
      <StatGrid className="mb-0">
        <KpiCard
          label="Avg Attendance"
          value={`${data?.attendance_summary?.average_percentage ?? 0}%`}
          icon={<ClipboardList className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
        />
        <KpiCard
          label="Fee Collection Rate"
          value={`${data?.fee_summary?.collection_rate ?? 0}%`}
          color="#107c10"
          icon={<DollarSign className="h-4 w-4" style={{ color: "#107c10" }} />}
        />
        <KpiCard
          label="Fees Collected"
          value={formatCurrency(data?.fee_summary?.total_collected ?? 0)}
          color="var(--w11-text-primary)"
          icon={<DollarSign className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
        />
        <KpiCard
          label="Avg Score"
          value={`${data?.exam_summary?.average_score ?? 0}%`}
          color="var(--w11-text-primary)"
          icon={<BarChart3 className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
        />
        <KpiCard
          label="Pass Rate"
          value={`${data?.exam_summary?.pass_rate ?? 0}%`}
          color="#107c10"
          icon={<Users className="h-4 w-4" style={{ color: "#107c10" }} />}
        />
      </StatGrid>

      {/* Quick links — 44px gradient icon tile + label, as next/link */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {QUICK_LINKS.map((l) => {
          const Icon = ICON_MAP[l.icon] || ChevronRight;
          return (
            <Link key={l.href} href={l.href} className="block h-full">
              <div
                className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                style={{ cursor: "pointer", marginBottom: 0 }}
              >
                <div
                  className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                  style={{
                    width: 44,
                    height: 44,
                    background: SECTION_GRADIENTS.Insights,
                    boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                  }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {l.label}
                  </p>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--w11-text-secondary)" }}>
                    {l.desc}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DataPanel title={<span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Attendance</span>}>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Average</span>
              <span className="font-bold">
                {data?.attendance_summary?.average_percentage ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Best Class</span>
              <span className="text-sm font-medium">
                {data?.attendance_summary?.best_class ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Needs Attention</span>
              <span className="text-sm font-medium">
                {data?.attendance_summary?.worst_class ?? "-"}
              </span>
            </div>
          </DataPanel>

        <DataPanel title={<span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Fee Collection</span>}>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Collected</span>
              <span className="font-bold">
                {formatCurrency(data?.fee_summary?.total_collected ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Pending</span>
              <span className="text-sm font-medium text-[color:#9d5d00]">
                {formatCurrency(data?.fee_summary?.total_pending ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Collection Rate</span>
              <span className="font-bold">
                {data?.fee_summary?.collection_rate ?? 0}%
              </span>
            </div>
          </DataPanel>

        <DataPanel title={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Exams</span>}>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Avg Score</span>
              <span className="font-bold">
                {data?.exam_summary?.average_score ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Pass Rate</span>
              <span className="text-sm font-medium">
                {data?.exam_summary?.pass_rate ?? 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--w11-text-secondary)]">Top Subject</span>
              <span className="text-sm font-medium">
                {data?.exam_summary?.top_subject ?? "-"}
              </span>
            </div>
          </DataPanel>
      </div>

      {/* Charts Row 1: Attendance by Class + Fee Collection Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataPanel title="Attendance by Class">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceByClass}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w11-border-subtle)" />
                <XAxis dataKey="class_name" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="percentage" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        </DataPanel>

        <DataPanel title="Fee Collection Status">
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
                    <Cell key={i} fill={i === 0 ? GOOD : WARN} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </DataPanel>
      </div>

      {/* Charts Row 2: Fee Monthly Trend + Exam Subject Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataPanel title="Monthly Fee Collection Trend">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={feeByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w11-border-subtle)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="collected" name="Collected" fill={GOOD} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill={WARN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        </DataPanel>

        <DataPanel title="Subject Performance">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={examBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w11-border-subtle)" />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="average"
                  name="Average Score"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="pass_rate"
                  name="Pass Rate"
                  stroke={GOOD}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
        </DataPanel>
      </div>
      </div>
      </AOSPageBody>
    </AOSPage>
  );
}
