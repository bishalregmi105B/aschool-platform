"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type ApiResponse } from "./api";
import { useAuth } from "./auth-context";

export interface InstalledPlugin {
  plugin_slug: string;
  active: boolean;
  installed_at: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
  billing_cycle: string;
  config: Record<string, unknown>;
}

/** A single sidebar nav item driven from plugin YAML manifest */
export interface PluginSidebarItem {
  slug: string;
  label: string;
  label_nepali: string | null;
  /** Lucide icon name string, e.g. "UserCheck" */
  icon: string;
  /** Section header this item belongs to, e.g. "Academic Management" */
  section: string | null;
  /** Fully-qualified frontend route, always starts with /dashboard */
  route: string;
  subitems: Array<{ label: string; route: string }>;
}

export interface PluginBottomNavItem {
  slug: string;
  label: string;
  icon: string;
  route: string;
  subitems?: Array<{ label: string; route: string }>;
}

interface PluginSidebarResponse {
  items: PluginSidebarItem[];
  bottom_nav: PluginBottomNavItem[];
}

interface PluginContextType {
  installedPlugins: InstalledPlugin[];
  isPluginInstalled: (slug: string) => boolean;
  isLoading: boolean;
  refreshPlugins: () => Promise<void>;
  /** Plugin-driven sidebar items from YAML manifests */
  sidebarItems: PluginSidebarItem[];
  /** Plugin-driven bottom nav items (e.g. Settings, Marketplace) */
  pluginBottomNav: PluginBottomNavItem[];
}

const PLUGIN_SLUG_ALIASES: Record<string, string> = {
  communications: "sms_notifications",
  hr: "hr_payroll",
  transport: "gps_tracking",
  visitors: "visitor_management",
  library: "library_management",
  digital_content: "elibrary",
  design_studio: "digital_content",
};

function getAcceptablePluginSlugs(slug: string): Set<string> {
  const requested = String(slug || "").trim();
  const accepted = new Set<string>();
  if (!requested) return accepted;

  accepted.add(requested);
  const frontier: string[] = [requested];

  while (frontier.length) {
    const current = frontier.pop() as string;
    const mapped = PLUGIN_SLUG_ALIASES[current];
    if (mapped && !accepted.has(mapped)) {
      accepted.add(mapped);
      frontier.push(mapped);
    }

    Object.entries(PLUGIN_SLUG_ALIASES).forEach(([from, to]) => {
      if (to === current && !accepted.has(from)) {
        accepted.add(from);
        frontier.push(from);
      }
    });
  }

  return accepted;
}

export function normalizePluginSlug(slug: string): string {
  return PLUGIN_SLUG_ALIASES[slug] ?? slug;
}

export function getPluginDisplayName(slug: string): string {
  return (
    PLUGIN_LABELS[normalizePluginSlug(slug)] ||
    PLUGIN_LABELS[slug] ||
    slug.replace(/_/g, " ")
  );
}

const PluginContext = createContext<PluginContextType | undefined>(undefined);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [sidebarItems, setSidebarItems] = useState<PluginSidebarItem[]>([]);
  const [pluginBottomNav, setPluginBottomNav] = useState<PluginBottomNavItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPlugins = async () => {
    try {
      // Fetch installed plugins and sidebar config in parallel
      const [installedRes, sidebarRes] = await Promise.allSettled([
        api.get<ApiResponse<InstalledPlugin[]>>("/plugins/installed"),
        api.get<ApiResponse<PluginSidebarResponse>>("/plugins/sidebar"),
      ]);

      if (
        installedRes.status === "fulfilled" &&
        installedRes.value.data.success
      ) {
        setPlugins(installedRes.value.data.data);
      }

      if (sidebarRes.status === "fulfilled" && sidebarRes.value.data.success) {
        const sidebarData = sidebarRes.value.data.data;
        setSidebarItems(sidebarData.items || []);
        setPluginBottomNav(sidebarData.bottom_nav || []);
      }
    } catch {
      setPlugins([]);
      setSidebarItems([]);
      setPluginBottomNav([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshPlugins();
    } else {
      setPlugins([]);
      setSidebarItems([]);
      setPluginBottomNav([]);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const isPluginInstalled = (slug: string) => {
    const acceptable = getAcceptablePluginSlugs(slug);
    return plugins.some((p) => p.active && acceptable.has(p.plugin_slug));
  };

  return (
    <PluginContext.Provider
      value={{
        installedPlugins: plugins,
        isPluginInstalled,
        isLoading,
        refreshPlugins,
        sidebarItems,
        pluginBottomNav,
      }}
    >
      {children}
    </PluginContext.Provider>
  );
}

export function useInstalledPlugins() {
  const context = useContext(PluginContext);
  if (!context)
    throw new Error("useInstalledPlugins must be used within PluginProvider");
  return context;
}

// Friendly display names for plugin slugs
const PLUGIN_LABELS: Record<string, string> = {
  design_studio: "Docs & Designer",
  attendance: "Attendance",
  fees: "Fees",
  exams: "Exams",
  lms: "Learning Management",
  library: "Library",
  hostel: "Hostel",
  transport: "Transport",
  gps_tracking: "Transport",
  hr_payroll: "HR & Payroll",
  sms_notifications: "Communications",
  whatsapp_bot: "WhatsApp Bot",
  ai_tools: "AI Tools",
  digital_content: "Digital Content",
  website_builder: "Website Builder",
  gamification: "Gamification",
  alumni: "Alumni",
  visitor_management: "Visitor Management",
  file_management: "Files",
  iemis_importer: "IEMIS Importer",
};

/**
 * PluginGate — wraps content that requires a specific plugin to be installed.
 * If the plugin is not installed, shows an upgrade prompt with a one-click
 * install button (for school_admin / superadmin).
 */
export function PluginGate({
  slug,
  children,
  fallback,
}: {
  slug: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isPluginInstalled, isLoading, refreshPlugins } =
    useInstalledPlugins();
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const normalizedSlug = normalizePluginSlug(slug);

  if (isLoading)
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  // After inline install, show children
  if (isPluginInstalled(normalizedSlug) || installed) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const displayName = getPluginDisplayName(slug);

  const handleInstall = async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const res = await api.post("/plugins/install", {
        plugin_slug: normalizedSlug,
        billing_cycle: "monthly",
      });
      if (res.data.success) {
        await refreshPlugins();
        setInstalled(true);
      } else {
        setInstallError(res.data.error || "Installation failed");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Could not install plugin. Please try again.";
      setInstallError(msg);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl text-center gap-4 min-h-[280px]">
      {/* Icon placeholder */}
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
        🔌
      </div>

      <div>
        <p className="text-lg font-semibold mb-1">
          {displayName} — Not Installed
        </p>
        <p className="text-muted-foreground text-sm max-w-xs">
          Enable the <strong>{displayName}</strong> plugin to access this
          feature. You can install it for free or start a trial.
        </p>
      </div>

      {installError && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md max-w-xs">
          {installError}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {installing ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              Installing…
            </>
          ) : (
            "Install Now — Free"
          )}
        </button>
        <a
          href={`/dashboard/marketplace`}
          className="inline-flex items-center px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          View in Marketplace
        </a>
      </div>
    </div>
  );
}
