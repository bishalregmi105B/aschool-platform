"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Search, Check, ShoppingCart, Zap, Crown, Building2, Layers } from "lucide-react";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
} from "@/lib/services/payment-methods.service";

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
  features?: string[];
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

  const { data: paymentMethodData } = useQuery({
    queryKey: ["marketplace-payment-methods"],
    queryFn: async () => {
      try {
        return await fetchPaymentMethods();
      } catch {
        return EMPTY_PAYMENT_METHODS_RESPONSE;
      }
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

  const [checkoutPkg, setCheckoutPkg] = useState<string | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<string | null>(null);

  if (isLoading) return <PageLoader />;

  const marketplace = data || {};
  const checkoutMethods = paymentMethodData?.methods.filter((item) => item.enabled) || [];
  const selectedCheckoutMethod =
    checkoutMethods.find((item) => item.key === checkoutMethod) || null;
  const allPlugins = Object.entries(marketplace).flatMap(([cat, plugins]) =>
    plugins.map((p) => ({ ...p, category: cat }))
  );

  const filtered = search
    ? allPlugins.filter((plugin) => matchesMarketplacePluginSearch(plugin, search))
    : null;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">App Marketplace & Billing</h1>
        <p className="text-muted-foreground mt-2">
          Upgrade your institution with premium features or subscribe to complete SaaS packages.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "packages" | "plugins")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="packages">SaaS Packages</TabsTrigger>
          <TabsTrigger value="plugins">Individual Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PricingTier 
              title="Starter" 
              price={29} 
              description="Perfect for small schools just getting started."
              features={['Up to 500 Students', 'Basic Attendance', 'Standard Timetable', 'Noticeboard']}
              icon={Zap}
              onSubscribe={() => setCheckoutPkg('starter')}
              isPopular={false}
            />
            <PricingTier 
              title="Professional" 
              price={99} 
              description="Full-suite academics and advanced LMS for growing schools."
              features={['Unlimited Students', 'Advanced Exams & Results', 'LMS Module Included', 'AI Tutor (500 hrs)', 'Priority Support']}
              icon={Crown}
              onSubscribe={() => setCheckoutPkg('pro')}
              isPopular={true}
            />
            <PricingTier 
              title="Enterprise" 
              price={299} 
              description="Complete digital transformation for large institutions."
              features={['Everything in Pro', 'Custom Branding', 'Transport Management', 'Library Management', 'Dedicated Account Manager']}
              icon={Building2}
              onSubscribe={() => setCheckoutPkg('enterprise')}
              isPopular={false}
            />
          </div>

          {checkoutPkg && (
            <Card className="mt-8 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle>Complete your Subscription</CardTitle>
                <CardDescription>Select a payment method to activate your {checkoutPkg} package.</CardDescription>
              </CardHeader>
              <CardContent>
                {checkoutMethods.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    No payment methods are currently available. Configure them in Integrations before starting package checkout.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {checkoutMethods.map((method) => (
                      <Button
                        key={method.key}
                        variant={checkoutMethod === method.key ? "default" : "outline"}
                        onClick={() => {
                          setCheckoutMethod(method.key);
                          if (method.mode === "online") {
                            toast.success(`Redirecting to ${method.label}...`);
                            return;
                          }
                          toast.success(`Use configured ${method.label} details to complete payment.`);
                        }}
                      >
                        Pay with {method.label}
                      </Button>
                    ))}
                  </div>
                )}

                {selectedCheckoutMethod?.supports_qr &&
                (selectedCheckoutMethod.qr_image_url ||
                  selectedCheckoutMethod.qr_payload ||
                  selectedCheckoutMethod.instructions) ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 space-y-2">
                    <p className="font-medium">{selectedCheckoutMethod.label} payment details</p>
                    {selectedCheckoutMethod.qr_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedCheckoutMethod.qr_image_url}
                        alt={`${selectedCheckoutMethod.label} QR`}
                        className="h-36 w-36 rounded border bg-white p-1"
                      />
                    ) : null}
                    {selectedCheckoutMethod.qr_payload ? (
                      <p className="text-xs break-all">QR ID: {selectedCheckoutMethod.qr_payload}</p>
                    ) : null}
                    {selectedCheckoutMethod.instructions ? (
                      <p className="text-xs">{selectedCheckoutMethod.instructions}</p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plugins" className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plugins..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((plugin) => (
                <PluginCard
                  key={plugin.slug}
                  plugin={plugin}
                  onInstall={() => installMutation.mutate(plugin.slug)}
                  onUninstall={() => uninstallMutation.mutate(plugin.slug)}
                  loading={installMutation.isPending || uninstallMutation.isPending}
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
                      onInstall={() => installMutation.mutate(plugin.slug)}
                      onUninstall={() => uninstallMutation.mutate(plugin.slug)}
                      loading={installMutation.isPending || uninstallMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PricingTier({ title, price, description, features, icon: Icon, onSubscribe, isPopular }: any) {
  return (
    <Card className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg ring-1 ring-primary' : ''}`}>
      {isPopular && (
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
          <Badge className="bg-primary text-white uppercase text-[10px] tracking-wider px-2 py-0.5">Most Popular</Badge>
        </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start mb-4">
          <Icon className={`h-8 w-8 ${isPopular ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription className="h-10 mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-6">
          <span className="text-4xl font-extrabold">${price}</span>
          <span className="text-muted-foreground font-medium">/mo</span>
        </div>
        <ul className="space-y-3">
          {features.map((f: string, i: number) => (
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
          variant={isPopular ? 'default' : 'outline'}
          onClick={onSubscribe}
        >
          Subscribe to {title}
        </Button>
      </CardFooter>
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
      installed: plugin.installed ?? (plugin as MarketplacePlugin & { is_installed?: boolean }).is_installed ?? false,
    };
    acc[category] = [...(acc[category] || []), normalizedPlugin];
    return acc;
  }, {});
}

function PluginCard({
  plugin,
  onInstall,
  onUninstall,
  loading,
}: {
  plugin: MarketplacePlugin;
  onInstall: () => void;
  onUninstall: () => void;
  loading: boolean;
}) {
  return (
    <Card className={`flex flex-col relative transition-all hover:shadow-md ${plugin.installed ? "ring-2 ring-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-500/20" : ""}`}>
      {plugin.installed && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm">
          <Check className="h-3 w-3" />
          Active
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between pr-12">
          <CardTitle className="text-lg">{plugin.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {plugin.is_free ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">Free Forever</Badge>
          ) : (
            <Badge variant="secondary" className="font-semibold">
              ${plugin.price_monthly}/mo
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
      <CardFooter className="pt-4 border-t bg-muted/20">
        {plugin.installed ? (
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
            onClick={onUninstall}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : "Cancel Subscription"}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={onInstall}
            disabled={loading}
          >
            {loading ? (
              <Spinner size="sm" />
            ) : plugin.trial_days > 0 ? (
              `Start ${plugin.trial_days}-Day Free Trial`
            ) : (
              "Add to Plan"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
