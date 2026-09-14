"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MetricCard } from "@/components/ui/metric-card";
import { displayBS } from "@/lib/nepali_date";

interface TenantRow {
  id: string;
  name: string;
  name_nepali?: string | null;
  slug: string;
  plan: string;
  status: string;
  is_active: boolean;
  district?: string | null;
  type?: string | null;
  created_at?: string;
  student_count: number;
  user_count: number;
  plugin_count: number;
}

interface PlatformPlugin {
  slug: string;
  name: string;
  category: string;
  installs: number;
  price_monthly: number;
  price_yearly: number;
}

/**
 * Super-admin console — the platform operator's cockpit.
 *
 * Three surfaces in one tabbed page (the shell has no dock here, so tabs
 * carry the navigation): Overview KPIs, the tenant register with the
 * suspend/activate dunning lever, and the plugin catalog health. Tenant
 * detail opens as an inline panel rather than a route — operators scan
 * and compare, they don't deep-link tenants.
 */
export default function SuperAdminConsole() {
  const [search, setSearch] = React.useState("");
  const [openTenant, setOpenTenant] = React.useState<string | null>(null);
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const overview = useQuery({
    retry: 1,
    queryKey: ["superadmin-overview"],
    queryFn: async () => (await api.get("/super-admin/overview")).data?.data,
  });

  const tenants = useQuery({
    retry: 1,
    queryKey: ["superadmin-tenants"],
    queryFn: async () =>
      (await api.get("/super-admin/schools", { params: search ? { search } : {} }))
        .data?.data as TenantRow[],
  });

  const plugins = useQuery({
    retry: 1,
    queryKey: ["superadmin-plugins"],
    queryFn: async () =>
      (await api.get("/super-admin/plugins")).data?.data as PlatformPlugin[],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/super-admin/schools/${id}/status`, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-tenants"] }),
  });

  const toggleStatus = async (row: TenantRow) => {
    const suspending = row.is_active;
    const ok = await confirm({
      title: suspending ? "Suspend this school?" : "Activate this school?",
      body: suspending
        ? `${row.name}'s users will be blocked from signing in until it is reactivated. Fee reminders and scheduled jobs for this tenant stop.`
        : `${row.name}'s users will be able to sign in again.`,
      confirmLabel: suspending ? "Suspend" : "Activate",
      tone: suspending ? "danger" : "default",
    });
    if (!ok) return;
    statusMutation.mutate({ id: row.id, isActive: !row.is_active });
  };

  const tenantDetail = useQuery({
    enabled: Boolean(openTenant),
    queryKey: ["superadmin-tenant", openTenant],
    queryFn: async () =>
      (await api.get(`/super-admin/schools/${openTenant}`)).data?.data,
  });

  if (overview.isLoading) return <PageLoader />;
  if (overview.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-destructive">
              Failed to load platform data. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => overview.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = overview.data?.stats ?? {};

  const tenantColumns: Column<TenantRow>[] = [
    {
      key: "name",
      label: "School",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          {row.name_nepali && (
            <p className="font-nepali text-[11px] text-[var(--w11-text-secondary)]">
              {row.name_nepali}
            </p>
          )}
        </div>
      ),
      value: (r) => r.name,
    },
    { key: "slug", label: "Slug", sortable: true, value: (r) => r.slug },
    {
      key: "plan",
      label: "Plan",
      render: (r) => <StatusPill status={r.plan === "premium" ? "success" : r.plan === "growth" ? "info" : "default"}>{r.plan ?? "—"}</StatusPill>,
      value: (r) => r.plan ?? "",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusPill status={r.is_active ? "success" : "danger"}>
          {r.is_active ? "Active" : "Suspended"}
        </StatusPill>
      ),
      value: (r) => (r.is_active ? "Active" : "Suspended"),
    },
    { key: "students", label: "Students", align: "right", sortable: true, value: (r) => r.student_count },
    { key: "users", label: "Users", align: "right", sortable: true, value: (r) => r.user_count },
    { key: "plugins", label: "Plugins", align: "right", value: (r) => r.plugin_count },
    {
      key: "created",
      label: "Registered",
      value: (r) => (r.created_at ? displayBS(r.created_at) : "—"),
      render: (r) => (
        <span className="text-[var(--w11-text-secondary)]">
          {r.created_at ? displayBS(r.created_at) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOpenTenant(row.id)}>
            View
          </Button>
          <Button
            variant={row.is_active ? "destructive" : "outline"}
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => toggleStatus(row)}
          >
            {row.is_active ? "Suspend" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  const pluginColumns: Column<PlatformPlugin>[] = [
    { key: "name", label: "Plugin", sortable: true, value: (p) => p.name },
    { key: "category", label: "Category", sortable: true, value: (p) => p.category },
    { key: "installs", label: "Installs", align: "right", sortable: true, value: (p) => p.installs },
    {
      key: "price",
      label: "Price (monthly / yearly)",
      align: "right",
      value: (p) => `${p.price_monthly} / ${p.price_yearly}`,
      render: (p) => (
        <span className="tabular-nums">
          {p.price_monthly > 0 ? `Rs. ${p.price_monthly.toLocaleString()}` : "Free"}
          {p.price_yearly > 0 && (
            <span className="text-[var(--w11-text-secondary)]">
              {" / "}
              {`Rs. ${p.price_yearly.toLocaleString()}`}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title text-[var(--w11-text-primary)]">Platform Console</h1>
          <p className="font-nepali text-[12px] text-[var(--w11-text-secondary)]">
            प्लेटफर्म प्रशासन
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants" badge={tenants.data?.length}>
            Tenants
          </TabsTrigger>
          <TabsTrigger value="plugins" badge={plugins.data?.length}>
            Plugin Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Schools" value={stats.total_schools ?? 0} />
            <MetricCard label="Active" value={stats.active_schools ?? 0} />
            <MetricCard label="Total Users" value={stats.total_users ?? 0} />
            <MetricCard label="Students" value={stats.total_students ?? 0} />
            <MetricCard label="Plugins" value={stats.total_plugins ?? 0} />
            <MetricCard label="Plugin Installs" value={stats.total_installs ?? 0} />
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <DataTable
            columns={tenantColumns}
            rows={tenants.data ?? []}
            rowKey={(r) => r.id}
            loading={tenants.isLoading}
            error={tenants.isError ? "Failed to load tenants." : null}
            onRetry={() => tenants.refetch()}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search schools…"
            exportFileName="aschool-tenants"
            empty={{
              title: "No schools registered",
              body: "Schools appear here as they sign up on the platform.",
            }}
          />

          {openTenant && (
            <Card>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold">
                      {tenantDetail.data?.name ?? "Loading…"}
                    </h2>
                    {tenantDetail.data?.name_nepali && (
                      <p className="font-nepali text-[12px] text-[var(--w11-text-secondary)]">
                        {tenantDetail.data.name_nepali}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setOpenTenant(null)}>
                    Close
                  </Button>
                </div>

                {tenantDetail.isLoading && <PageLoader />}
                {tenantDetail.data && (
                  <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MetricCard label="Students" value={tenantDetail.data.student_count} />
                      <MetricCard label="Users" value={tenantDetail.data.user_count} />
                      <MetricCard label="Plugins" value={tenantDetail.data.plugins?.length ?? 0} />
                      <MetricCard label="Plan" value={String(tenantDetail.data.plan ?? "—")} />
                    </div>

                    {Object.keys(tenantDetail.data.users_by_role ?? {}).length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[12px] font-medium text-[var(--w11-text-secondary)]">
                          Users by role
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(tenantDetail.data.users_by_role as Record<string, number>).map(([role, count]) => (
                            <span key={role} className="win11-chip">
                              {role}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-1.5 text-[12px] font-medium text-[var(--w11-text-secondary)]">
                        Installed plugins
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(tenantDetail.data.plugins ?? []).map((p: { slug: string; name: string; active: boolean; is_trial: boolean }) => (
                          <span key={p.slug} className="win11-chip">
                            {p.name}
                            {p.is_trial && " (trial)"}
                            {!p.active && " (inactive)"}
                          </span>
                        ))}
                        {(tenantDetail.data.plugins ?? []).length === 0 && (
                          <span className="text-[12px] text-[var(--w11-text-secondary)]">
                            No plugins installed.
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plugins">
          <DataTable
            columns={pluginColumns}
            rows={plugins.data ?? []}
            rowKey={(p) => p.slug}
            loading={plugins.isLoading}
            error={plugins.isError ? "Failed to load plugin catalog." : null}
            onRetry={() => plugins.refetch()}
            exportFileName="aschool-plugin-catalog"
            empty={{ title: "No plugins in catalog" }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
