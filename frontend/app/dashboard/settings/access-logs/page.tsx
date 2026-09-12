"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Fingerprint,
  KeyRound,
  LogIn,
  LogOut,
  Lock,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

/**
 * Access Logs (A-37) — authentication activity per school: logins, failed
 * logins, logouts, password changes and lockouts, with IP + platform.
 * Filters (event type + user) and pagination are server-side.
 */

interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  event: string;
  ip: string | null;
  platform: string | null;
  login_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

interface AccessLogsPayload {
  logs: AccessLog[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface UserOption {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
}

const EVENTS = [
  { value: "", label: "All events" },
  { value: "login", label: "Login" },
  { value: "login_failed", label: "Failed login" },
  { value: "logout", label: "Logout" },
  { value: "password_changed", label: "Password changed" },
  { value: "locked_out", label: "Locked out" },
] as const;

const EVENT_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; label: string }> = {
  login: { variant: "success", label: "Login" },
  login_failed: { variant: "destructive", label: "Failed login" },
  logout: { variant: "secondary", label: "Logout" },
  password_changed: { variant: "warning", label: "Password changed" },
  locked_out: { variant: "destructive", label: "Locked out" },
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  login_failed: Lock,
  logout: LogOut,
  password_changed: KeyRound,
  locked_out: Lock,
};

export default function AccessLogsPage() {
  return (
    <PluginGate slug="settings_core">
      <AccessLogsContent />
    </PluginGate>
  );
}

function AccessLogsContent() {
  const [event, setEvent] = useState("");
  const [userFilter, setUserFilter] = useState<UserOption | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["access-logs", event, userFilter?.id ?? null, page, perPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (event) params.set("event", event);
      if (userFilter) params.set("user_id", userFilter.id);
      const res = await api.get<ApiResponse<AccessLogsPayload>>(
        `/users/access-logs?${params}`
      );
      return res.data.data;
    },
    retry: 1,
  });

  const logs = data?.logs ?? [];
  const meta = data?.meta;

  const columns: Column<AccessLog>[] = useMemo(
    () => [
      {
        key: "created_at",
        label: "Time",
        sortable: true,
        value: (l) => l.created_at ?? "",
        render: (l) => (
          <span className="text-sm whitespace-nowrap">
            {l.created_at ? new Date(l.created_at).toLocaleString("ne-NP") : "—"}
          </span>
        ),
      },
      {
        key: "user_name",
        label: "User",
        sortable: true,
        value: (l) => l.user_name ?? "",
        render: (l) => (
          <span className="font-medium">{l.user_name || "Unknown user"}</span>
        ),
      },
      {
        key: "user_role",
        label: "Role",
        value: (l) => l.user_role ?? "",
        render: (l) =>
          l.user_role ? (
            <Badge variant="outline" className="capitalize">
              {l.user_role.replace("_", " ")}
            </Badge>
          ) : (
            "—"
          ),
      },
      {
        key: "event",
        label: "Event",
        sortable: true,
        value: (l) => l.event,
        render: (l) => {
          const badge = EVENT_BADGE[l.event] ?? {
            variant: "outline" as const,
            label: l.event,
          };
          const Icon = EVENT_ICONS[l.event] ?? Activity;
          return (
            <Badge variant={badge.variant} className="gap-1">
              <Icon className="h-3 w-3" />
              {badge.label}
            </Badge>
          );
        },
      },
      {
        key: "platform",
        label: "Platform",
        value: (l) => l.platform ?? "",
        render: (l) => (
          <span className="text-sm capitalize">{l.platform || "—"}</span>
        ),
      },
      {
        key: "ip",
        label: "IP",
        value: (l) => l.ip ?? "",
        render: (l) => (
          <span className="font-mono text-xs">{l.ip || "—"}</span>
        ),
      },
      {
        key: "login_id",
        label: "Login ID",
        value: (l) => l.login_id ?? "",
        render: (l) => (
          <span className="font-mono text-xs text-muted-foreground">
            {l.login_id || "—"}
          </span>
        ),
      },
    ],
    []
  );

  if (isLoading && !data) return <AOSModuleLoadingState label="Loading access logs…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ScrollText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Access Logs"
        subtitle="Sign-in activity across the school — logins, failures, lockouts and password changes"
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-4">
          <DataTable<AccessLog>
            columns={columns}
            rows={logs}
            rowKey={(l) => l.id}
            loading={isLoading}
            error={
              isError ? "Failed to load access logs. Please try again." : null
            }
            onRetry={() => refetch()}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <UserFilterPicker
                  selected={userFilter}
                  onSelect={(u) => {
                    setUserFilter(u);
                    setPage(1);
                  }}
                  onClear={() => {
                    setUserFilter(null);
                    setPage(1);
                  }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {EVENTS.map((e) => (
                    <button
                      key={e.value || "all"}
                      onClick={() => {
                        setEvent(e.value);
                        setPage(1);
                      }}
                      className={`win11-chip ${event === e.value ? "accent" : ""}`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            }
            pagination={
              meta
                ? {
                    page: meta.page,
                    pages: meta.pages,
                    total: meta.total,
                    per_page: meta.per_page,
                    has_next: meta.has_next,
                    has_prev: meta.has_prev,
                  }
                : undefined
            }
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
            empty={{
              icon: Fingerprint,
              title: "No access events found",
              body:
                event || userFilter
                  ? "Try clearing the event or user filters."
                  : "Sign-in events will appear here as users log in.",
            }}
            exportFileName="access-logs"
            dense
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}

/* ── User filter: server-side search over /users, pick to filter logs ──── */

function UserFilterPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: UserOption | null;
  onSelect: (u: UserOption) => void;
  onClear: () => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: matches, isFetching } = useQuery({
    queryKey: ["access-log-user-search", debounced],
    enabled: !selected && debounced.length >= 2,
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserOption[]>>(
        `/users?search=${encodeURIComponent(debounced)}&per_page=8`
      );
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    retry: 1,
  });

  if (selected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 pl-3 pr-1.5 py-1 text-xs font-medium">
        {selected.full_name}
        <button
          onClick={onClear}
          className="rounded-full p-0.5 hover:bg-muted"
          aria-label="Clear user filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10 h-9 w-56"
          placeholder="Filter by user…"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search users to filter logs"
        />
      </div>
      {open && term.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border bg-popover p-1 shadow-md">
          {isFetching ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : (matches ?? []).length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No users match “{term.trim()}”
            </p>
          ) : (
            (matches ?? []).map((u) => (
              <button
                key={u.id}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(u);
                  setTerm("");
                  setOpen(false);
                }}
              >
                <span className="truncate font-medium">{u.full_name}</span>
                {u.role && (
                  <span className="shrink-0 text-xs text-muted-foreground capitalize">
                    {u.role.replace("_", " ")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
