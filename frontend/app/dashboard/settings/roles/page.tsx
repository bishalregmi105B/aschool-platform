"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate, type PluginSidebarItem } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Info,
  KeyRound,
  Shield,
  Users,
} from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

/**
 * Roles & Permissions — B-17 rewrite. Live per-role counts from
 * GET /users/stats, a per-role users drawer (GET /users?role=…) with
 * toggle-active + force-password-change actions, and a read-only view of
 * what the signed-in role can see (derived from GET /plugins/sidebar).
 */

interface RoleCounts {
  total: number;
  active: number;
}

interface UsersStats {
  roles: Record<string, RoleCounts>;
  total_users: number;
}

interface ManagedUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  is_active: boolean;
  must_change_password?: boolean;
  login_id?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  school_admin: "School Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  accountant: "Accountant",
  staff: "Staff",
  driver: "Driver",
};

function roleLabel(role: string): string {
  return (
    ROLE_LABELS[role] ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function RolesPage() {
  return (
    <PluginGate slug="settings_core">
      <RolesContent />
    </PluginGate>
  );
}

function RolesContent() {
  const [tab, setTab] = useState("roles");
  const [openRole, setOpenRole] = useState<string | null>(null);

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["users-stats"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UsersStats>>("/users/stats");
      return res.data.data;
    },
    retry: 1,
  });

  const roleEntries = useMemo(
    () =>
      Object.entries(stats?.roles ?? {}).sort(
        (a, b) => b[1].total - a[1].total
      ),
    [stats]
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Shield className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Roles & Permissions"
        subtitle={
          <>
            Who uses the school, and what each role can reach
            {stats ? ` — ${stats.total_users} users total` : ""}
          </>
        }
      />
      <AOSPageBody>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-4 space-y-4">
            {isLoading ? (
              <AOSModuleLoadingState label="Loading role statistics…" />
            ) : isError ? (
              <DataPanel className="max-w-2xl mx-auto">
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                    Failed to load role statistics. Please try again.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              </DataPanel>
            ) : roleEntries.length === 0 ? (
              <DataPanel>
                <AOSEmptyState
                  icon={<Users className="h-12 w-12" />}
                  title="No users yet"
                  description="Add staff accounts from the Users page."
                />
              </DataPanel>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {roleEntries.map(([role, counts]) => (
                  <div
                    key={role}
                    className="win11-card cursor-pointer transition-shadow"
                    style={{ borderLeft: "4px solid var(--w11-accent)" }}
                    onClick={() => setOpenRole(role)}
                  >
                    <div className="pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="win11-chip accent">{roleLabel(role)}</span>
                          <p className="mt-2 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                            {counts.active} active
                            {counts.total - counts.active > 0
                              ? `, ${counts.total - counts.active} inactive`
                              : ""}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-1"
                          style={{ color: "var(--w11-text-secondary)" }}
                        >
                          <Users className="h-4 w-4" />
                          <span className="text-xl font-semibold" style={{ color: "var(--w11-text-primary)" }}>
                            {counts.total}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRole(role);
                        }}
                      >
                        View users
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <PermissionsMatrix />
          </TabsContent>
        </Tabs>

        <RoleUsersSheet
          role={openRole}
          onClose={() => setOpenRole(null)}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

/* ── Per-role users drawer ─────────────────────────────────────────────── */

function RoleUsersSheet({ role, onClose }: { role: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const open = Boolean(role);

  // Fresh pagination when a different role's drawer opens.
  useEffect(() => {
    setPage(1);
    setSearch("");
  }, [role]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["role-users", role, page, search],
    enabled: open,
    queryFn: async () => {
      const params = new URLSearchParams({
        role: role as string,
        page: String(page),
        per_page: "10",
      });
      if (search) params.set("search", search);
      const res = await api.get<ApiResponse<ManagedUser[]>>(`/users?${params}`);
      return res.data;
    },
    retry: 1,
  });

  const users: ManagedUser[] = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.meta?.pagination;

  const toggleActive = useMutation({
    mutationFn: (u: ManagedUser) => api.post(`/users/${u.id}/toggle-active`),
    onSuccess: (_res, u) => {
      queryClient.invalidateQueries({ queryKey: ["role-users"] });
      queryClient.invalidateQueries({ queryKey: ["users-stats"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        `${u.full_name} ${u.is_active ? "deactivated" : "activated"}`
      );
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const forcePasswordChange = useMutation({
    mutationFn: ({ user, enabled }: { user: ManagedUser; enabled: boolean }) =>
      api.post(`/users/${user.id}/force-password-change`, { enabled }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["role-users"] });
      toast.success(
        vars.enabled
          ? `${vars.user.full_name} must change their password at next login`
          : `Password change no longer required for ${vars.user.full_name}`
      );
    },
    onError: () => toast.error("Failed to update password requirement"),
  });

  const columns: Column<ManagedUser>[] = [
    {
      key: "full_name",
      label: "Name",
      sortable: true,
      value: (u) => u.full_name,
      render: (u) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{u.full_name}</span>
          {u.must_change_password && (
            <Badge variant="warning" className="gap-1">
              <KeyRound className="h-3 w-3" /> Password change required
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      value: (u) => u.phone ?? "",
      render: (u) => (
        <div>
          <div className="text-sm">{u.phone || "—"}</div>
          {u.email && (
            <div className="text-xs text-muted-foreground">{u.email}</div>
          )}
        </div>
      ),
    },
    {
      key: "login_id",
      label: "Login ID",
      value: (u) => u.login_id ?? "",
      render: (u) => (
        <span className="font-mono text-xs text-primary">
          {u.login_id || u.phone || u.email || "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      value: (u) => (u.is_active ? "active" : "inactive"),
      render: (u) => (
        <StatusChip
          status={u.is_active ? "active" : "inactive"}
          label={u.is_active ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "force_password",
      label: "Force password change",
      noExport: true,
      render: (u) => (
        <Switch
          checked={Boolean(u.must_change_password)}
          disabled={forcePasswordChange.isPending}
          onCheckedChange={(checked) =>
            forcePasswordChange.mutate({ user: u, enabled: checked })
          }
          aria-label={`Force password change for ${u.full_name}`}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (u) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={toggleActive.isPending}
          onClick={(e) => {
            e.stopPropagation();
            toggleActive.mutate(u);
          }}
        >
          {u.is_active ? "Deactivate" : "Activate"}
        </Button>
      ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="xl">
        <div className="border-b px-4 py-3 pr-10">
          <SheetTitle>
            {role ? `${roleLabel(role)} users` : "Users"}
          </SheetTitle>
          <SheetDescription>
            Toggle active status or require a password change at next login.
          </SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <DataTable<ManagedUser>
            columns={columns}
            rows={users}
            rowKey={(u) => u.id}
            loading={isLoading}
            error={isError ? "Failed to load users. Please try again." : null}
            onRetry={() => refetch()}
            searchable
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search by name, email, or phone…"
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pages: pagination.pages,
                    total: pagination.total,
                    per_page: pagination.per_page,
                    has_next: pagination.has_next,
                    has_prev: pagination.has_prev,
                  }
                : undefined
            }
            onPageChange={setPage}
            empty={{
              icon: Users,
              title: "No users with this role",
              body: "Add accounts from the Users page to see them here.",
            }}
            exportFileName={`users-${role ?? "role"}`}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Read-only permission matrix ───────────────────────────────────────── */

interface SidebarResponse {
  items: PluginSidebarItem[];
}

function PermissionsMatrix() {
  const { user } = useAuth();

  const {
    data: sidebar,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["plugins-sidebar"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SidebarResponse>>("/plugins/sidebar");
      return res.data.data;
    },
    retry: 1,
  });

  const items = sidebar?.items ?? [];

  const sections = useMemo(() => {
    const map = new Map<string, PluginSidebarItem[]>();
    for (const item of items) {
      const key = item.section || "General";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  if (isLoading) return <AOSModuleLoadingState label="Loading permissions…" />;

  if (isError) {
    return (
      <DataPanel className="max-w-2xl mx-auto">
        <div className="py-10 text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
            Failed to load navigation visibility. Please try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </DataPanel>
    );
  }

  // The sidebar payload only describes what the *signed-in* role sees —
  // it exposes neither per-role `visible_to` nor manifest `permission:`
  // keys, so a full roles × sections matrix is not derivable yet. Be
  // honest about that and show the current role's visibility read-only.
  return (
    <div className="space-y-4">
      <div className="win11-card" style={{ borderLeft: "4px solid var(--w11-accent)" }}>
        <div className="pt-5 flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--w11-accent)" }} />
          <div className="space-y-1 text-sm">
            <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>
              Per-role section visibility isn&rsquo;t available yet
            </p>
            <p style={{ color: "var(--w11-text-secondary)" }}>
              The sidebar API returns only what the signed-in role can see —
              it doesn&rsquo;t expose other roles&rsquo; visibility or the
              manifests&rsquo; declared permissions, so a full role-by-section
              matrix can&rsquo;t be derived. Below is what your role
              {user ? ` (${roleLabel(user.role)})` : ""} can reach, read-only.
            </p>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <DataPanel>
          <AOSEmptyState
            icon={<Shield className="h-12 w-12" />}
            title="No plugin navigation visible for your role."
          />
        </DataPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map(([section, sectionItems]) => (
            <DataPanel key={section} title={section}>
              <ul className="space-y-2">
                {sectionItems.map((item) => (
                  <li
                    key={item.slug}
                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--w11-border-subtle)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {item.label}
                      </p>
                      <p
                        className="truncate text-xs font-mono"
                        style={{ color: "var(--w11-text-tertiary)" }}
                      >
                        {item.route}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {item.subitems.length > 0
                        ? `${item.subitems.length} pages`
                        : "page"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </DataPanel>
          ))}
        </div>
      )}
    </div>
  );
}
