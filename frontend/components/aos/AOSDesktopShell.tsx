"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Desktop from "@/components/aos/Desktop";
import TopMenuBar from "@/components/aos/TopMenuBar";
import Dock from "@/components/aos/Dock";
import Taskbar from "@/components/aos/Taskbar";
import WindowManager, { WindowInstance } from "@/components/aos/WindowManager";
import SpotlightSearch from "@/components/aos/SpotlightSearch";
import AppDrawer from "@/components/aos/AppDrawer";
import AppSwitcher from "@/components/aos/AppSwitcher";
import StartMenu from "@/components/aos/StartMenu";
import WidgetsPanel from "@/components/aos/WidgetsPanel";
import RoleSwitcherModal from "@/components/aos/RoleSwitcherModal";
import NotificationCenter from "@/components/aos/NotificationCenter";
import QuickSettings from "@/components/aos/QuickSettings";
import CalendarFlyout from "@/components/aos/CalendarFlyout";
import { useInstalledPlugins } from "@/lib/plugins";
import {
  getAOSAppForModule,
  normalizeAOSModuleId,
  type AOSApp,
} from "@/lib/aos-app-adapter";
import { useAuth } from "@/lib/auth-context";
import { fetchUnreadCount } from "@/lib/services/notifications.service";
import { Sparkles } from "lucide-react";
import {
  AOS_MODE_STORAGE_KEY,
  extractAOSModuleSlug,
  formatAOSRouteTitle,
  isAOSRootModuleRoute,
  normalizeAOSRoute,
} from "@/lib/aos-navigation";
import { useAOSUserSettings } from "@/lib/aos-settings";

interface RouteLaunchMeta {
  moduleId: string;
  title: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
  isSubroute: boolean;
}

interface OpenWindowOptions {
  windowId?: string;
  moduleId?: string;
  route?: string;
  title?: string;
  icon?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
}

export default function AOSDesktopShell() {
  const { user } = useAuth();
  const { sidebarItems, pluginBottomNav } = useInstalledPlugins();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Desktop customization state — DB-backed (cross-device) via
  // useAOSUserSettings; localStorage cache provides instant first paint.
  const { settings: aosSettings, updateSettings: updateAOSSettings } = useAOSUserSettings();
  const themeMode = aosSettings.theme_mode;
  const accentColor = aosSettings.accent_color;
  const wallpaper = aosSettings.wallpaper;
  const brightness = aosSettings.brightness;
  const dockStyle = aosSettings.dock_style;
  const dockSize = aosSettings.dock_size;
  const showTopBar = aosSettings.show_top_bar;
  const topBarHeight = aosSettings.top_bar_height;
  const blurIntensity = aosSettings.blur_intensity;
  const taskbarAlign = aosSettings.taskbar_align;

  const setThemeMode = useCallback(
    (mode: "light" | "dark") => updateAOSSettings({ theme_mode: mode }),
    [updateAOSSettings]
  );
  const setAccentColor = useCallback(
    (color: string) => updateAOSSettings({ accent_color: color }),
    [updateAOSSettings]
  );
  const setWallpaper = useCallback(
    (wp: string) => updateAOSSettings({ wallpaper: wp }),
    [updateAOSSettings]
  );
  const setBrightness = useCallback(
    (b: number) => updateAOSSettings({ brightness: b }),
    [updateAOSSettings]
  );
  const setDockStyle = useCallback(
    (style: "mac" | "win11") => updateAOSSettings({ dock_style: style }),
    [updateAOSSettings]
  );
  const setDockSize = useCallback(
    (size: "small" | "medium" | "large") => updateAOSSettings({ dock_size: size }),
    [updateAOSSettings]
  );
  const setShowTopBar = useCallback(
    (show: boolean) => updateAOSSettings({ show_top_bar: show }),
    [updateAOSSettings]
  );
  const setTopBarHeight = useCallback(
    (h: "compact" | "standard" | "large") => updateAOSSettings({ top_bar_height: h }),
    [updateAOSSettings]
  );
  const setBlurIntensity = useCallback(
    (v: number) => updateAOSSettings({ blur_intensity: v }),
    [updateAOSSettings]
  );
  const setTaskbarAlign = useCallback(
    (a: "center" | "left") => updateAOSSettings({ taskbar_align: a }),
    [updateAOSSettings]
  );

  // User role state
  const [currentRole, setCurrentRole] = useState<string>(user?.role || "admin");

  useEffect(() => {
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [user?.role]);

  // Manual desktop/iOS mode override — persists across reloads (DB-backed
  // with a localStorage mirror that dashboard-layout reads synchronously);
  // absence of a stored value keeps the viewport-based decision.
  const handleToggleSystemMode = useCallback(() => {
    try {
      const current = localStorage.getItem(AOS_MODE_STORAGE_KEY);
      const isMobileNow =
        current === "mobile" ||
        (current !== "desktop" && window.matchMedia("(max-width: 767px)").matches);
      const next = isMobileNow ? "desktop" : "mobile";
      localStorage.setItem(AOS_MODE_STORAGE_KEY, next);
      updateAOSSettings({ system_mode: next });
      window.location.reload();
    } catch {
      // Ignore storage access issues
    }
  }, [updateAOSSettings]);

  // Flyout and modal toggles
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Live unread badge for the menubar bell (refetches when the flyout opens
  // so read/dismiss actions in NotificationCenter immediately update it).
  const { data: unreadCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ["aos-unread-notifications"],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isNotificationsOpen) return;
    refetchUnread();
  }, [isNotificationsOpen, refetchUnread]);

  // Dynamic AOS Apps from plugins
  const allApps: AOSApp[] = useMemo(() => {
    const apps = sidebarItems.map(getAOSAppForModule);
    for (const b of pluginBottomNav) {
      const moduleId = normalizeAOSModuleId(b.slug, b.route) || b.slug;
      if (!apps.some((a) => a.id === moduleId)) {
        apps.push({
          id: moduleId,
          name: b.label,
          route: b.route || `/dashboard/${moduleId}`,
          category: "System",
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

  // Window State Management
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const zIndexRef = useRef(20);

  const closeAllFlyouts = useCallback(
    (
      except?:
        | "spotlight"
        | "appDrawer"
        | "roleSwitcher"
        | "notifications"
        | "quickSettings"
        | "calendar"
        | "start"
        | "widgets"
        | "switcher"
    ) => {
      if (except !== "spotlight") setIsSpotlightOpen(false);
      if (except !== "appDrawer") setIsAppDrawerOpen(false);
      if (except !== "roleSwitcher") setIsRoleSwitcherOpen(false);
      if (except !== "notifications") setIsNotificationsOpen(false);
      if (except !== "quickSettings") setIsQuickSettingsOpen(false);
      if (except !== "calendar") setIsCalendarOpen(false);
      if (except !== "start") setIsStartOpen(false);
      if (except !== "widgets") setIsWidgetsOpen(false);
      if (except !== "switcher") setIsSwitcherOpen(false);
    },
    []
  );

  const shellStyle = useMemo(
    () =>
      ({
        "--w11-accent": accentColor,
        "--w11-acrylic-blur": `${blurIntensity}px`,
      } as React.CSSProperties),
    [accentColor, blurIntensity]
  );

  const appMetaById = useMemo(
    () => new Map(allApps.map((app) => [app.id, app])),
    [allApps]
  );

  const routeLaunchIndex = useMemo(() => {
    const map = new Map<string, RouteLaunchMeta>();

    const registerRoute = (
      rawRoute: string | undefined,
      title: string,
      moduleId: string,
      isSubroute: boolean
    ) => {
      if (!rawRoute || !moduleId) return;
      const normalized = normalizeAOSRoute(rawRoute);
      if (!normalized) return;

      const routePath = normalized.split("?")[0];
      const appMeta = appMetaById.get(moduleId);

      map.set(routePath, {
        moduleId,
        title,
        icon: appMeta?.icon ?? null,
        defaultWidth: appMeta?.defaultWidth ?? 960,
        defaultHeight: appMeta?.defaultHeight ?? 640,
        isSubroute,
      });
    };

    for (const item of sidebarItems) {
      const moduleId = normalizeAOSModuleId(item.slug, item.route) || item.slug;
      registerRoute(item.route, item.label, moduleId, false);
      for (const sub of item.subitems || []) {
        registerRoute(sub.route, sub.label, moduleId, true);
      }
    }

    for (const item of pluginBottomNav) {
      const moduleId = normalizeAOSModuleId(item.slug, item.route) || item.slug;
      registerRoute(item.route, item.label, moduleId, false);
      for (const sub of item.subitems || []) {
        registerRoute(sub.route, sub.label, moduleId, true);
      }
    }

    return map;
  }, [sidebarItems, pluginBottomNav, appMetaById]);

  const getNextZIndex = useCallback(() => {
    const next = zIndexRef.current + 1;
    zIndexRef.current = next;
    return next;
  }, []);

  // Open window helper
  const openWindow = useCallback(
    (slug: string, options: OpenWindowOptions = {}) => {
      closeAllFlyouts();

      // "settings" from shell chrome (QuickSettings gear, context menu,
      // TopMenuBar system menu, iOS control center) means the OS
      // personalization app — the school settings module keeps its own id.
      const effectiveSlug =
        !options.moduleId && !Object.prototype.hasOwnProperty.call(options, "route") && slug === "settings"
          ? "aos-settings"
          : slug;

      const windowId = options.windowId || effectiveSlug;
      const moduleId = options.moduleId || effectiveSlug;
      const hasRouteOverride = Object.prototype.hasOwnProperty.call(options, "route");

      setWindows((prevWindows) => {
        const existing = prevWindows.find((w) => w.id === windowId);
        const nextZ = getNextZIndex();
        setActiveWindowId(windowId);

        if (existing) {
          return prevWindows.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  moduleId,
                  route: hasRouteOverride ? options.route : w.route,
                  title: options.title || w.title,
                  icon: options.icon ?? w.icon,
                  isOpen: true,
                  isMinimized: false,
                  zIndex: nextZ,
                }
              : w
          );
        }

        const appMeta = appMetaById.get(moduleId) || {
          id: moduleId,
          name: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
          defaultWidth: 960,
          defaultHeight: 640,
          icon: null,
        };

        const width = options.defaultWidth ?? appMeta.defaultWidth ?? 960;
        const height = options.defaultHeight ?? appMeta.defaultHeight ?? 640;
        const offset = (prevWindows.length % 6) * 28;

        const screenW = typeof window !== "undefined" ? window.innerWidth : 1280;
        const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

        const initialX = Math.max(30, Math.round((screenW - width) / 2) + offset);
        const initialY = Math.max(48, Math.round((screenH - height) / 2) + offset);

        const newWindow: WindowInstance = {
          id: windowId,
          moduleId,
          route: options.route,
          title: options.title || appMeta.name,
          icon: options.icon ?? appMeta.icon,
          isOpen: true,
          isMinimized: false,
          isMaximized: false,
          x: initialX,
          y: initialY,
          width,
          height,
          zIndex: nextZ,
        };

        return [...prevWindows, newWindow];
      });
    },
    [appMetaById, closeAllFlyouts, getNextZIndex]
  );

  const openRouteInAOS = useCallback(
    (rawRoute: string): boolean => {
      const normalizedRoute = normalizeAOSRoute(rawRoute);
      if (!normalizedRoute) return false;

      const routePath = normalizedRoute.split("?")[0];
      const routeMeta = routeLaunchIndex.get(routePath);
      const routeModuleSlug = extractAOSModuleSlug(normalizedRoute);
      const moduleId =
        routeMeta?.moduleId ||
        normalizeAOSModuleId(routeModuleSlug || "", normalizedRoute);

      if (!moduleId) return false;

      const appMeta = appMetaById.get(moduleId);

      if (isAOSRootModuleRoute(normalizedRoute) && !routeMeta?.isSubroute) {
        openWindow(moduleId, {
          windowId: moduleId,
          moduleId,
          route: undefined,
          title: appMeta?.name || formatAOSRouteTitle(normalizedRoute),
          icon: appMeta?.icon ?? routeMeta?.icon ?? null,
          defaultWidth: appMeta?.defaultWidth,
          defaultHeight: appMeta?.defaultHeight,
        });
        return true;
      }

      openWindow(moduleId, {
        windowId: moduleId,
        moduleId,
        route: normalizedRoute,
        title: routeMeta?.title || formatAOSRouteTitle(normalizedRoute),
        icon: routeMeta?.icon ?? appMeta?.icon ?? null,
        defaultWidth: routeMeta?.defaultWidth ?? appMeta?.defaultWidth ?? 1040,
        defaultHeight: routeMeta?.defaultHeight ?? appMeta?.defaultHeight ?? 700,
      });

      return true;
    },
    [routeLaunchIndex, appMetaById, openWindow]
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveWindowId((prevActive) => {
      if (prevActive !== id) return prevActive;
      return null;
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
    setActiveWindowId((prevActive) => (prevActive === id ? null : prevActive));
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const focusWindow = useCallback(
    (id: string) => {
      const nextZ = getNextZIndex();
      setActiveWindowId(id);
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w
        )
      );
    },
    [getNextZIndex]
  );

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y } : w))
    );
  }, []);

  const resizeWindow = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, x, y, width, height, isMaximized: false } : w
        )
      );
    },
    []
  );

  const snapWindow = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, x, y, width, height, isMaximized: false }
            : w
        )
      );
    },
    []
  );

  const closeAllWindows = useCallback(() => {
    setWindows([]);
    setActiveWindowId(null);
  }, []);

  // Keyboard shortcut handler for Spotlight (Cmd+Space or Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === " ") {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        closeAllFlyouts();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAllFlyouts]);

  // Keep AOS browser URL pinned while still honoring in-app route intents.
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

    const handled = openRouteInAOS(normalized);
    if (handled) {
      router.replace("/dashboard");
    }
  }, [pathname, searchParams, openRouteInAOS, router]);

  return (
    <div
      className={`aos-desktop win11 ${themeMode}`}
      data-theme={themeMode}
      style={shellStyle}
      onClick={() => closeAllFlyouts()}
    >
      {/* Top Menu Bar */}
      {showTopBar && (
        <TopMenuBar
          currentRole={currentRole}
          onOpenRoleSwitcher={() => {
            closeAllFlyouts("roleSwitcher");
            setIsRoleSwitcherOpen(true);
          }}
          onToggleControlCenter={() => {
            const next = !isQuickSettingsOpen;
            closeAllFlyouts("quickSettings");
            setIsQuickSettingsOpen(next);
          }}
          onToggleNotifications={() => {
            const next = !isNotificationsOpen;
            closeAllFlyouts("notifications");
            setIsNotificationsOpen(next);
          }}
          onToggleSearch={() => {
            const next = !isStartOpen;
            closeAllFlyouts("start");
            setIsStartOpen(next);
          }}
          onToggleSpotlight={() => {
            const next = !isSpotlightOpen;
            closeAllFlyouts("spotlight");
            setIsSpotlightOpen(next);
          }}
          onToggleWidgets={() => {
            const next = !isWidgetsOpen;
            closeAllFlyouts("widgets");
            setIsWidgetsOpen(next);
          }}
          onOpenApp={openWindow}
          onToggleAppDrawer={() => {
            const next = !isAppDrawerOpen;
            closeAllFlyouts("appDrawer");
            setIsAppDrawerOpen(next);
          }}
          onToggleAppSwitcher={() => {
            const next = !isSwitcherOpen;
            closeAllFlyouts("switcher");
            setIsSwitcherOpen(next);
          }}
          systemMode="desktop"
          onToggleSystemMode={handleToggleSystemMode}
          unreadCount={unreadCount}
          topBarHeight={topBarHeight}
        />
      )}

      {/* Desktop Canvas */}
      <Desktop
        wallpaper={wallpaper}
        themeMode={themeMode}
        brightness={brightness}
        currentRole={currentRole}
        showTopBar={showTopBar}
        apps={allApps}
        onOpenApp={openWindow}
      >
        {/* Multi-Window Manager Canvas */}
        <WindowManager
          windows={windows}
          activeWindowId={activeWindowId}
          onFocusWindow={focusWindow}
          onCloseWindow={closeWindow}
          onMinimizeWindow={minimizeWindow}
          onToggleMaximizeWindow={toggleMaximizeWindow}
          onUpdatePosition={updatePosition}
          onResizeWindow={resizeWindow}
          onSnapWindow={snapWindow}
          accentColor={accentColor}
          onChangeAccent={setAccentColor}
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
          wallpaper={wallpaper}
          onChangeWallpaper={setWallpaper}
          dockStyle={dockStyle}
          onChangeDockStyle={setDockStyle}
          dockSize={dockSize}
          onChangeDockSize={setDockSize}
          showTopBar={showTopBar}
          onToggleTopBar={() => setShowTopBar(!showTopBar)}
          blurIntensity={blurIntensity}
          onChangeBlurIntensity={setBlurIntensity}
          taskbarAlign={taskbarAlign}
          onToggleTaskbarAlign={() =>
            setTaskbarAlign(taskbarAlign === "center" ? "left" : "center")
          }
          brightness={brightness}
          onChangeBrightness={setBrightness}
          currentRole={currentRole}
          onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          onOpenRoute={openRouteInAOS}
        />
      </Desktop>

      {/* Dock (macOS Parabolic Dock) or Taskbar (Win11) */}
      {dockStyle === "mac" ? (
        <Dock
          windows={windows}
          activeWindowId={activeWindowId}
          onToggleWindow={(id) => {
            const w = windows.find((item) => item.id === id);
            if (!w || !w.isOpen) {
              openWindow(id);
            } else if (w.isMinimized || activeWindowId !== id) {
              focusWindow(id);
            } else {
              minimizeWindow(id);
            }
          }}
          isStartOpen={isStartOpen}
          accentColor={accentColor}
          currentRole={currentRole}
          dockSize={dockSize}
          onToggleStart={() => {
            const next = !isStartOpen;
            closeAllFlyouts("start");
            setIsStartOpen(next);
          }}
          onToggleAppDrawer={() => {
            const next = !isAppDrawerOpen;
            closeAllFlyouts("appDrawer");
            setIsAppDrawerOpen(next);
          }}
          onToggleAppSwitcher={() => {
            const next = !isSwitcherOpen;
            closeAllFlyouts("switcher");
            setIsSwitcherOpen(next);
          }}
          sidebarItems={sidebarItems}
        />
      ) : (
        <Taskbar
          isStartOpen={isStartOpen}
          onToggleStart={() => {
            const next = !isStartOpen;
            closeAllFlyouts("start");
            setIsStartOpen(next);
          }}
          isQuickSettingsOpen={isQuickSettingsOpen}
          onToggleQuickSettings={() => {
            const next = !isQuickSettingsOpen;
            closeAllFlyouts("quickSettings");
            setIsQuickSettingsOpen(next);
          }}
          isCalendarOpen={isCalendarOpen}
          onToggleCalendar={() => {
            const next = !isCalendarOpen;
            closeAllFlyouts("calendar");
            setIsCalendarOpen(next);
          }}
          isWidgetsOpen={isWidgetsOpen}
          onToggleWidgets={() => {
            const next = !isWidgetsOpen;
            closeAllFlyouts("widgets");
            setIsWidgetsOpen(next);
          }}
          windows={windows}
          activeWindowId={activeWindowId}
          onToggleWindow={(id) => {
            const w = windows.find((item) => item.id === id);
            if (!w || !w.isOpen) {
              openWindow(id);
            } else if (w.isMinimized || activeWindowId !== id) {
              focusWindow(id);
            } else {
              minimizeWindow(id);
            }
          }}
          onShowDesktop={() => {
            setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
            setActiveWindowId(null);
          }}
          accentColor={accentColor}
          taskbarAlign={taskbarAlign}
          onToggleAppDrawer={() => {
            const next = !isAppDrawerOpen;
            closeAllFlyouts("appDrawer");
            setIsAppDrawerOpen(next);
          }}
          onToggleAppSwitcher={() => {
            const next = !isSwitcherOpen;
            closeAllFlyouts("switcher");
            setIsSwitcherOpen(next);
          }}
        />
      )}

      {/* Spotlight Search Overlay */}
      <SpotlightSearch
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        onOpenApp={openWindow}
        onOpenRoute={openRouteInAOS}
        currentRole={currentRole}
        accentColor={accentColor}
      />

      {/* App Drawer / Launchpad */}
      <AppDrawer
        isOpen={isAppDrawerOpen}
        onClose={() => setIsAppDrawerOpen(false)}
        onOpenApp={openWindow}
        currentRole={currentRole}
        accentColor={accentColor}
      />

      {/* Role Switcher Session Modal */}
      <RoleSwitcherModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        currentRole={currentRole}
        onSelectRole={(newRole) => setCurrentRole(newRole)}
      />

      {/* Notification Center Flyout */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenApp={openWindow}
        onOpenRoute={openRouteInAOS}
        accentColor={accentColor}
      />

      {/* Quick Settings Panel */}
      <QuickSettings
        isOpen={isQuickSettingsOpen}
        onClose={() => setIsQuickSettingsOpen(false)}
        accentColor={accentColor}
        brightness={brightness}
        onChangeBrightness={setBrightness}
        onOpenSettings={() => {
          setIsQuickSettingsOpen(false);
          openWindow("settings");
        }}
      />

      {/* Calendar Flyout */}
      <CalendarFlyout
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        accentColor={accentColor}
      />

      {/* Start Menu Flyout */}
      <StartMenu
        isOpen={isStartOpen}
        onClose={() => setIsStartOpen(false)}
        onOpenApp={openWindow}
        accentColor={accentColor}
      />

      {/* Widgets Board Flyout */}
      <WidgetsPanel
        isOpen={isWidgetsOpen}
        onClose={() => setIsWidgetsOpen(false)}
        accentColor={accentColor}
      />

      {/* Multitasking App Viewer & Switcher */}
      <AppSwitcher
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        windows={windows}
        activeWindowId={activeWindowId}
        onFocusWindow={(id) => {
          focusWindow(id);
          setIsSwitcherOpen(false);
        }}
        onCloseWindow={closeWindow}
        onCloseAll={closeAllWindows}
        accentColor={accentColor}
      />
    </div>
  );
}
