"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Wifi,
  Battery,
  Bell,
  Sparkles,
  ArrowLeft,
  X,
  Monitor,
} from "lucide-react";
import { useInstalledPlugins } from "@/lib/plugins";
import {
  getAOSAppForModule,
  normalizeAOSModuleId,
  type AOSApp,
} from "@/lib/aos-app-adapter";
import { resolveModuleComponent } from "./AOSModuleRegistry";
import IOSControlCenter from "./IOSControlCenter";
import IOSNotificationCenter from "./IOSNotificationCenter";
import { useAuth } from "@/lib/auth-context";
import { useServerTime } from "@/lib/use-server-time";
import {
  AOS_MODE_STORAGE_KEY,
  buildAOSRouteWindowId,
  extractAOSModuleSlug,
  formatAOSRouteTitle,
  isAOSRootModuleRoute,
  normalizeAOSRoute,
} from "@/lib/aos-navigation";

interface MobileExperienceProps {
  currentRole?: string;
  onOpenRoleSwitcher?: () => void;
  wallpaper?: string;
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
  accentColor?: string;
  onChangeAccent?: (color: string) => void;
  onChangeWallpaper?: (wp: string) => void;
  brightness?: number;
  onChangeBrightness?: (val: number) => void;
  activeApp?: string | null;
  onSelectApp?: (appId: string | null) => void;
}

export default function MobileExperience({
  currentRole = "admin",
  onOpenRoleSwitcher,
  wallpaper = "bloom-dark",
  themeMode = "dark",
  onToggleTheme = () => {},
  accentColor = "#0078d4",
  onChangeAccent = () => {},
  onChangeWallpaper = () => {},
  brightness = 100,
  onChangeBrightness = () => {},
  activeApp: controlledActiveApp,
  onSelectApp,
}: MobileExperienceProps) {
  const [internalActiveApp, setInternalActiveApp] = useState<string | null>(null);
  const activeApp = controlledActiveApp !== undefined ? controlledActiveApp : internalActiveApp;

  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  const { sidebarItems, pluginBottomNav } = useInstalledPlugins();
  const { user } = useAuth();
  const serverTime = useServerTime();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelectApp = useCallback(
    (id: string | null) => {
      if (onSelectApp) {
        onSelectApp(id);
      } else {
        setInternalActiveApp(id);
      }
    },
    [onSelectApp]
  );

  useEffect(() => {
    const updateTime = () => {
      const now = serverTime ? new Date(serverTime.epochMs) : new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [serverTime]);

  const getWallpaperBackground = () => {
    if (wallpaper?.startsWith("custom:")) {
      const url = wallpaper.replace("custom:", "");
      return `url('${url}') center / cover no-repeat`;
    }

    switch (wallpaper) {
      case "bloom-dark":
        return "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)";
      case "bloom-light":
        return "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)";
      case "sonoma":
        return "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #064e3b 100%)";
      case "ventura":
        return "linear-gradient(135deg, #f97316 0%, #ea580c 30%, #c2410c 60%, #451a03 100%)";
      case "blueprint":
        return "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0284c7 100%)";
      case "nebula":
        return "linear-gradient(135deg, #09090b 0%, #3b0764 40%, #701a75 70%, #030712 100%)";
      case "forest":
        return "linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 70%, #0f172a 100%)";
      case "minimal":
        return "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)";
      default:
        return themeMode === "dark"
          ? "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)"
          : "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)";
    }
  };

  // Convert all dynamic sidebar and bottom items into AOSApps
  const allApps: AOSApp[] = useMemo(() => {
    const apps = sidebarItems.map((item) => getAOSAppForModule(item));
    // Add bottom nav items if not present
    for (const b of pluginBottomNav) {
      const moduleId = normalizeAOSModuleId(b.slug, b.route) || b.slug;
      if (!apps.some((a) => a.id === moduleId)) {
        apps.push({
          id: moduleId,
          name: b.label,
          route: b.route || `/dashboard/${moduleId}`,
          category: "System",
          defaultWidth: 800,
          defaultHeight: 600,
          icon: (
            <div
              className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #0078D4, #005A9E)" }}
            >
              <Sparkles className="w-7 h-7" />
            </div>
          ),
        });
      }
    }
    return apps;
  }, [sidebarItems, pluginBottomNav]);

  // Bottom dock apps (pick top 4)
  const dockApps = useMemo(() => {
    const preferred = ["students", "attendance", "timetable", "fees"];
    const found = allApps.filter((a) => preferred.includes(a.id));
    if (found.length >= 4) return found.slice(0, 4);
    // Fill up to 4
    for (const a of allApps) {
      if (found.length >= 4) break;
      if (!found.some((x) => x.id === a.id)) found.push(a);
    }
    return found;
  }, [allApps]);

  const routeTitleMap = useMemo(() => {
    const map = new Map<string, string>();

    const addRoute = (route: string | undefined, title: string) => {
      if (!route) return;
      const normalized = normalizeAOSRoute(route);
      if (!normalized) return;
      map.set(normalized.split("?")[0], title);
    };

    for (const item of sidebarItems) {
      addRoute(item.route, item.label);
      for (const sub of item.subitems || []) {
        addRoute(sub.route, sub.label);
      }
    }

    for (const item of pluginBottomNav) {
      addRoute(item.route, item.label);
      for (const sub of item.subitems || []) {
        addRoute(sub.route, sub.label);
      }
    }

    return map;
  }, [sidebarItems, pluginBottomNav]);

  const openRouteInMobile = useCallback(
    (rawRoute: string): boolean => {
      const normalizedRoute = normalizeAOSRoute(rawRoute);
      if (!normalizedRoute) return false;

      const moduleSlug = extractAOSModuleSlug(normalizedRoute);
      const moduleId = normalizeAOSModuleId(moduleSlug || "", normalizedRoute);
      if (!moduleId) return false;

      if (isAOSRootModuleRoute(normalizedRoute)) {
        handleSelectApp(moduleId);
        return true;
      }

      const routeWindowId = buildAOSRouteWindowId(normalizedRoute);
      handleSelectApp(routeWindowId || moduleId);
      return true;
    },
    [handleSelectApp]
  );

  const activeAppComponent = useMemo(() => {
    if (!activeApp) return null;
    return resolveModuleComponent(activeApp);
  }, [activeApp]);

  const activeAppMeta = useMemo(() => {
    if (!activeApp) return null;

    if (activeApp.startsWith("route:")) {
      const normalizedRoute = normalizeAOSRoute(activeApp.replace(/^route:/, ""));
      const routePath = normalizedRoute?.split("?")[0] || "";
      const routeTitle = routeTitleMap.get(routePath);

      return {
        id: activeApp,
        name: routeTitle || formatAOSRouteTitle(normalizedRoute || activeApp),
      };
    }

    return allApps.find((a) => a.id === activeApp) || {
      id: activeApp,
      name: activeApp.charAt(0).toUpperCase() + activeApp.slice(1),
    };
  }, [activeApp, allApps, routeTitleMap]);

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams?.toString();
    const currentRoute = query ? `${pathname}?${query}` : pathname;
    const normalized = normalizeAOSRoute(currentRoute);
    if (!normalized) return;

    const routePath = normalized.split("?")[0];
    if (routePath === "/dashboard") {
      if (query) {
        router.replace("/dashboard");
      }
      return;
    }

    const handled = openRouteInMobile(normalized);
    if (handled) {
      router.replace("/dashboard");
    }
  }, [pathname, searchParams, openRouteInMobile, router]);

  const handleActiveAppLinkClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const href = anchor.getAttribute("href") || anchor.href;
      const normalized = normalizeAOSRoute(href || "");
      if (!normalized) return;

      e.preventDefault();
      e.stopPropagation();
      openRouteInMobile(normalized);
    },
    [openRouteInMobile]
  );

  return (
    <div
      className={`ios-mobile-screen win11 aos-gpu-accel ${themeMode === "dark" ? "dark" : ""}`}
      data-theme={themeMode}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: getWallpaperBackground(),
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Brightness Dimmer Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000000",
          opacity: ((100 - brightness) / 100) * 0.7,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Top iOS Status Bar + Dynamic Island */}
      <div
        style={{
          position: "relative",
          zIndex: 20,
          padding: "10px 16px 6px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#ffffff",
        }}
      >
        {/* Left: Clock */}
        <div
          onClick={() => setIsNotificationCenterOpen(true)}
          style={{
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{timeStr || "9:41"}</span>
        </div>

        {/* Center: Dynamic Island */}
        <div
          onClick={() => setIsIslandExpanded(!isIslandExpanded)}
          style={{
            background: "#000000",
            borderRadius: isIslandExpanded ? "22px" : "20px",
            padding: isIslandExpanded ? "8px 16px" : "4px 14px",
            minWidth: isIslandExpanded ? "210px" : "110px",
            height: isIslandExpanded ? "44px" : "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.12)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981",
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px" }}>
            {isIslandExpanded ? "ASchool Live • Active Term" : "AOS 2026"}
          </span>
        </div>

        {/* Right: Quick Controls & Battery */}
        <div
          onClick={() => setIsControlCenterOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <Wifi size={14} />
          <Battery size={16} />
        </div>
      </div>

      {/* Springboard Header: Greeting & Quick Actions */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "12px 20px 8px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: "#ffffff",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {user?.role?.toUpperCase() || "ACADEMIC PORTAL"}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px" }}>
            {user ? user.full_name : "ASchool OS"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Switch back to Desktop Mode */}
          <button
            onClick={() => {
              try {
                localStorage.setItem(AOS_MODE_STORAGE_KEY, "desktop");
              } catch {
                // Ignore storage write issues
              }
              window.location.reload();
            }}
            style={{
              all: "unset",
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "5px 10px",
              borderRadius: "20px",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Switch to Desktop Mode"
          >
            <Monitor size={13} />
            <span>Desktop Mode</span>
          </button>

          {/* Open Notifications */}
          <button
            onClick={() => setIsNotificationCenterOpen(true)}
            style={{
              all: "unset",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Bell size={14} />
          </button>
        </div>
      </div>

      {/* Springboard 4-Column App Grid */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px 100px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px 12px",
          alignContent: "flex-start",
        }}
      >
        {allApps.map((app) => (
          <div
            key={app.id}
            onClick={() => handleSelectApp(app.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
            className="aos-haptic-click"
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))",
                transition: "transform 0.1s ease",
              }}
              className="ios-app-icon"
            >
              {app.icon}
            </div>
            <span
              style={{
                marginTop: "6px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#ffffff",
                textAlign: "center",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                lineHeight: 1.2,
                maxWidth: "68px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {app.name}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom iOS Dock */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          right: "16px",
          height: "80px",
          borderRadius: "32px",
          background: "rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "0 14px",
          zIndex: 15,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {dockApps.map((app) => (
          <div
            key={`dock-${app.id}`}
            onClick={() => handleSelectApp(app.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
              }}
            >
              {app.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Slide-Up App Sheet (Active Window in Mobile Sheet Mode) */}
      {activeApp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "var(--w11-window-bg, #ffffff)",
            color: "var(--w11-text-primary, #000000)",
            display: "flex",
            flexDirection: "column",
            animation: "iosModalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* iOS App Navigation Bar */}
          <div
            style={{
              height: "48px",
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--w11-border-subtle, rgba(0,0,0,0.08))",
              background: "var(--w11-window-bg, #ffffff)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => handleSelectApp(null)}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                color: accentColor,
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              {activeAppMeta?.name}
            </span>

            <button
              onClick={() => handleSelectApp(null)}
              style={{
                all: "unset",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Module Body Frame */}
          <div
            className="aos-window-content flex-1 h-full overflow-auto"
            onClickCapture={handleActiveAppLinkClick}
          >
            {activeAppComponent ? (
              React.createElement(activeAppComponent, {})
            ) : (
              <div
                className="p-8 text-center text-sm"
                style={{ color: "var(--w11-text-secondary)" }}
              >
                Loading module {activeApp}...
              </div>
            )}
          </div>
        </div>
      )}

      {/* iOS Control Center Flyout */}
      <IOSControlCenter
        isOpen={isControlCenterOpen}
        onClose={() => setIsControlCenterOpen(false)}
        brightness={brightness}
        onChangeBrightness={onChangeBrightness}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
        accentColor={accentColor}
        onOpenApp={(appId) => {
          setIsControlCenterOpen(false);
          handleSelectApp(appId);
        }}
      />

      {/* iOS Notification Center Flyout */}
      <IOSNotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onOpenApp={(appId) => {
          setIsNotificationCenterOpen(false);
          handleSelectApp(appId);
        }}
        accentColor={accentColor}
      />
    </div>
  );
}
