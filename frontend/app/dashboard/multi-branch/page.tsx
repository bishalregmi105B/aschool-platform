"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Building2, Users, TrendingUp, MapPin } from "lucide-react";
import Link from "next/link";
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

export default function MultiBranchPage() {
  return <PluginGate slug="multi_branch"><MultiBranchContent /></PluginGate>;
}

function MultiBranchContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["multi-branch-overview"],
    queryFn: async () => { const r = await api.get("/schools/chain/overview"); return r.data?.data ?? r.data; },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading multi-branch overview…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Multi-Branch Management" subtitle="Oversee all branches in your school chain" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                  Failed to load multi-branch overview. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            </DataPanel>
          </AOSPageBody>
        </AOSPage>
      );
    }

  const branches: any[] = data?.branches ?? [];
  const stats = data?.stats ?? {};

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Building2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Multi-Branch Management"
        subtitle="Oversee all branches in your school chain"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/dashboard/multi-branch/analytics">Chain Analytics</Link></Button>
            <Button asChild><Link href="/dashboard/multi-branch/branches">Manage Branches</Link></Button>
          </div>
        }
      />
      <AOSPageBody>
        <StatGrid min={200}>
          <KpiCard
            label="Total Branches"
            value={stats.total_branches ?? branches.length}
            icon={<Building2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Total Students"
            value={stats.total_students ?? "—"}
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Total Staff"
            value={stats.total_staff ?? "—"}
            icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Avg Performance"
            value={stats.avg_performance ? `${stats.avg_performance}%` : "—"}
            icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          />
        </StatGrid>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.length === 0 ? (
            <DataPanel className="col-span-full">
              <AOSEmptyState title="No branches found" description="Add branches to get started." />
            </DataPanel>
          ) : branches.map((b: any) => (
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
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  <MapPin className="h-4 w-4" />{b.address ?? "—"}
                </div>
                <div className="flex justify-between text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  <span>Students: <strong style={{ color: "var(--w11-text-primary)" }}>{b.student_count ?? "—"}</strong></span>
                  <span>Staff: <strong style={{ color: "var(--w11-text-primary)" }}>{b.staff_count ?? "—"}</strong></span>
                </div>
                {b.performance_score != null && (
                  <div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    Performance: <strong style={{ color: "var(--w11-text-primary)" }}>{b.performance_score}%</strong>
                  </div>
                )}
              </div>
            </DataPanel>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
