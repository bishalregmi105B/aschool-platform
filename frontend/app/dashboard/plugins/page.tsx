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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Plugin</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installed.map((plugin) => {
                  const state = plugin.install_state!;
                  const isActive = state === "active";
                  const onTrial = isActive && plugin.is_trial === true;
                  return (
                    <TableRow key={plugin.slug} className={isActive ? "" : "opacity-70"}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PluginIcon emoji={plugin.emoji} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{plugin.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {plugin.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {plugin.category || "add_on"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {onTrial ? (
                          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-none">
                            Trial{typeof plugin.trial_days_left === "number" ? ` · ${plugin.trial_days_left}d left` : ""}
                          </Badge>
                        ) : plugin.is_free ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                            Free
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-semibold">
                            {formatCurrency(plugin.price_monthly)}/mo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isActive}
                          disabled={busy}
                          aria-label={`Activate or deactivate ${plugin.name}`}
                          onCheckedChange={(checked) =>
                            checked
                              ? activateMutation.mutate(plugin.slug)
                              : deactivateMutation.mutate(plugin.slug)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/plugins/${plugin.slug}/settings`}>
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
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Uninstall ${plugin.name}? Its data is preserved and it can be reinstalled later.`
                                )
                              ) {
                                uninstallMutation.mutate(plugin.slug);
                              }
                            }}
                          >
                            {uninstallMutation.isPending &&
                            uninstallMutation.variables === plugin.slug ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Uninstall
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
