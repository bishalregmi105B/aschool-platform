"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Download,
  Shield,
  Check,
  Zap,
  Crown,
  ShoppingCart,
  Layers,
  Trash2,
  Clock,
  Plug,
  PowerOff,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useInstalledPlugins } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { SubscribeDialog } from "@/components/plugins/subscribe-dialog";
import { formatCurrency } from "@/lib/utils";
import {
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import type { SchoolRole } from "../RoleSwitcherModal";

/**
 * AOS App Store — the unified, REAL store.
 *
 * A tabbed shell (220px sidebar) built around the live dashboard pages:
 *   • Store                → embeds /dashboard/marketplace (search, cards,
 *                            SaaS packages, checkout)
 *   • Installed            → embeds /dashboard/plugins (installed management)
 *   • Permissions (admin)  → role-access overview; actual role management
 *                            lives in Settings → Roles (real school roles).
 *
 * Sidebar category pills come from the REAL catalog categories and filter an
 * in-shell plugin grid backed by the same install / trial / activate /
 * deactivate / uninstall endpoints the marketplace uses. No demo plugins,
 * no fake purchases, no local role matrices.
 */

// ── Legacy type exports (call sites import these from AppStoreApp) ──────────

/** Legacy plugin card shape — kept exported because WindowManager types against it. */
export interface EducationalPlugin {
  id: string;
  name: string;
  category: string;
  description: string;
  longDesc?: string;
  tier: "free" | "premium";
  price: string;
  rating: number;
  downloads: string;
  version: string;
  icon?: React.ReactNode;
  accent: string;
  isInstalled: boolean;
  isActive: boolean;
  isPurchased: boolean;
  allowedRoles: SchoolRole[];
  trialDays?: number;
  isTrial?: boolean;
  trialDaysLeft?: number | null;
}

export interface AppStoreAppProps {
  currentRole?: SchoolRole;
  accentColor?: string;
  /** Legacy props kept for call-site compatibility — unused by the real store. */
  plugins?: EducationalPlugin[];
  onToggleInstall?: (pluginId: string) => void;
  onToggleActive?: (pluginId: string) => void;
  onPurchase?: (pluginId: string) => void;
  onUpdateRoles?: (pluginId: string, roles: SchoolRole[]) => void;
  onLaunchPluginDemo?: (pluginId: string) => void;
}

// ── Live catalog types (raw /plugins/marketplace payload) ────────────────────

interface RawMarketplacePlugin {
  slug: string;
  name: string;
  description: string;
  category: string;
  price_monthly?: number;
  price_yearly?: number;
  trial_days?: number;
  is_free?: boolean;
  installed?: boolean;
  install_state?: "not_installed" | "active" | "inactive";
  is_trial?: boolean;
  trial_days_left?: number | null;
  version?: string;
  coming_soon?: boolean;
}

type RawMarketplaceResponse =
  | Record<string, RawMarketplacePlugin[]>
  | RawMarketplacePlugin[];

/** Category presentation mirrors the marketplace page (real catalog tiers). */
const CATEGORY_LABELS: Record<string, string> = {
  core: "Core (Free)",
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  core: Check,
  starter: Zap,
  growth: ShoppingCart,
  premium: Crown,
};

const ADMIN_ROLES = new Set(["admin", "school_admin", "superadmin"]);

function categoryLabel(id: string): string {
  return (
    CATEGORY_LABELS[id] ||
    id.charAt(0).toUpperCase() + id.slice(1).replace(/[_-]+/g, " ")
  );
}

function pluginState(
  p: RawMarketplacePlugin
): "not_installed" | "active" | "inactive" {
  return p.install_state || (p.installed ? "active" : "not_installed");
}

// ── Live dashboard page embeds ────────────────────────────────────────────────

const MarketplaceEmbed = dynamic(() => import("@/app/dashboard/marketplace/page"), {
  loading: () => <AOSModuleLoadingState label="Loading marketplace…" />,
});

const InstalledPluginsEmbed = dynamic(() => import("@/app/dashboard/plugins/page"), {
  loading: () => <AOSModuleLoadingState label="Loading installed plugins…" />,
});

// ── Real-data plugin card (used by the sidebar category filter) ─────────────

function CategoryPluginCard({
  plugin,
  busy,
  isAdmin,
  onInstall,
  onActivate,
  onDeactivate,
  onUninstall,
  onSubscribe,
}: {
  plugin: RawMarketplacePlugin;
  busy: boolean;
  isAdmin: boolean;
  onInstall: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onUninstall: () => void;
  onSubscribe: () => void;
}) {
  const state = pluginState(plugin);
  const isActive = state === "active";
  const isInactive = state === "inactive";
  const isPaid = !plugin.is_free && (plugin.price_monthly ?? 0) > 0;
  const onTrial = isActive && plugin.is_trial === true;
  const isComingSoon = plugin.coming_soon === true;
  // Core plugins are provisioned for every school and cannot be turned off.
  const isCore = plugin.category === "core";

  return (
    <div
      className="win11-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "14px",
        borderColor: isActive ? "var(--w11-accent)" : undefined,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--w11-text-primary)", lineHeight: 1.25 }}>
          {plugin.name}
        </span>
        {isPaid ? (
          <span
            className="win11-chip"
            style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700 }}
          >
            {formatCurrency(plugin.price_monthly ?? 0)}/mo
          </span>
        ) : (
          <span className="win11-chip success" style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700 }}>
            Free
          </span>
        )}
      </div>

      <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
        {categoryLabel(plugin.category)} • v{plugin.version || "1.0.0"}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--w11-text-secondary)",
          lineHeight: 1.4,
          minHeight: "34px",
        }}
      >
        {plugin.description || "School productivity extension."}
      </div>

      {/* Live status */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minHeight: "22px" }}>
        {isActive && (
          <span className="win11-chip success" style={{ fontSize: "10px", fontWeight: 700 }}>
            <Check size={11} /> Active
          </span>
        )}
        {isInactive && (
          <span className="win11-chip warning" style={{ fontSize: "10px", fontWeight: 700 }}>
            Inactive
          </span>
        )}
        {onTrial && (
          <span className="win11-chip accent" style={{ fontSize: "10px", fontWeight: 700 }}>
            <Clock size={11} />
            {typeof plugin.trial_days_left === "number"
              ? `Trial · ${plugin.trial_days_left}d left`
              : "Trial active"}
          </span>
        )}
        {isComingSoon && (
          <span className="win11-chip" style={{ fontSize: "10px", fontWeight: 700 }}>
            Coming Soon
          </span>
        )}
      </div>

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingTop: "10px",
          borderTop: "1px solid var(--w11-border-subtle)",
          marginTop: "auto",
        }}
      >
        {!isAdmin ? (
          <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
            {isActive ? "Enabled for your school" : "Managed by your school"}
          </span>
        ) : isComingSoon ? (
          <button className="subtle" disabled title="In final testing — releasing soon" style={{ fontSize: "12px", flex: 1 }}>
            Coming Soon
          </button>
        ) : isCore && isActive ? (
          <button className="subtle" disabled style={{ fontSize: "12px", flex: 1 }}>
            <Check size={13} style={{ marginRight: "4px" }} /> Included with your plan
          </button>
        ) : state === "not_installed" ? (
          <button className="accent" onClick={onInstall} disabled={busy} style={{ fontSize: "12px", flex: 1 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : isPaid ? `Start ${plugin.trial_days || 14}-Day Free Trial` : "Install"}
          </button>
        ) : isInactive ? (
          <>
            <button className="accent" onClick={onActivate} disabled={busy} style={{ fontSize: "12px", flex: 1 }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Activate"}
            </button>
            <button
              className="subtle"
              onClick={onUninstall}
              disabled={busy}
              title="Uninstall (plugin data is preserved)"
              style={{ fontSize: "12px", color: "#ef4444", flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : onTrial ? (
          <>
            <button className="accent" onClick={onSubscribe} disabled={busy} style={{ fontSize: "12px", flex: 1 }}>
              Subscribe
            </button>
            <button
              className="subtle"
              onClick={onUninstall}
              disabled={busy}
              title="Uninstall (plugin data is preserved)"
              style={{ fontSize: "12px", color: "#ef4444", flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : isPaid ? (
          <>
            <Link
              href={`/dashboard/plugins/${plugin.slug}/settings`}
              className="subtle"
              style={{
                fontSize: "12px",
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                textDecoration: "none",
              }}
            >
              Manage
            </Link>
            <button
              className="subtle"
              onClick={onUninstall}
              disabled={busy}
              title="Uninstall (plugin data is preserved)"
              style={{ fontSize: "12px", color: "#ef4444", flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : (
          <button className="subtle" onClick={onDeactivate} disabled={busy} style={{ fontSize: "12px", flex: 1 }}>
            <PowerOff size={13} style={{ marginRight: "4px" }} /> Deactivate
          </button>
        )}
      </div>
    </div>
  );
}

// ── Admin role-access overview (real data; management lives in Settings) ─────

function PermissionsPanel({
  installed,
  isCatalogLoading,
}: {
  installed: RawMarketplacePlugin[];
  isCatalogLoading: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--w11-text-primary)" }}>
          Role Access &amp; Permissions
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--w11-text-secondary)",
            marginTop: "4px",
            maxWidth: "560px",
            lineHeight: 1.5,
          }}
        >
          Plugin visibility across the AOS desktop, dock, and mobile springboard
          follows your school&apos;s real role assignments — each account sees the
          modules its role allows. There is no per-device role switching.
        </p>
      </div>

      <div>
        <Link
          href="/dashboard/settings/roles"
          className="accent"
          style={{
            fontSize: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: "var(--w11-radius-md, 6px)",
            color: "var(--w11-accent-text, #fff)",
          }}
        >
          <Shield size={14} /> Manage School Roles
        </Link>
      </div>

      <div
        className="win11-card"
        style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
          Installed plugins &amp; station status
        </div>
        {isCatalogLoading ? (
          <AOSModuleLoadingState label="Loading plugins…" />
        ) : installed.length === 0 ? (
          <AOSEmptyState
            icon={<Plug size={34} />}
            title="No plugins installed yet"
            description="Browse the Store tab to install plugins for your school."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {installed.map((p) => {
              const isActive = pluginState(p) === "active";
              return (
                <div
                  key={p.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    background: "var(--w11-control-bg)",
                    border: "1px solid var(--w11-border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <Plug size={15} color="var(--w11-text-secondary)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                        {categoryLabel(p.category)}
                        {p.is_trial ? " • Trial" : p.is_free ? "" : ` • ${formatCurrency(p.price_monthly ?? 0)}/mo`}
                      </div>
                    </div>
                  </div>
                  <span className={`win11-chip ${isActive ? "success" : "warning"}`} style={{ fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── The store shell ───────────────────────────────────────────────────────────

export default function AppStoreApp({
  currentRole: propRole,
  accentColor = "#0ea5e9",
}: AppStoreAppProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { refreshPlugins } = useInstalledPlugins();

  const currentRole: SchoolRole = propRole || (user?.role as SchoolRole) || "student";
  const isAdmin = ADMIN_ROLES.has(user?.role || "") || currentRole === "admin";

  type StoreTab = "store" | "installed" | "permissions";
  const [activeTab, setActiveTab] = useState<StoreTab>("store");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [subscribeSlug, setSubscribeSlug] = useState<string | null>(null);

  // Real catalog — separate query key from the embedded pages' ["marketplace"]
  // cache so the shell's metadata (categories/counts) never clashes with the
  // page-level payloads.
  const { data: catalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ["aos-store-catalog"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RawMarketplaceResponse>>("/plugins/marketplace");
      const raw = res.data.data;
      const list: RawMarketplacePlugin[] = [];
      if (Array.isArray(raw)) {
        list.push(...raw);
      } else if (raw && typeof raw === "object") {
        for (const [cat, items] of Object.entries(raw)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              list.push({ ...item, category: item.category || cat });
            }
          }
        }
      }
      return list;
    },
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["aos-store-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    refreshPlugins();
  };

  // Real lifecycle mutations (same endpoints the marketplace page uses).
  const installMutation = useMutation({
    mutationFn: (slug: string) =>
      api.post("/plugins/install", { plugin_slug: slug, billing_cycle: "monthly" }),
    onSuccess: () => {
      invalidate();
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
    mutationFn: (slug: string) => api.post("/plugins/uninstall", { plugin_slug: slug }),
    onSuccess: () => {
      invalidate();
      toast.success("Plugin uninstalled — its data is preserved");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Uninstall failed")
          : "Uninstall failed";
      toast.error(typeof msg === "string" ? msg : "Uninstall failed");
    },
  });

  const busy =
    installMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    uninstallMutation.isPending;

  // Real categories with counts, straight from the catalog.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of catalog || []) {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    return [
      { id: "all", label: "All Marketplace", count: (catalog || []).length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, count]) => ({ id, label: categoryLabel(id), count })),
    ];
  }, [catalog]);

  const installedPlugins = useMemo(
    () => (catalog || []).filter((p) => pluginState(p) !== "not_installed"),
    [catalog]
  );

  const activeCount = useMemo(
    () => (catalog || []).filter((p) => pluginState(p) === "active").length,
    [catalog]
  );

  const categoryPlugins = useMemo(
    () =>
      selectedCategory === "all"
        ? []
        : (catalog || []).filter((p) => p.category === selectedCategory),
    [catalog, selectedCategory]
  );

  const subscribingPlugin = useMemo(
    () => (catalog || []).find((p) => p.slug === subscribeSlug) || null,
    [catalog, subscribeSlug]
  );

  const handleUninstall = (p: RawMarketplacePlugin) => {
    if (window.confirm(`Uninstall ${p.name}? Its data is preserved and it can be reinstalled later.`)) {
      uninstallMutation.mutate(p.slug);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "var(--w11-window-bg)",
        color: "var(--w11-text-primary)",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "220px",
          flexShrink: 0,
          background: "var(--w11-control-bg)",
          borderRight: "1px solid var(--w11-border-subtle)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          overflowY: "auto",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 8px 14px 8px",
            borderBottom: "1px solid var(--w11-border-subtle)",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 10px rgba(14, 165, 233, 0.35)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.2 }}>AOS Store</div>
            <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
              Academic Plugin Hub
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ margin: "8px 0 4px 8px", fontSize: "10px", fontWeight: 700, color: "var(--w11-text-tertiary)", textTransform: "uppercase" }}>
          Store
        </div>

        <button
          className={activeTab === "store" ? "accent" : "subtle"}
          onClick={() => setActiveTab("store")}
          style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
        >
          <Sparkles size={16} />
          <span>Store</span>
        </button>

        <button
          className={activeTab === "installed" ? "accent" : "subtle"}
          onClick={() => setActiveTab("installed")}
          style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
        >
          <Download size={16} />
          <span>Installed{installedPlugins.length > 0 ? ` (${installedPlugins.length})` : ""}</span>
        </button>

        {isAdmin && (
          <button
            className={activeTab === "permissions" ? "accent" : "subtle"}
            onClick={() => setActiveTab("permissions")}
            style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
          >
            <Shield size={16} />
            <span>Permissions</span>
          </button>
        )}

        {/* Real catalog categories */}
        <div style={{ margin: "14px 0 4px 8px", fontSize: "10px", fontWeight: 700, color: "var(--w11-text-tertiary)", textTransform: "uppercase" }}>
          Categories
        </div>

        {isCatalogLoading ? (
          <div style={{ padding: "8px 10px", fontSize: "11px", color: "var(--w11-text-secondary)" }}>
            Loading catalog…
          </div>
        ) : (
          categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.id] || Layers;
            const isSelected = activeTab === "store" && selectedCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveTab("store");
                  setSelectedCategory(c.id);
                }}
                className={isSelected ? "accent" : "subtle"}
                style={{
                  justifyContent: "flex-start",
                  fontSize: "12px",
                  padding: "6px 10px",
                  gap: "8px",
                  fontWeight: isSelected ? 600 : 400,
                }}
                title={`${c.label} — ${c.count} plugins`}
              >
                <Icon size={13} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.label}
                </span>
                <span style={{ fontSize: "10px", opacity: 0.7, flexShrink: 0 }}>{c.count}</span>
              </button>
            );
          })
        )}

        {/* Licensing banner — real school context when available */}
        <div
          style={{
            marginTop: "auto",
            padding: "10px",
            borderRadius: "8px",
            background: "var(--w11-control-hover)",
            border: "1px solid var(--w11-border-subtle)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, marginBottom: "2px" }}>
            {isAdmin ? "School Licensing" : "Your School Plan"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)", lineHeight: 1.35 }}>
            {isAdmin
              ? "Core plugins are included for every school. Install plugins, start trials, and manage subscriptions for your school."
              : "Plugins provisioned by your school appear automatically across your desktop, dock, and springboard."}
          </div>
          <div style={{ fontSize: "10px", color: "var(--w11-text-tertiary)", marginTop: "4px" }}>
            {user?.school_id
              ? `Licensed school account • ${activeCount} plugin${activeCount === 1 ? "" : "s"} active`
              : "Core plugins included with every ASchool plan"}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {activeTab === "store" &&
          (selectedCategory === "all" ? (
            /* Full real marketplace page (search, cards, packages, checkout) */
            <div className="min-w-0" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <MarketplaceEmbed />
            </div>
          ) : (
            /* Real-data grid filtered to the selected catalog category */
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  padding: "14px 18px 0 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexShrink: 0,
                }}
              >
                <button
                  className="subtle"
                  onClick={() => setSelectedCategory("all")}
                  style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <ChevronLeft size={14} /> All Marketplace
                </button>
                <span style={{ fontSize: "15px", fontWeight: 700 }}>
                  {categoryLabel(selectedCategory)}
                </span>
                <span style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                  {categoryPlugins.length} plugin{categoryPlugins.length === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px" }}>
                {isCatalogLoading ? (
                  <AOSModuleLoadingState label="Loading catalog…" />
                ) : categoryPlugins.length === 0 ? (
                  <AOSEmptyState
                    icon={<Layers size={36} />}
                    title={`No plugins in ${categoryLabel(selectedCategory)}`}
                    description="This category has no published plugins yet."
                    action={
                      <button className="subtle" onClick={() => setSelectedCategory("all")} style={{ fontSize: "12px" }}>
                        Back to All Marketplace
                      </button>
                    }
                  />
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: "14px",
                    }}
                  >
                    {categoryPlugins.map((plugin) => (
                      <CategoryPluginCard
                        key={plugin.slug}
                        plugin={plugin}
                        busy={busy}
                        isAdmin={isAdmin}
                        onInstall={() => installMutation.mutate(plugin.slug)}
                        onActivate={() => activateMutation.mutate(plugin.slug)}
                        onDeactivate={() => deactivateMutation.mutate(plugin.slug)}
                        onUninstall={() => handleUninstall(plugin)}
                        onSubscribe={() => setSubscribeSlug(plugin.slug)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

        {activeTab === "installed" && (
          /* Real installed-plugins management page */
          <div className="min-w-0" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <InstalledPluginsEmbed />
          </div>
        )}

        {activeTab === "permissions" && isAdmin && (
          <PermissionsPanel installed={installedPlugins} isCatalogLoading={isCatalogLoading} />
        )}
      </div>

      {/* Real subscribe checkout (same dialog the marketplace uses) */}
      <SubscribeDialog
        plugin={
          subscribingPlugin
            ? {
                slug: subscribingPlugin.slug,
                name: subscribingPlugin.name,
                price_monthly: subscribingPlugin.price_monthly ?? 0,
                price_yearly: subscribingPlugin.price_yearly ?? 0,
              }
            : null
        }
        open={subscribingPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setSubscribeSlug(null);
        }}
        onSubscribed={invalidate}
      />
    </div>
  );
}
