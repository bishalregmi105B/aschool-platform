"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Download,
  Check,
  Shield,
  Search,
  Play,
  Lock,
  Zap,
  Trash2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useInstalledPlugins } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { SchoolRole } from "../RoleSwitcherModal";

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
  plugins?: EducationalPlugin[];
  onToggleInstall?: (pluginId: string) => void;
  onToggleActive?: (pluginId: string) => void;
  onPurchase?: (pluginId: string) => void;
  onUpdateRoles?: (pluginId: string, roles: SchoolRole[]) => void;
  onLaunchPluginDemo?: (pluginId: string) => void;
}

interface RawMarketplacePlugin {
  slug: string;
  name: string;
  name_nepali?: string;
  description: string;
  category: string;
  price_monthly?: number;
  price_yearly?: number;
  trial_days?: number;
  is_free?: boolean;
  installed?: boolean;
  install_state?: "not_installed" | "active" | "inactive";
  is_deactivated?: boolean;
  is_trial?: boolean;
  trial_days_left?: number | null;
  version?: string;
  coming_soon?: boolean;
}

type RawMarketplaceResponse = Record<string, RawMarketplacePlugin[]> | RawMarketplacePlugin[];

const CATEGORY_ACCENTS: Record<string, string> = {
  core: "#0ea5e9",
  starter: "#10b981",
  growth: "#8b5cf6",
  premium: "#f59e0b",
  "STEM & Science": "#8b5cf6",
  "School Operations": "#10b981",
  "AI & Tutoring": "#06b6d4",
  "Campus Life": "#f59e0b",
  Assessments: "#ef4444",
};

export default function AppStoreApp({
  currentRole: propRole,
  accentColor = "#0ea5e9",
  plugins: fallbackPlugins = [],
  onLaunchPluginDemo,
}: AppStoreAppProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { installedPlugins, refreshPlugins } = useInstalledPlugins();

  const currentRole: SchoolRole = propRole || (user?.role as SchoolRole) || "student";
  const isAdmin = user?.role === "admin" || currentRole === "admin";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"store" | "installed" | "permissions">("store");
  const [rolePermissions, setRolePermissions] = useState<Record<string, SchoolRole[]>>({});

  // Fetch real catalog from /plugins/marketplace
  const { data: marketplaceData, isLoading } = useQuery({
    queryKey: ["aos-marketplace"],
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

  // Real backend mutations
  const installMutation = useMutation({
    mutationFn: (slug: string) =>
      api.post("/plugins/install", { plugin_slug: slug, billing_cycle: "monthly" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aos-marketplace"] });
      refreshPlugins();
      toast.success("Plugin installed successfully");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Install failed")
          : "Install failed";
      toast.error(typeof msg === "string" ? msg : "Install failed");
    },
  });

  const trialMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/trial`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aos-marketplace"] });
      refreshPlugins();
      toast.success("Trial activated! 14-day access granted.");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Trial activation failed")
          : "Trial activation failed";
      toast.error(typeof msg === "string" ? msg : "Trial activation failed");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aos-marketplace"] });
      refreshPlugins();
      toast.success("Plugin activated on station");
    },
    onError: () => toast.error("Activation failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/plugins/${slug}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aos-marketplace"] });
      refreshPlugins();
      toast.success("Plugin deactivated");
    },
    onError: () => toast.error("Deactivation failed"),
  });

  const uninstallMutation = useMutation({
    mutationFn: (slug: string) => api.post("/plugins/uninstall", { plugin_slug: slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aos-marketplace"] });
      refreshPlugins();
      toast.success("Plugin uninstalled");
    },
    onError: () => toast.error("Uninstall failed"),
  });

  // Merge live API data with fallback plugins for offline / demo safety
  const allPlugins: EducationalPlugin[] = useMemo(() => {
    if (marketplaceData && marketplaceData.length > 0) {
      return marketplaceData.map((p) => {
        const installedEntry = installedPlugins.find((ip) => ip.plugin_slug === p.slug);
        const isInstalled = Boolean(installedEntry || p.installed || p.install_state === "active" || p.install_state === "inactive");
        const isActive = installedEntry ? installedEntry.active : p.install_state === "active";
        const isTrial = Boolean(installedEntry?.is_trial || p.is_trial);

        const accent =
          CATEGORY_ACCENTS[p.category] ||
          CATEGORY_ACCENTS[p.category.toLowerCase()] ||
          "#0284c7";

        const allowed = rolePermissions[p.slug] || ["student", "teacher", "admin", "accountant"];

        return {
          id: p.slug,
          name: p.name,
          category: p.category.charAt(0).toUpperCase() + p.category.slice(1),
          description: p.description || "School productivity extension.",
          tier: p.is_free ? "free" : "premium",
          price: p.is_free ? "FREE" : p.price_monthly ? `$${p.price_monthly}/mo` : "$19/mo",
          rating: 4.8,
          downloads: "1.2k",
          version: p.version || "1.0.0",
          accent,
          isInstalled,
          isActive,
          isPurchased: !p.is_free && isInstalled && !isTrial,
          allowedRoles: allowed,
          trialDays: p.trial_days || 14,
          isTrial,
          trialDaysLeft: p.trial_days_left,
        };
      });
    }

    // Fallback preset demo plugins if backend is loading or unavailable
    return fallbackPlugins.map((p) => ({
      ...p,
      allowedRoles: rolePermissions[p.id] || p.allowedRoles || ["student", "teacher", "admin", "accountant"],
    }));
  }, [marketplaceData, installedPlugins, fallbackPlugins, rolePermissions]);

  const categories = [
    { id: "all", label: "All Marketplace" },
    { id: "core", label: "Core (Free)" },
    { id: "starter", label: "Starter" },
    { id: "growth", label: "Growth" },
    { id: "premium", label: "Premium" },
    { id: "stem", label: "STEM & Labs" },
    { id: "operations", label: "Operations" },
  ];

  const filteredPlugins = allPlugins.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "all" ||
      p.category.toLowerCase().includes(selectedCategory.toLowerCase());

    const matchesTab =
      activeTab === "store"
        ? true
        : activeTab === "installed"
        ? p.isInstalled
        : p.isInstalled && p.isActive;

    return matchesSearch && matchesCategory && matchesTab;
  });

  const handleUpdateRoles = (id: string, roles: SchoolRole[]) => {
    setRolePermissions((prev) => ({ ...prev, [id]: roles }));
    toast.success("Role permissions updated");
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--w11-window-bg)", color: "var(--w11-text-primary)" }}>
      {/* Sidebar Navigation */}
      <div
        style={{
          width: "220px",
          background: "var(--w11-control-bg)",
          borderRight: "1px solid var(--w11-border-subtle)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px 14px 8px", borderBottom: "1px solid var(--w11-border-subtle)" }}>
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
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.2 }}>AOS Store</div>
            <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>Academic Plugin Hub</div>
          </div>
        </div>

        <div style={{ margin: "8px 0 4px 8px", fontSize: "10px", fontWeight: 700, color: "var(--w11-text-tertiary)", textTransform: "uppercase" }}>
          Catalog
        </div>

        <button
          className={activeTab === "store" ? "accent" : "subtle"}
          onClick={() => setActiveTab("store")}
          style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
        >
          <Sparkles size={16} />
          <span>Discover Extensions</span>
        </button>

        <button
          className={activeTab === "installed" ? "accent" : "subtle"}
          onClick={() => setActiveTab("installed")}
          style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
        >
          <Download size={16} />
          <span>Installed ({allPlugins.filter((p) => p.isInstalled).length})</span>
        </button>

        {isAdmin && (
          <button
            className={activeTab === "permissions" ? "accent" : "subtle"}
            onClick={() => setActiveTab("permissions")}
            style={{ justifyContent: "flex-start", gap: "8px", fontSize: "13px" }}
          >
            <Shield size={16} />
            <span>Role Permissions</span>
          </button>
        )}

        <div style={{ margin: "14px 0 4px 8px", fontSize: "10px", fontWeight: 700, color: "var(--w11-text-tertiary)", textTransform: "uppercase" }}>
          Categories
        </div>

        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={selectedCategory === c.id ? "accent" : "subtle"}
            style={{
              justifyContent: "flex-start",
              fontSize: "12px",
              padding: "6px 10px",
              fontWeight: selectedCategory === c.id ? 600 : 400,
            }}
          >
            {c.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", padding: "10px", background: "rgba(0,120,212,0.08)", borderRadius: "8px", border: "1px solid rgba(0,120,212,0.2)" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, marginBottom: "2px" }}>
            {isAdmin ? "Admin Licensing Authority" : "Student / Faculty Mode"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)", lineHeight: 1.3 }}>
            {isAdmin
              ? "Install plugins, start free trials, and grant permission matrices."
              : "Extensions provisioned for your school station appear automatically."}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Search Bar */}
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--w11-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "var(--w11-control-bg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--w11-card-bg)",
              border: "1px solid var(--w11-border-default)",
              borderRadius: "8px",
              padding: "6px 12px",
              flex: 1,
              maxWidth: "400px",
            }}
          >
            <Search size={16} color="var(--w11-text-tertiary)" />
            <input
              type="text"
              placeholder="Search plugins, AI simulators, tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ all: "unset", fontSize: "13px", color: "inherit", width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
              {isLoading ? "Connecting catalog..." : `${filteredPlugins.length} Extensions Found`}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px" }}>
          {activeTab === "permissions" ? (
            /* Role Permission Matrix */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "var(--w11-card-bg)", padding: "16px", borderRadius: "12px", border: "1px solid var(--w11-border-subtle)" }}>
                <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  School Role Access Restriction Matrix
                </div>
                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "16px" }}>
                  Control which school user roles can access and view each active educational plugin across Desktop, Dock, and Mobile Springboard.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {allPlugins.filter((p) => p.isInstalled).map((plugin) => (
                    <div
                      key={plugin.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--w11-control-bg)",
                        borderRadius: "8px",
                        border: "1px solid var(--w11-border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: plugin.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                          <Zap size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{plugin.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                            Status: {plugin.isActive ? "🟢 Active on Station" : "⚪ Inactive"}
                          </div>
                        </div>
                      </div>

                      {/* Role Checkboxes */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {(["student", "teacher", "admin", "accountant"] as SchoolRole[]).map((role) => {
                          const isChecked = plugin.allowedRoles.includes(role);
                          return (
                            <label
                              key={role}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                textTransform: "capitalize",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const nextRoles = e.target.checked
                                    ? [...plugin.allowedRoles, role]
                                    : plugin.allowedRoles.filter((r) => r !== role);
                                  handleUpdateRoles(plugin.id, nextRoles);
                                }}
                              />
                              <span>{role}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Plugin Cards Grid */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "16px",
              }}
            >
              {filteredPlugins.map((plugin) => {
                const isPermitted = plugin.allowedRoles.includes(currentRole);
                return (
                  <div key={plugin.id} className="win11-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Header */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: plugin.accent,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          boxShadow: `0 6px 14px ${plugin.accent}40`,
                          flexShrink: 0,
                        }}
                      >
                        <Zap size={20} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {plugin.name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "6px",
                              background: plugin.tier === "premium" ? "#f59e0b25" : "#10b98125",
                              color: plugin.tier === "premium" ? "#d97706" : "#059669",
                              border: `1px solid ${plugin.tier === "premium" ? "#f59e0b50" : "#10b98150"}`,
                            }}
                          >
                            {plugin.tier === "premium" ? plugin.price : "FREE"}
                          </span>
                        </div>

                        <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
                          {plugin.category} • v{plugin.version}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", lineHeight: 1.4, minHeight: "36px" }}>
                      {plugin.description}
                    </div>

                    {/* Permission Status Pill */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {isPermitted ? (
                          <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Check size={12} /> Active for {currentRole}
                          </span>
                        ) : (
                          <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Lock size={12} /> Restricted
                          </span>
                        )}
                      </div>

                      {plugin.isTrial && (
                        <span style={{ color: "#0ea5e9", display: "flex", alignItems: "center", gap: "2px", fontWeight: 600 }}>
                          <Clock size={11} />
                          {plugin.trialDaysLeft !== null && plugin.trialDaysLeft !== undefined
                            ? `${plugin.trialDaysLeft}d Trial`
                            : "Active Trial"}
                        </span>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--w11-border-subtle)",
                        marginTop: "auto",
                        gap: "8px",
                      }}
                    >
                      {isAdmin ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", justifyContent: "space-between" }}>
                          {!plugin.isInstalled ? (
                            <>
                              {plugin.tier === "premium" ? (
                                <button
                                  className="accent"
                                  onClick={() => trialMutation.mutate(plugin.id)}
                                  disabled={trialMutation.isPending}
                                  style={{ fontSize: "12px", padding: "5px 12px", flex: 1 }}
                                >
                                  Start {plugin.trialDays || 14}-Day Trial
                                </button>
                              ) : (
                                <button
                                  className="accent"
                                  onClick={() => installMutation.mutate(plugin.id)}
                                  disabled={installMutation.isPending}
                                  style={{ fontSize: "12px", padding: "5px 12px", flex: 1 }}
                                >
                                  Install Free
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                className={plugin.isActive ? "accent" : "subtle"}
                                onClick={() => {
                                  if (plugin.isActive) {
                                    deactivateMutation.mutate(plugin.id);
                                  } else {
                                    activateMutation.mutate(plugin.id);
                                  }
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "5px 10px",
                                  background: plugin.isActive ? "#10b981" : undefined,
                                  color: plugin.isActive ? "#fff" : undefined,
                                }}
                              >
                                {plugin.isActive ? "Active (Toggle Off)" : "Activate"}
                              </button>

                              <button
                                className="subtle"
                                onClick={() => uninstallMutation.mutate(plugin.id)}
                                disabled={uninstallMutation.isPending}
                                title="Uninstall Plugin"
                                style={{ color: "#ef4444", fontSize: "11px", padding: "5px 8px" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {onLaunchPluginDemo && (
                            <button
                              className="subtle"
                              onClick={() => onLaunchPluginDemo(plugin.id)}
                              title="Launch in Window"
                              style={{ fontSize: "11px", padding: "5px 8px" }}
                            >
                              <Play size={12} style={{ marginRight: "3px" }} />
                              Test
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                            {plugin.isInstalled ? "🟢 Station Enabled" : "⚪ Managed by Principal"}
                          </span>
                          {onLaunchPluginDemo && plugin.isInstalled && (
                            <button
                              className="accent"
                              onClick={() => onLaunchPluginDemo(plugin.id)}
                              style={{ fontSize: "11px", padding: "4px 10px" }}
                            >
                              <Play size={12} style={{ marginRight: "4px" }} />
                              Open
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
