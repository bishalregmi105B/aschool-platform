"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type ApiResponse } from "@/lib/api";
import { useInstalledPlugins } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchesMarketplacePluginSearch } from "@/lib/marketplace-search";
import { formatCurrency } from "@/lib/utils";
import { SubscribeDialog } from "@/components/plugins/subscribe-dialog";
import { Search, Check, ShoppingCart, Zap, Crown, Building2, Layers, Settings } from "lucide-react";

/**
 * Marketplace card states are driven entirely by the live catalog response
 * (plugin-architecture batch audits E160/E164 — FIX_STATUS §14) — no local
 * price literals, no "Cancel Subscription":
 *   FREE  not installed        → Install (instant, no trial copy)
 *   FREE  installed active     → Deactivate / (deactivated) Activate
 *   PAID  not installed        → Start {trial_days}-Day Free Trial
 *   PAID  trial active         → Trial · N days left — Subscribe
 *   PAID  subscribed           → Manage (settings) + Uninstall
 *
 * Core-category plugins are provisioned ACTIVE for every school
 * automatically (backend ensure_free_plugins) and cannot be deactivated or
 * uninstalled (backend returns 400) — they show the ACTIVE badge with no
 * lifecycle buttons at all ("Included with your plan").
 */

interface MarketplacePlugin {
  slug: string;
  name: string;
  name_nepali?: string;
  description: string;
  category: string;
  price_monthly: number;
  price_yearly: number;
  trial_days: number;
  is_free: boolean;
  installed: boolean;
  /** WP-style lifecycle from the API: not_installed | active | inactive */
  install_state?: "not_installed" | "active" | "inactive";
  is_deactivated?: boolean;
  is_trial?: boolean;
  trial_days_left?: number | null;
  can_subscribe?: boolean;
  version?: string;
  features?: string[];
  /** E230: in final testing — card disabled, not installable yet */
  coming_soon?: boolean;
  /** E230: legacy slug kept for alias compatibility (canonical successor exists) */
  deprecated?: boolean;
}

interface MarketplaceData {
  [category: string]: MarketplacePlugin[];
}

type MarketplaceResponse = MarketplaceData | MarketplacePlugin[];

const categoryIcons: Record<string, React.ElementType> = {
  core: Check,
  starter: Zap,
  growth: ShoppingCart,
  premium: Crown,
};

const categoryLabels: Record<string, string> = {
  core: "Core (Free)",
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
};

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const querySearch = (searchParams.get("search") || "").trim();
  const initialSearch = querySearch;
  const [search, setSearch] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState<"packages" | "plugins">(
    initialSearch ? "plugins" : "packages"
  );
  const queryClient = useQueryClient();
  const { refreshPlugins } = useInstalledPlugins();

  useEffect(() => {
    setSearch(querySearch);
    setActiveTab(querySearch ? "plugins" : "packages");
  }, [querySearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MarketplaceResponse>>("/plugins/marketplace");
      return normalizeMarketplace(res.data.data);
    },
  });

  const installMutation = useMutation({
    mutationFn: (slug: string) =>
      api.post("/plugins/install", { plugin_slug: slug, billing_cycle: "monthly" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      refreshPlugins();
      toast.success("Plugin installed!");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Install failed")
          : "Install failed";
      toast.error(typeof msg === "string" ? msg : "Install failed");
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (slug: string) =>
      api.post("/plugins/uninstall", { plugin_slug: slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      refreshPlugins();
      toast.success("Plugin uninstalled");
    },
    onError: () => toast.error("Uninstall failed"),
  });

  const activateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      refreshPlugins();
      toast.success("Plugin activated");
    },
    onError: () => toast.error("Activate failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      refreshPlugins();
      toast.success("Plugin deactivated");
    },
    onError: () => toast.error("Deactivate failed"),
  });

  const [subscribeSlug, setSubscribeSlug] = useState<string | null>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<string | null>(null);
  // E233: Individual Plugins tab — show what is active for THIS school.
  const [installFilter, setInstallFilter] = useState<
    "all" | "active" | "not_installed"
  >("all");

  if (isLoading) return <PageLoader />;

  const marketplace = data || {};
  const allPlugins = Object.entries(marketplace).flatMap(([cat, plugins]) =>
    plugins.map((p) => ({ ...p, category: cat }))
  );

  const activeCount = allPlugins.filter((p) => p.install_state === "active").length;
  const deactivatedCount = allPlugins.filter(
    (p) => p.install_state === "inactive"
  ).length;

  const filtered = (
    search
      ? allPlugins.filter((plugin) => matchesMarketplacePluginSearch(plugin, search))
      : allPlugins
  ).filter((plugin) =>
    installFilter === "all"
      ? true
      : installFilter === "active"
        ? plugin.install_state === "active"
        : plugin.install_state !== "active"
  );
  const isSearching = Boolean(search);

  const subscribingPlugin =
    allPlugins.find((p) => p.slug === subscribeSlug) || null;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">App Marketplace & Billing</h1>
        <p className="text-muted-foreground mt-2">
          Install plugins individually or upgrade to a complete SaaS package.{" "}
          <Link href="/dashboard/plugins" className="text-primary underline-offset-4 hover:underline">
            Manage installed plugins →
          </Link>
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "packages" | "plugins")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="packages">SaaS Packages</TabsTrigger>
          <TabsTrigger value="plugins">Individual Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-6">
          <PackageTiers allPlugins={allPlugins} onSubscribe={(tier) => setCheckoutPkg(tier)} />
          {checkoutPkg && (
            <PackageCheckout
              pkg={checkoutPkg}
              allPlugins={allPlugins}
              onDone={() => setCheckoutPkg(null)}
            />
          )}
        </TabsContent>

        <TabsContent value="plugins" className="space-y-6">
          {/* E233: what is ACTIVE for this school — count summary + filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setInstallFilter("all")}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  installFilter === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                }`}
              >
                All ({allPlugins.length})
              </button>
              <button
                onClick={() => setInstallFilter("active")}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  installFilter === "active"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "hover:bg-muted"
                }`}
              >
                Installed &amp; Active ({activeCount})
              </button>
              <button
                onClick={() => setInstallFilter("not_installed")}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  installFilter === "not_installed"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                }`}
              >
                Not installed ({allPlugins.length - activeCount - deactivatedCount})
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            <span className="font-medium text-foreground">{activeCount}</span>{" "}
            plugin{activeCount === 1 ? "" : "s"} active for your school
            {deactivatedCount > 0
              ? ` · ${deactivatedCount} deactivated (enable them from Installed Plugins)`
              : ""}
            .
          </p>

          {isSearching || installFilter !== "all" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((plugin) => (
                <PluginCard
                  key={plugin.slug}
                  plugin={plugin}
                  busy={
                    installMutation.isPending ||
                    uninstallMutation.isPending ||
                    activateMutation.isPending ||
                    deactivateMutation.isPending
                  }
                  onInstall={() => installMutation.mutate(plugin.slug)}
                  onUninstall={() => uninstallMutation.mutate(plugin.slug)}
                  onActivate={() => activateMutation.mutate(plugin.slug)}
                  onDeactivate={() => deactivateMutation.mutate(plugin.slug)}
                  onSubscribe={() => setSubscribeSlug(plugin.slug)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-muted-foreground col-span-3 text-center py-8">
                  No plugins match your search.
                </p>
              )}
            </div>
          ) : (
            Object.entries(marketplace).map(([category, plugins]) => (
              <div key={category} className="space-y-4 mb-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  {(() => {
                    const Icon = categoryIcons[category] || Layers;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <h2 className="text-xl font-semibold">
                    {categoryLabels[category] || category}
                  </h2>
                  <Badge variant="secondary" className="ml-2">{plugins.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plugins.map((plugin) => (
                    <PluginCard
                      key={plugin.slug}
                      plugin={plugin}
                      busy={
                        installMutation.isPending ||
                        uninstallMutation.isPending ||
                        activateMutation.isPending ||
                        deactivateMutation.isPending
                      }
                      onInstall={() => installMutation.mutate(plugin.slug)}
                      onUninstall={() => uninstallMutation.mutate(plugin.slug)}
                      onActivate={() => activateMutation.mutate(plugin.slug)}
                      onDeactivate={() => deactivateMutation.mutate(plugin.slug)}
                      onSubscribe={() => setSubscribeSlug(plugin.slug)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <SubscribeDialog
        plugin={subscribingPlugin}
        open={subscribingPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setSubscribeSlug(null);
        }}
        onSubscribed={() => {
          queryClient.invalidateQueries({ queryKey: ["marketplace"] });
          refreshPlugins();
        }}
      />
    </div>
  );
}

/** SaaS package = a curated, realistic selection of catalog plugins (E233).
 *  Membership is fixed below; the PRICE is still derived live from the
 *  catalog — the sum of the selected plugins' monthly prices, no local
 *  price literals. Coming-soon plugins are never part of a package.
 *
 *  Bands (with every starter plugin at NPR 99, growth 149-199, premium 299):
 *    Starter      = fees + exams + timetable + sms_notifications     → 396
 *    Professional = Starter + admission + lms                        → 694
 *    Enterprise   = Professional + assignments + elibrary +
 *                   library_management                                → 991
 *  Summing EVERY plugin in a tier cannot land in these bands (the catalog
 *  has ~35 paid plugins), so packages are selections, not tier dumps —
 *  see WP_PLUGIN_ARCHITECTURE_DESIGN.md §17 for the rationale. */
const PACKAGE_PLUGIN_SELECTIONS: Record<string, string[]> = {
  starter: ["fees", "exams", "timetable", "sms_notifications"],
  growth: [
    "fees",
    "exams",
    "timetable",
    "sms_notifications",
    "admission",
    "lms",
  ],
  premium: [
    "fees",
    "exams",
    "timetable",
    "sms_notifications",
    "admission",
    "lms",
    "assignments",
    "elibrary",
    "library_management",
  ],
};

function buildPackages(allPlugins: MarketplacePlugin[]) {
  const bySlug = new Map(allPlugins.map((p) => [p.slug, p]));
  const selection = (key: string): MarketplacePlugin[] =>
    (PACKAGE_PLUGIN_SELECTIONS[key] || [])
      .map((slug) => bySlug.get(slug))
      .filter((p): p is MarketplacePlugin => Boolean(p));

  const make = (key: string, title: string, description: string, icon: React.ElementType, isPopular: boolean) => {
    const tierPlugins = selection(key);
    const names = tierPlugins
      .filter((p) => p.install_state !== "active")
      .slice(0, 4)
      .map((p) => p.name);
    return {
      key,
      title,
      description,
      icon,
      isPopular,
      price: tierPlugins.reduce((sum, p) => sum + (p.price_monthly || 0), 0),
      pluginCount: tierPlugins.length,
      highlights: [
        `${tierPlugins.length} plugins included`,
        ...names,
      ],
    };
  };

  return [
    make("starter", "Starter", "Perfect for small schools just getting started.", Zap, false),
    make("growth", "Professional", "Full-suite academics and advanced plugins for growing schools.", Crown, true),
    make("premium", "Enterprise", "Complete digital transformation for large institutions.", Building2, false),
  ];
}

function PackageTiers({
  allPlugins,
  onSubscribe,
}: {
  allPlugins: MarketplacePlugin[];
  onSubscribe: (tier: string) => void;
}) {
  const packages = useMemo(() => buildPackages(allPlugins), [allPlugins]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {packages.map((pkg) => (
        <Card key={pkg.key} className={`relative flex flex-col ${pkg.isPopular ? "border-primary shadow-lg ring-1 ring-primary" : ""}`}>
          {pkg.isPopular && (
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
              <Badge className="bg-primary text-white uppercase text-[10px] tracking-wider px-2 py-0.5">Most Popular</Badge>
            </div>
          )}
          <CardHeader>
            <div className="flex justify-between items-start mb-4">
              <pkg.icon className={`h-8 w-8 ${pkg.isPopular ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <CardTitle className="text-2xl font-bold">{pkg.title}</CardTitle>
            <CardDescription className="h-10 mt-2">{pkg.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-6">
              <span className="text-4xl font-extrabold">NPR {pkg.price.toLocaleString()}</span>
              <span className="text-muted-foreground font-medium">/mo</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Aggregate monthly price of the {pkg.pluginCount} catalog plugins in this plan.
            </p>
            <ul className="space-y-3">
              {pkg.highlights.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={pkg.isPopular ? "default" : "outline"}
              onClick={() => onSubscribe(pkg.key)}
            >
              Subscribe to {pkg.title}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function PackageCheckout({
  pkg,
  allPlugins,
  onDone,
}: {
  pkg: string;
  allPlugins: MarketplacePlugin[];
  onDone: () => void;
}) {
  const packages = useMemo(() => buildPackages(allPlugins), [allPlugins]);
  const selected = packages.find((p) => p.key === pkg);
  const bySlug = new Map(allPlugins.map((p) => [p.slug, p]));
  // E233: the checkout mirrors the package's curated selection.
  const pluginsInPlan = (PACKAGE_PLUGIN_SELECTIONS[pkg] || [])
    .map((slug) => bySlug.get(slug))
    .filter((p): p is MarketplacePlugin => Boolean(p));
  const notInstalled = pluginsInPlan.filter((p) => p.install_state !== "active");

  return (
    <Card className="mt-8 border-primary bg-primary/5">
      <CardHeader>
        <CardTitle>Complete your Subscription</CardTitle>
        <CardDescription>
          The {selected?.title} package covers {pluginsInPlan.length} plugins
          {selected ? ` (NPR ${selected.price.toLocaleString()}/mo aggregate)` : ""}.
          Package checkout records an offline payment reference per plugin —
          individual plugins can also be subscribed from their cards below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notInstalled.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every plugin in this plan is already installed on your school.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Not yet installed ({notInstalled.length}):</p>
            <div className="flex flex-wrap gap-2">
              {notInstalled.map((p) => (
                <Badge key={p.slug} variant="secondary">
                  {p.name} · {formatCurrency(p.price_monthly)}/mo
                </Badge>
              ))}
            </div>
          </div>
        )}
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
      </CardContent>
    </Card>
  );
}

function normalizeMarketplace(data: MarketplaceResponse | undefined): MarketplaceData {
  if (!data) return {};
  if (!Array.isArray(data)) return data;

  return data.reduce<MarketplaceData>((acc, plugin) => {
    const category = plugin.category || "other";
    const normalizedPlugin: MarketplacePlugin = {
      ...plugin,
      installed:
        plugin.install_state === "active" ||
        (plugin.installed ?? (plugin as MarketplacePlugin & { is_installed?: boolean }).is_installed ?? false),
    };
    acc[category] = [...(acc[category] || []), normalizedPlugin];
    return acc;
  }, {});
}

function PluginCard({
  plugin,
  busy,
  onInstall,
  onUninstall,
  onActivate,
  onDeactivate,
  onSubscribe,
}: {
  plugin: MarketplacePlugin;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onSubscribe: () => void;
}) {
  const state = plugin.install_state || (plugin.installed ? "active" : "not_installed");
  const isActive = state === "active";
  const isInactive = state === "inactive";
  const isPaid = !plugin.is_free && plugin.price_monthly > 0;
  const onTrial = isActive && plugin.is_trial === true;
  const isComingSoon = plugin.coming_soon === true;
  // Core plugins are part of the school's base plan — always active, never
  // deactivatable/uninstallable (the backend enforces this with a 400 too).
  const isCore = plugin.category === "core";

  const ring =
    isActive
      ? "ring-2 ring-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-500/20"
      : isInactive
        ? "ring-2 ring-amber-500/30 border-amber-500/20"
        : "";

  return (
    <Card className={`flex flex-col relative transition-all hover:shadow-md ${ring}`}>
      {isActive && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm">
          <Check className="h-3 w-3" />
          Active
        </div>
      )}
      {isInactive && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm">
          Inactive
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between pr-12">
          <CardTitle className="text-lg">{plugin.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {isPaid ? (
            <Badge variant="secondary" className="font-semibold">
              {formatCurrency(plugin.price_monthly)}/mo
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">Free Forever</Badge>
          )}
          {onTrial && (
            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-none">
              Trial{typeof plugin.trial_days_left === "number" ? ` · ${plugin.trial_days_left}d left` : ""}
            </Badge>
          )}
          {isComingSoon && (
            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none">
              Coming Soon
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="text-sm leading-relaxed">{plugin.description}</CardDescription>
        {plugin.features && plugin.features.length > 0 && (
          <ul className="mt-4 space-y-2">
            {plugin.features.slice(0, 3).map((f) => (
              <li key={f} className="text-sm text-muted-foreground flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t bg-muted/20 gap-2">
        {isComingSoon ? (
          // E230: in final testing — install disabled with an explanatory tooltip
          <Button className="w-full" disabled title="In final testing — releasing soon">
            Coming Soon
          </Button>
        ) : isCore && isActive ? (
          // Core plugins are provisioned for every school and cannot be
          // turned off — no lifecycle CTA at all.
          <Button variant="outline" className="w-full" disabled>
            <Check className="h-4 w-4 mr-1" />
            Included with your plan
          </Button>
        ) : (
          <>
            {state === "not_installed" && isPaid && (
              <Button className="w-full" onClick={onInstall} disabled={busy}>
                {busy ? <Spinner size="sm" /> : `Start ${plugin.trial_days || 14}-Day Free Trial`}
              </Button>
            )}
            {state === "not_installed" && !isPaid && (
              <Button className="w-full" onClick={onInstall} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Install"}
              </Button>
            )}
            {isInactive && (
              <>
                <Button className="flex-1" onClick={onActivate} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Activate"}
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={onUninstall}
                  disabled={busy}
                  title="Uninstall (removes the plugin, data preserved)"
                >
                  Uninstall
                </Button>
              </>
            )}
            {isActive && isPaid && !onTrial && (
              <>
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/dashboard/plugins/${plugin.slug}/settings`}>
                    <Settings className="h-4 w-4 mr-1" />
                    Manage
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={onUninstall}
                  disabled={busy}
                >
                  {busy ? <Spinner size="sm" /> : "Uninstall"}
                </Button>
              </>
            )}
            {isActive && onTrial && (
              <>
                <Button className="flex-1" onClick={onSubscribe} disabled={busy}>
                  {busy ? (
                    <Spinner size="sm" />
                  ) : (
                    `Trial · ${plugin.trial_days_left ?? 0} days left — Subscribe`
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={onUninstall}
                  disabled={busy}
                >
                  {busy ? <Spinner size="sm" /> : "Uninstall"}
                </Button>
              </>
            )}
            {isActive && !isPaid && (
              <Button variant="outline" className="w-full" onClick={onDeactivate} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Deactivate"}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
