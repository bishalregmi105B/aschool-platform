"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User,
  Palette,
  Wifi,
  Shield,
  Sun,
  Moon,
  Check,
  GraduationCap,
  HardDrive,
  Layout,
  ChevronRight,
  ChevronLeft,
  Pin,
  PinOff,
  Sparkles,
  School,
  ShieldCheck,
} from "lucide-react";
import { SchoolRole, SCHOOL_PROFILES } from "../RoleSwitcherModal";
import { AOSSettingsIcon } from "../AOSIcons";
import { useAuth } from "@/lib/auth-context";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule } from "@/lib/aos-app-adapter";
import {
  getStorageUsage,
  type StorageUsage,
} from "@/lib/services/files.service";

// Version comes from package.json at build time when available (Next inlines
// npm_package_version for the package being built); fallback keeps the card
// meaningful in standalone builds.
const APP_VERSION = process.env.npm_package_version || "3.5.0";

// The school vault quota shown in Settings (matches the institutional plan).
const STORAGE_QUOTA_GB = 128;

// Last-known storage usage for instant paint / offline fallback — mirrors the
// localStorage cache pattern used by useAOSUserSettings.
const STORAGE_CACHE_KEY = "aschool_aos_storage_cache";

// ==========================================
// Embedded school / platform settings pages
// ==========================================
// The Settings app is the one-stop UI for every school + platform setting: it
// embeds the very same self-sufficient dashboard pages (react-query + api,
// no shell props needed) that deep-linked route windows render standalone.
// Lazy chunks keep the app light; deep links via AOSRouteTable still work.

/** Fluent spinner shown while an embedded settings page chunk hydrates. */
function EmbeddedPaneLoading({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        minHeight: "260px",
        color: "var(--w11-text-secondary)",
      }}
    >
      <div className="win11-spinner" />
      <span style={{ fontSize: "12px" }}>{label}</span>
    </div>
  );
}

/** School profile / branding / metadata — /dashboard/settings. */
const SchoolSettingsPage = dynamic(() => import("@/app/dashboard/settings/page"), {
  loading: () => <EmbeddedPaneLoading label="Loading school settings…" />,
});

/** Platform & Access sub-sections — /dashboard/settings/* subpages. */
type PlatformSectionId =
  | "notifications"
  | "backup"
  | "custom-fields"
  | "integrations"
  | "access-logs"
  | "roles";

const PLATFORM_SECTIONS: { id: PlatformSectionId; label: string; desc: string }[] = [
  { id: "notifications", label: "Notifications", desc: "Push, SMS & WhatsApp alerts" },
  { id: "backup", label: "Backup", desc: "Database backup status" },
  { id: "custom-fields", label: "Custom Fields", desc: "Registration form fields" },
  { id: "integrations", label: "Integrations", desc: "Payments & connected apps" },
  { id: "access-logs", label: "Access Logs", desc: "Login activity audit" },
  { id: "roles", label: "Roles", desc: "Roles & user permissions" },
];

const PLATFORM_SECTION_COMPONENTS: Record<PlatformSectionId, React.ComponentType> = {
  notifications: dynamic(() => import("@/app/dashboard/settings/notifications/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading notifications…" />,
  }),
  backup: dynamic(() => import("@/app/dashboard/settings/backup/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading backup…" />,
  }),
  "custom-fields": dynamic(() => import("@/app/dashboard/settings/custom-fields/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading custom fields…" />,
  }),
  integrations: dynamic(() => import("@/app/dashboard/settings/integrations/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading integrations…" />,
  }),
  "access-logs": dynamic(() => import("@/app/dashboard/settings/access-logs/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading access logs…" />,
  }),
  roles: dynamic(() => import("@/app/dashboard/settings/roles/page"), {
    loading: () => <EmbeddedPaneLoading label="Loading roles…" />,
  }),
};

interface PinnableApp {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
}

interface SettingsAppProps {
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  accentColor: string;
  onChangeAccent: (color: string) => void;
  wallpaper: string;
  onChangeWallpaper: (wp: string) => void;
  dockStyle?: "mac" | "win11";
  onChangeDockStyle?: (style: "mac" | "win11") => void;
  dockSize?: "small" | "medium" | "large";
  onChangeDockSize?: (size: "small" | "medium" | "large") => void;
  showTopBar?: boolean;
  onToggleTopBar?: () => void;
  topBarHeight?: "compact" | "standard" | "large";
  onChangeTopBarHeight?: (h: "compact" | "standard" | "large") => void;
  blurIntensity?: number;
  onChangeBlurIntensity?: (val: number) => void;
  taskbarAlign: "center" | "left";
  onToggleTaskbarAlign: () => void;
  brightness: number;
  onChangeBrightness: (b: number) => void;
  currentRole?: SchoolRole;
  onOpenRoleSwitcher?: () => void;
  pinnedAppIds?: string[];
  onTogglePinApp?: (id: string) => void;
}

export default function SettingsApp({
  // Defaults keep the app renderable when the module registry mounts it
  // without shell state (e.g. MobileExperience's zero-prop
  // React.createElement) — the desktop shell always passes real values.
  themeMode = "dark",
  onToggleTheme = () => {},
  accentColor = "#0078d4",
  onChangeAccent = () => {},
  wallpaper = "bloom-dark",
  onChangeWallpaper = () => {},
  dockStyle = "mac",
  onChangeDockStyle,
  dockSize = "medium",
  onChangeDockSize,
  showTopBar = true,
  onToggleTopBar,
  topBarHeight = "standard",
  onChangeTopBarHeight,
  blurIntensity = 30,
  onChangeBlurIntensity,
  taskbarAlign = "center",
  onToggleTaskbarAlign = () => {},
  brightness = 100,
  onChangeBrightness = () => {},
  currentRole = "student",
  onOpenRoleSwitcher,
  pinnedAppIds = [],
  onTogglePinApp,
}: SettingsAppProps) {
  const { user } = useAuth();
  const { sidebarItems } = useInstalledPlugins();
  const [activeCategory, setActiveCategory] = useState("personalization");
  const [mobileActiveSection, setMobileActiveSection] = useState<string | null>(null);
  const [platformSection, setPlatformSection] = useState<PlatformSectionId>("notifications");
  const [examMode, setExamMode] = useState(false);
  const [customWallpaperInput, setCustomWallpaperInput] = useState("");
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Real ASchool user profile — falls back to the simulated school profile
  // when the session user is not hydrated yet.
  const effectiveRole: SchoolRole =
    user?.role && SCHOOL_PROFILES[user.role]
      ? (user.role as SchoolRole)
      : currentRole;
  const fallbackProfile = SCHOOL_PROFILES[effectiveRole] || SCHOOL_PROFILES.student;
  const profile = {
    name: user?.full_name || fallbackProfile.name,
    roleLabel: user?.role
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/_/g, " ")
      : fallbackProfile.roleLabel,
    avatar: user?.full_name
      ? user.full_name.charAt(0).toUpperCase()
      : fallbackProfile.avatar,
    avatarUrl: user?.avatar_url,
    badgeColor: fallbackProfile.badgeColor,
    email: user?.email,
    school: user?.school_id,
  };

  // Real storage usage from /files/usage (react-query). A localStorage cache
  // gives instant first paint and an offline fallback, like aos-settings.
  const { data: usage } = useQuery({
    queryKey: ["aos-settings-storage-usage"],
    queryFn: async () => {
      const data = await getStorageUsage();
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
      } catch {
        // Ignore storage access issues
      }
      return data;
    },
    retry: false,
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      try {
        const cached = localStorage.getItem(STORAGE_CACHE_KEY);
        return cached ? (JSON.parse(cached) as StorageUsage) : undefined;
      } catch {
        return undefined;
      }
    },
  });

  const usedGB = typeof usage?.total_mb === "number" ? usage.total_mb / 1024 : null;
  const usedPct =
    usedGB != null ? Math.min(100, Math.round((usedGB / STORAGE_QUOTA_GB) * 100)) : 0;

  const colors = [
    { name: "Academic Blue", hex: "#0078d4" },
    { name: "Emerald Honor", hex: "#10b981" },
    { name: "Amethyst Scholar", hex: "#8b5cf6" },
    { name: "Amber Crimson", hex: "#d83b01" },
    { name: "Teal Science", hex: "#008272" },
    { name: "Midnight Navy", hex: "#1e3a8a" },
    { name: "Rose Gold", hex: "#f43f5e" },
    { name: "Cyber Cyan", hex: "#06b6d4" },
  ];

  // Previews match Desktop.tsx's getWallpaperBackground 1:1 so what you pick
  // is exactly what the desktop renders.
  const wallpapers = [
    { id: "bloom-dark", name: "Win11 Bloom Dark", desc: "Classic Deep Mica", preview: "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)" },
    { id: "bloom-light", name: "Win11 Bloom Light", desc: "Daylight Mica", preview: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)" },
    { id: "sonoma", name: "macOS Sonoma Aurora", desc: "Vibrant Sunset Glass", preview: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
    { id: "ventura", name: "macOS Ventura Sunburst", desc: "Pastel Dusk Glow", preview: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
    { id: "blueprint", name: "AOS Engineering Blueprint", desc: "Academic Technical", preview: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%)" },
    { id: "nebula", name: "Cosmic Nebula", desc: "Astrophysics Deep Sky", preview: "radial-gradient(ellipse at top, #312e81, #0c0a09)" },
    { id: "forest", name: "Emerald Campus Forest", desc: "Organic Botanical", preview: "linear-gradient(135deg, #14532d 0%, #166534 50%, #052e16 100%)" },
    { id: "minimal", name: "Minimalist Slate", desc: "Zero Distraction Light", preview: "linear-gradient(135deg, #f5f5f5, #e5e5e5)" },
  ];

  // Real pinnable apps: every installed ASchool module (sidebarItems mapped
  // through the AOS adapter, same as the AppDrawer/Shell pattern) plus the
  // native AOS system apps.
  const pinnableApps: PinnableApp[] = useMemo(() => {
    const list: PinnableApp[] = [];

    sidebarItems.forEach((item) => {
      const app = getAOSAppForModule(item);
      if (list.some((entry) => entry.id === app.id)) return;
      list.push({
        id: app.id,
        name: app.name,
        desc: item.section ? `${item.section} module` : "Installed ASchool module",
        icon: (
          <div
            style={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <div style={{ transform: "scale(0.62)" }}>{app.icon}</div>
          </div>
        ),
      });
    });

    list.push(
      {
        id: "appstore",
        name: "AOS App Store",
        desc: "Educational plugin marketplace",
        icon: <Sparkles size={28} color="#0ea5e9" />,
      },
      {
        id: "aos-settings",
        name: "AOS Settings",
        desc: "Personalization & customization",
        icon: <AOSSettingsIcon size={28} />,
      }
    );

    return list;
  }, [sidebarItems]);

  const storageDesc =
    usedGB != null
      ? `${usedGB.toFixed(1)} GB of ${STORAGE_QUOTA_GB} GB used`
      : "Cloud vault space & uploaded files";

  const categories = [
    { id: "personalization", label: "Themes & Wallpapers", icon: <Palette size={16} />, desc: "Mica blur, dark mode, 8 wallpapers" },
    { id: "dock", label: "Dock, Taskbar & Top Bar", icon: <Layout size={16} />, desc: "Top bar height, dock style, pin apps" },
    { id: "school", label: "School Settings", icon: <School size={16} />, desc: "School profile, branding & metadata" },
    { id: "platform", label: "Platform & Access", icon: <ShieldCheck size={16} />, desc: "Notifications, backup, roles & integrations" },
    { id: "profile", label: "User Account & Role", icon: <User size={16} />, desc: `${profile.name} (${profile.roleLabel})` },
    { id: "storage", label: "Cloud Vault Storage", icon: <HardDrive size={16} />, desc: storageDesc },
    { id: "exammode", label: "Exam & Focus Mode", icon: <Shield size={16} />, desc: examMode ? "Lockdown active" : "Normal mode" },
    { id: "network", label: "Campus Network", icon: <Wifi size={16} />, desc: "Campus 5G Secure (Connected)" },
    { id: "about", label: "About AOS", icon: <GraduationCap size={16} />, desc: `Version ${APP_VERSION} (2026)` },
  ];

  // ==========================================
  // 1. MOBILE iOS SETTINGS VIEW
  // ==========================================
  if (isMobileScreen) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--w11-window-bg)", color: "var(--w11-text-primary)", overflowY: "auto" }}>
        {mobileActiveSection ? (
          /* Sub-category Detail View with iOS Back Button */
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 14px",
                background: "var(--w11-control-bg)",
                borderBottom: "1px solid var(--w11-border-subtle)",
                position: "sticky",
                top: 0,
                zIndex: 20,
              }}
            >
              <button
                onClick={() => setMobileActiveSection(null)}
                style={{
                  all: "unset",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  color: accentColor,
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ChevronLeft size={20} />
                <span>Settings</span>
              </button>
              <span style={{ marginLeft: "12px", fontSize: "15px", fontWeight: 700 }}>
                {categories.find((c) => c.id === mobileActiveSection)?.label}
              </span>
            </div>

            <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
              {renderCategoryContent(mobileActiveSection)}
            </div>
          </div>
        ) : (
          /* Root iOS Settings View: Profile + Grouped Table */
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Apple ID Style Profile Card */}
            <div
              onClick={onOpenRoleSwitcher}
              style={{
                background: "var(--w11-card-bg)",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                border: `1px solid ${profile.badgeColor}40`,
                boxShadow: "var(--w11-shadow-card)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: profile.badgeColor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 700,
                  overflow: "hidden",
                }}
              >
                {profile.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.avatar
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1.2 }}>{profile.name}</div>
                <div style={{ fontSize: "12px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
                <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
                  ASchool ID • Tap to switch
                </div>
              </div>
              <ChevronRight size={18} color="var(--w11-text-tertiary)" />
            </div>

            {/* iOS Grouped Categories Table */}
            <div
              style={{
                background: "var(--w11-card-bg)",
                borderRadius: "16px",
                border: "1px solid var(--w11-border-subtle)",
                overflow: "hidden",
              }}
            >
              {categories.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => setMobileActiveSection(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 16px",
                    cursor: "pointer",
                    borderBottom: idx < categories.length - 1 ? "1px solid var(--w11-border-subtle)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "8px",
                        background: `${accentColor}25`,
                        color: accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {c.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>{c.label}</div>
                      <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>{c.desc}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--w11-text-tertiary)" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 2. DESKTOP SETTINGS VIEW (Sidebar + Detail)
  // ==========================================
  return (
    <div style={{ display: "flex", height: "100%", background: "var(--w11-window-bg)", color: "var(--w11-text-primary)" }}>
      {/* Desktop Left Sidebar */}
      <div
        style={{
          width: "240px",
          background: "var(--w11-control-bg)",
          borderRight: "1px solid var(--w11-border-subtle)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        {/* User Identity Banner */}
        <div
          onClick={onOpenRoleSwitcher}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "10px",
            background: "var(--w11-control-hover)",
            border: `1px solid ${profile.badgeColor}40`,
            cursor: "pointer",
          }}
          title="Click to Switch School User"
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: profile.badgeColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {profile.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              profile.avatar
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile.name}
            </div>
            <div style={{ fontSize: "11px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={activeCategory === c.id ? "accent" : "subtle"}
            style={{
              justifyContent: "flex-start",
              gap: "10px",
              fontSize: "13px",
              padding: "8px 12px",
            }}
          >
            {c.icon}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop Main Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {renderCategoryContent(activeCategory)}
      </div>
    </div>
  );

  // Helper renderer for each category
  function renderCategoryContent(catId: string) {
    switch (catId) {
      case "personalization":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Appearance & Themes</h2>

            {/* Dark / Light Toggle */}
            <div className="win11-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>System Appearance Mode</div>
                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                  Fluent 2 Mica High-Contrast Dark or Crisp Daylight Light theme.
                </div>
              </div>
              <button className="accent" onClick={onToggleTheme} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span>{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>

            {/* Wallpaper Selection Gallery */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                AOS Campus Wallpapers (8 Built-In Styles)
              </div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Choose high-resolution school campus or modern macOS / Windows aesthetic backgrounds.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                {wallpapers.map((wp) => {
                  const isSelected = wallpaper === wp.id;
                  return (
                    <div
                      key={wp.id}
                      onClick={() => onChangeWallpaper(wp.id)}
                      style={{
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: isSelected ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                        cursor: "pointer",
                        background: "var(--w11-control-bg)",
                        boxShadow: isSelected ? "0 4px 12px rgba(0,120,212,0.3)" : "none",
                      }}
                    >
                      <div
                        style={{
                          height: "65px",
                          background: wp.preview,
                          backgroundSize: "cover",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                        }}
                      >
                        {isSelected && (
                          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--w11-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={13} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700 }}>{wp.name}</div>
                        <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>{wp.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Image URL */}
              <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Paste custom wallpaper image URL (https://...)"
                  value={customWallpaperInput}
                  onChange={(e) => setCustomWallpaperInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: "var(--w11-control-bg)",
                    border: "1px solid var(--w11-border-subtle)",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    color: "inherit",
                    fontSize: "12px",
                  }}
                />
                <button
                  className="subtle"
                  onClick={() => {
                    const url = customWallpaperInput.trim();
                    if (url) {
                      onChangeWallpaper(`custom:${url}`);
                      toast.success("Custom wallpaper applied");
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Accent Color Picker */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "10px" }}>Academic Accent Color</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {colors.map((c) => (
                  <div
                    key={c.hex}
                    onClick={() => onChangeAccent(c.hex)}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: c.hex,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      boxShadow: accentColor === c.hex ? `0 0 0 3px var(--w11-window-bg), 0 0 0 5px ${c.hex}` : undefined,
                    }}
                    title={c.name}
                  >
                    {accentColor === c.hex && <Check size={15} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Display Brightness */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>
                Display Brightness & Dimmer ({brightness}%)
              </div>
              <input
                type="range"
                className="win11-slider"
                min={20}
                max={100}
                value={brightness}
                onChange={(e) => onChangeBrightness(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        );

      case "dock":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Dock, Taskbar & Top Menu Bar Customization</h2>

            {/* Top Menu Bar Resizer Settings */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>macOS Top Menu Bar Size & Scaling</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "12px" }}>
                Adjust top bar height between compact for laptops or larger touch-friendly sizes.
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                {([
                  { id: "compact", label: "Compact (26px)" },
                  { id: "standard", label: "Standard (30px)" },
                  { id: "large", label: "Large (38px)" },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    className={topBarHeight === item.id ? "accent" : "subtle"}
                    onClick={() => onChangeTopBarHeight && onChangeTopBarHeight(item.id)}
                    style={{ fontSize: "12px", padding: "6px 14px" }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "10px" }}>
                <span style={{ fontSize: "13px" }}>Show macOS Top Menu Bar</span>
                <button className={showTopBar ? "accent" : "subtle"} onClick={onToggleTopBar} style={{ fontSize: "12px" }}>
                  {showTopBar ? "Visible" : "Hidden"}
                </button>
              </div>
            </div>

            {/* Desktop Navigation Shell Style */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>Desktop Bottom Shell Style</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div
                  onClick={() => onChangeDockStyle && onChangeDockStyle("mac")}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: dockStyle === "mac" ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                    background: "var(--w11-control-bg)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                     macOS Floating Glass Dock
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                    Parabolic hover magnification, running app dots, and bounce.
                  </div>
                </div>

                <div
                  onClick={() => onChangeDockStyle && onChangeDockStyle("win11")}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: dockStyle === "win11" ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                    background: "var(--w11-control-bg)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                    ⊞ Windows 11 Taskbar
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                    Centered app badges, Start menu button, and tray clock.
                  </div>
                </div>
              </div>

              {/* Dock Icon Scale */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Dock Icon Scale</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["small", "medium", "large"] as const).map((sz) => (
                    <button
                      key={sz}
                      className={dockSize === sz ? "accent" : "subtle"}
                      onClick={() => onChangeDockSize && onChangeDockSize(sz)}
                      style={{ fontSize: "11px", padding: "4px 10px", textTransform: "capitalize" }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taskbar Alignment for Win11 mode */}
              {dockStyle === "win11" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>Taskbar Alignment</span>
                  <button className="subtle" onClick={onToggleTaskbarAlign} style={{ fontSize: "12px" }}>
                    {taskbarAlign === "center" ? "Centered" : "Left-Aligned"}
                  </button>
                </div>
              )}

              {/* Acrylic Blur Slider */}
              <div style={{ borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 600 }}>Mica & Acrylic Blur Intensity</span>
                  <span>{blurIntensity}px</span>
                </div>
                <input
                  type="range"
                  className="win11-slider"
                  min={0}
                  max={50}
                  value={blurIntensity}
                  onChange={(e) => onChangeBlurIntensity && onChangeBlurIntensity(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Dock Icon Pinning & Customization Panel */}
            <div className="win11-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Dock Icon Pinning Manager</div>
                <span style={{ fontSize: "11px", color: accentColor, fontWeight: 700 }}>
                  {pinnedAppIds.length} Apps Pinned
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Select which ASchool apps appear pinned to the bottom shelf.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pinnableApps.map((app) => {
                  const isPinned = pinnedAppIds.includes(app.id);
                  return (
                    <div
                      key={app.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--w11-control-bg)",
                        borderRadius: "8px",
                        border: "1px solid var(--w11-border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {app.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{app.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>{app.desc}</div>
                        </div>
                      </div>

                      <button
                        className={isPinned ? "accent" : "subtle"}
                        onClick={() => onTogglePinApp && onTogglePinApp(app.id)}
                        style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
                      >
                        {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
                        <span>{isPinned ? "Pinned" : "Pin"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "school":
        return (
          <div className="min-w-0">
            {/* Self-sufficient dashboard page (react-query + api). Its
                AOSPageHeader doubles as the section header inside the pane. */}
            <SchoolSettingsPage />
          </div>
        );

      case "platform": {
        const ActivePlatformSection = PLATFORM_SECTION_COMPONENTS[platformSection];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Platform & Access</h2>

            {/* Sub-section pill nav */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PLATFORM_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={platformSection === s.id ? "accent" : "subtle"}
                  onClick={() => setPlatformSection(s.id)}
                  title={s.desc}
                  style={{
                    fontSize: "12px",
                    padding: "5px 14px",
                    borderRadius: "var(--w11-radius-full)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Active sub-section — same self-sufficient dashboard pages as
                the deep-linked route windows. */}
            <div className="min-w-0">
              <ActivePlatformSection />
            </div>
          </div>
        );
      }

      case "profile":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>User Account & Role</h2>
            <div className="win11-card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: profile.badgeColor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 700,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {profile.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.avatar
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "17px", fontWeight: 700 }}>{profile.name}</div>
                <div style={{ fontSize: "13px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
                <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "4px" }}>
                  {profile.email || "ASchool workstation account"}
                  {profile.school ? ` • School ${profile.school.slice(0, 8).toUpperCase()}` : ""}
                </div>
              </div>
              <button className="accent" onClick={onOpenRoleSwitcher}>
                Switch Role
              </button>
            </div>
          </div>
        );

      case "storage":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>School Cloud Vault</h2>
            <div className="win11-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>Storage Utilization</span>
                <span style={{ fontWeight: 700 }}>
                  {usedGB != null ? `${usedGB.toFixed(1)} GB / ${STORAGE_QUOTA_GB} GB` : "— / —"}
                </span>
              </div>
              <div style={{ height: "8px", background: "var(--w11-border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${usedPct}%`, height: "100%", background: accentColor, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "8px" }}>
                {usage
                  ? `${usage.total_files} files • ${usage.total_mb.toFixed(1)} MB uploaded to the school vault`
                  : "Usage service unreachable — showing the last known state."}
              </div>
            </div>
          </div>
        );

      case "exammode":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Exam Proctor & Focus Mode</h2>
            <div className="win11-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Workstation Proctor Lockdown</div>
                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                  Blocks unauthorized tabs and locks screen to Exam Assessment.
                </div>
              </div>
              <button
                className={examMode ? "accent" : "subtle"}
                onClick={() => {
                  setExamMode(!examMode);
                  if (!examMode) {
                    toast.success("Exam lockdown enabled");
                  } else {
                    toast.info("Exam lockdown disabled");
                  }
                }}
                style={{ background: examMode ? "#ef4444" : undefined }}
              >
                {examMode ? "Lockdown Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        );

      case "network":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Campus Network</h2>
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#10b981" }}>Connected: Campus-5G-Enterprise</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "4px" }}>
                Signal: 100% • Encryption: WPA3 Academic Enterprise
              </div>
            </div>
          </div>
        );

      case "about":
      default:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>About ASchool OS</h2>
            <div className="win11-card">
              <div style={{ fontSize: "16px", fontWeight: 700, color: accentColor }}>ASchool OS Workstation Release {APP_VERSION}</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
                ASchool OS is a modern hybrid desktop environment combining macOS glass elegance with
                Windows 11 Fluent 2 power and iOS mobile agility — the AOS workstation for
                next-generation school management.
              </div>
              <div style={{ fontSize: "11px", color: "var(--w11-text-tertiary)", marginTop: "12px" }}>
                © 2026 ASchool. All rights reserved.
              </div>
            </div>
          </div>
        );
    }
  }
}
