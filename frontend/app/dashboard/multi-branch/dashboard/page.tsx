"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, BookOpen, DollarSign } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

export default function ChainDashboardPage() {
  return <PluginGate slug="multi_branch"><ChainDashboardContent /></PluginGate>;
}

function ChainDashboardContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["chain-dashboard"],
    queryFn: async () => { const r = await api.get("/schools/chain/dashboard"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading chain dashboard…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Unified Chain Dashboard" subtitle="Consolidated view across all branches" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                  Failed to load multi-branch dashboard. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const branches: any[] = data?.branches ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<LayoutDashboard className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Unified Chain Dashboard"
        subtitle="Consolidated view across all branches"
      />
      <AOSPageBody>
        <StatGrid min={200}>
          <KpiCard
            label="Total Students"
            value={data?.totals?.students ?? "—"}
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Total Staff"
            value={data?.totals?.staff ?? "—"}
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Chain Attendance"
            value={data?.totals?.attendance ? `${data.totals.attendance}%` : "—"}
            icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Total Revenue"
            value={data?.totals?.revenue ? `Rs. ${data.totals.revenue.toLocaleString()}` : "—"}
            icon={<DollarSign className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {branches.map((b: any) => (
            <DataPanel
              key={b.id}
              title={b.name}
              actions={
                <StatusChip
                  status={b.is_active ? "active" : "inactive"}
                  label={b.is_active ? "Active" : "Inactive"}
                />
              }
            >
              <div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{b.student_count ?? "—"}</p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Students</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--w11-text-primary)" }}>{b.staff_count ?? "—"}</p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Staff</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
                      {b.attendance_rate != null ? `${b.attendance_rate}%` : "—"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Attendance</p>
                  </div>
                </div>
                {b.performance_score != null && (
                  <div className="mt-3">
                    <div
                      className="flex justify-between text-sm mb-1"
                      style={{ color: "var(--w11-text-secondary)" }}
                    >
                      <span>Performance</span>
                      <span>{b.performance_score}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--w11-control-hover)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${b.performance_score}%`, background: "var(--w11-accent)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </DataPanel>
          ))}
          {branches.length === 0 && (
            <DataPanel className="col-span-full">
              <AOSEmptyState title="No branch data available" />
            </DataPanel>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
