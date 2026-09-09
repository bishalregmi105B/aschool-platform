"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { Plug, Settings, Store, Trash2 } from "lucide-react";

/**
 * Installed Plugins — the WordPress plugins.php-style management surface
 * (audit E165): one row per install with an Active toggle (activate /
 * deactivate are distinct from install / uninstall), the plugin's tier
 * category, a Settings link (per-plugin config) and Uninstall.
 *
 * Data comes from the live marketplace catalog, which reports the WP-style
 * lifecycle state (install_state: not_installed | active | inactive) for
 * every plugin — including DEACTIVATED installs, which GET /plugins/installed
 * (active-only) does not return. No local price literals: prices, trial
 * state and names all come from the API.
 */

interface MarketplacePlugin {
  slug: string;
  name: string;
  description: string;
  emoji?: string;
  icon?: string;
  category: string;
  price_monthly: number;
  is_free: boolean;
  install_state?: "not_installed" | "active" | "inactive";
  is_trial?: boolean;
  trial_days_left?: number | null;
  can_subscribe?: boolean;
}

function PluginIcon({ emoji }: { emoji?: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
      {emoji || <Plug className="h-4 w-4 text-muted-foreground" />}
    </span>
  );
}

export default function InstalledPluginsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MarketplacePlugin[]>>(
        "/plugins/marketplace"
      );
      return res.data.data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    queryClient.invalidateQueries({ queryKey: ["plugins-config"] });
  };

  const activateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/activate`),
    onSuccess: () => {
      invalidate();
      toast.success("Plugin activated");
    },
    onError: () => toast.error("Activate failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/deactivate`),
    onSuccess: () => {
      invalidate();
      toast.success("Plugin deactivated");
    },
    onError: () => toast.error("Deactivate failed"),
  });

  const uninstallMutation = useMutation({
    mutationFn: (slug: string) =>
      api.post("/plugins/uninstall", { plugin_slug: slug }),
    onSuccess: () => {
      invalidate();
      toast.success("Plugin uninstalled — its data is preserved");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data
              ?.error ?? "Uninstall failed")
          : "Uninstall failed";
      toast.error(typeof msg === "string" ? msg : "Uninstall failed");
    },
  });

  const installed = useMemo(
    () =>
      (data || []).filter(
        (p) => p.install_state === "active" || p.install_state === "inactive"
      ),
    [data]
  );

  const busy =
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    uninstallMutation.isPending;

  const PLUGIN_COLUMNS: Column<any>[] = [
    {
      key: "name",
      label: "Plugin",
      sortable: true,
      value: (p) => p.name ?? "",
      render: (p) => (
        <div className="flex items-center gap-3">
          <PluginIcon emoji={p.emoji} />
          <div className="min-w-0">
            <p className="font-medium truncate">{p.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
          </div>
        </div>
      ),
    },
    { key: "category", label: "Category", sortable: true, value: (p) => p.category ?? "", render: (p) => <Badge variant="secondary" className="capitalize">{p.category || "add_on"}</Badge> },
    {
      key: "state",
      label: "Status",
      sortable: true,
      value: (p) => p.install_state ?? "",
      render: (p) => {
        const state = p.install_state!;
        const isActive = state === "active";
        const onTrial = isActive && p.is_trial === true;
        return onTrial ? (
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-none">
            Trial{typeof p.trial_days_left === "number" ? ` · ${p.trial_days_left}d left` : ""}
          </Badge>
        ) : p.is_free ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">Free</Badge>
        ) : (
          <Badge variant="secondary" className="font-semibold">{formatCurrency(p.price_monthly)}/mo</Badge>
        );
      },
    },
    {
      key: "active",
      label: "Active",
      align: "center",
      render: (p) => {
        const isActive = p.install_state === "active";
        return (
          <Switch
            checked={isActive}
            disabled={busy}
            aria-label={`Activate or deactivate ${p.name}`}
            onCheckedChange={(checked) =>
              checked ? activateMutation.mutate(p.slug) : deactivateMutation.mutate(p.slug)
            }
          />
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/plugins/${p.slug}/settings`}>
              <Settings className="h-3.5 w-3.5 mr-1" />
              Settings
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            disabled={busy}
            title="Uninstall (plugin data is preserved)"
            onClick={(e) => {
              e.stopPropagation();
              if (
                window.confirm(
                  `Uninstall ${p.name}? Its data is preserved and it can be reinstalled later.`
                )
              ) {
                uninstallMutation.mutate(p.slug);
              }
            }}
          >
            {uninstallMutation.isPending && "…"}
            Uninstall
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Installed Plugins</h1>
          <p className="text-muted-foreground mt-2">
            {installed.length} plugin{installed.length === 1 ? "" : "s"}{" "}
            installed. Deactivate to disable a plugin without losing its data —
            uninstall removes it but keeps the data too.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/marketplace">
            <Store className="h-4 w-4 mr-2" />
            Add New (Marketplace)
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {installed.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              No plugins installed yet — browse the{" "}
              <Link
                href="/dashboard/marketplace"
                className="text-primary underline-offset-4 hover:underline"
              >
                marketplace
              </Link>{" "}
              to add some.
            </p>
          ) : (
            <DataTable
              columns={PLUGIN_COLUMNS}
              rows={installed}
              rowKey={(p) => p.slug}
              searchable
              searchPlaceholder="Search plugins…"
              exportFileName="installed-plugins"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
