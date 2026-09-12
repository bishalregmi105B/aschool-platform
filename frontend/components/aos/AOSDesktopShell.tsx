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
import { Sparkles, Maximize2 } from "lucide-react";
import {
  AOS_MODE_STORAGE_KEY,
  extractAOSModuleSlug,
  formatAOSRouteTitle,
  isAOSRootModuleRoute,
  normalizeAOSRoute,
} from "@/lib/aos-navigation";
import { useAOSUserSettings } from "@/lib/aos-settings";
import { AOSNavigateProvider } from "@/lib/aos-window-route";
import {
  getDefaultFolders,
  parseDesktopFolders,
  resolveDesktopLayout,
  type AOSDesktopFolder,
} from "@/lib/aos-launcher";

interface RouteLaunchMeta {
  moduleId: string;
  title: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
  isSubroute: boolean;
}

// Dock pinning defaults — used while aosSettings.pinned_apps is empty (i.e.
// the user has never customized the dock). Ids are AOS module ids.
const DEFAULT_PINNED_APPS = [
  "students",
  "teachers",
  "fees",
  "attendance",
  "notices",
  "aos-settings",
  "appstore",
];

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

  // Dock pinning — DB-backed via pinned_apps. An empty list means the user has
  // never customized the dock, so the default pinned set is shown instead.
  const pinnedAppIds = useMemo(
    () =>
      aosSettings.pinned_apps.length > 0
        ? aosSettings.pinned_apps
        : DEFAULT_PINNED_APPS,
    [aosSettings.pinned_apps]
  );

  const handleTogglePinApp = useCallback(
    (id: string) => {
      const base =
        aosSettings.pinned_apps.length > 0
          ? aosSettings.pinned_apps
          : DEFAULT_PINNED_APPS;
      const next = base.includes(id)
        ? base.filter((appId) => appId !== id)
        : [...base, id];
      updateAOSSettings({ pinned_apps: next });
    },
    [aosSettings.pinned_apps, updateAOSSettings]
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

  // Fullscreen: the desktop OS works best without browser chrome. On the
  // first visit per browser we offer it once (dismissal is remembered);
  // afterwards a menubar toggle controls it.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  useEffect(() => {
    if (document.fullscreenElement) setIsFullscreen(true);
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    try {
      if (!localStorage.getItem("aschool_aos_fullscreen_prompted")) {
        setShowFullscreenPrompt(true);
      }
    } catch {
      // ignore
    }
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Browser refused (iframe policy / not user-gesture) — non-fatal.
    } finally {
      try {
        localStorage.setItem("aschool_aos_fullscreen_prompted", "1");
      } catch {
        // ignore
      }
      setShowFullscreenPrompt(false);
    }
  }, []);

  const dismissFullscreenPrompt = useCallback(() => {
    try {
      localStorage.setItem("aschool_aos_fullscreen_prompted", "1");
    } catch {
      // ignore
    }
    setShowFullscreenPrompt(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Dynamic AOS Apps from plugins
  const allApps: AOSApp[] = useMemo(() => {
    const apps = sidebarItems.map((item) => getAOSAppForModule(item));
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

  // Desktop folder layout — DB-backed via desktop_folders. An empty persisted
  // list means the user never customized folders, so defaults are derived from
  // plugin manifest sections (re-deriving automatically on manifest/role
  // changes) and are NOT persisted until the user edits something.
  const persistedFolders = useMemo(
    () => parseDesktopFolders(aosSettings.desktop_folders),
    [aosSettings.desktop_folders]
  );
  const desktopFolders = useMemo(
    () =>
      persistedFolders.length > 0
        ? persistedFolders
        : getDefaultFolders(allApps, sidebarItems),
    [persistedFolders, allApps, sidebarItems]
  );
  const desktopLayout = useMemo(
    () => resolveDesktopLayout(allApps, desktopFolders),
    [allApps, desktopFolders]
  );
  const handleUpdateDesktopFolders = useCallback(
    (next: AOSDesktopFolder[]) => {
      // Validate/sanitize before persisting (ids, names, appIds).
      updateAOSSettings({ desktop_folders: parseDesktopFolders(next) });
    },
    [updateAOSSettings]
  );

  // Window State Management
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const zIndexRef = useRef(20);
  const shellRootRef = useRef<HTMLDivElement>(null);

  // Menu bar navigation source — sidebar items plus bottom-nav modules, so
  // the focused-app menus can derive Navigate/Window/Help for every module.
  const menubarNavItems = useMemo(
    () => [...sidebarItems, ...pluginBottomNav],
    [sidebarItems, pluginBottomNav]
  );

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
          return prevWindows.map((w) => {
            if (w.id !== windowId) return w;
            const nextRoute = hasRouteOverride ? options.route : w.route;
            // Route history for the per-window Back button: push the previous
            // route whenever an existing window's route is replaced.
            let routeHistory = w.routeHistory;
            if (hasRouteOverride && nextRoute !== w.route) {
              const previousRoute = w.route || `/dashboard/${w.moduleId || w.id}`;
              if (previousRoute !== nextRoute) {
                routeHistory = [...(w.routeHistory || []), previousRoute].slice(-20);
              }
            }
            return {
              ...w,
              moduleId,
              route: nextRoute,
              routeHistory,
              title: options.title || w.title,
              icon: options.icon ?? w.icon,
              isOpen: true,
              isMinimized: false,
              zIndex: nextZ,
            };
          });
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

  // Per-window Back: pop the last entry from the window's route history and
  // set the route directly (does NOT push history again — back navigation is
  // not itself a navigation step).
  const navigateWindowBack = useCallback(
    (windowId: string, route: string) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== windowId) return w;
          const history = w.routeHistory || [];
          const popped = history[history.length - 1];
          if (popped !== route) return w;
          return {
            ...w,
            route,
            routeHistory: history.slice(0, -1),
          };
        })
      );
    },
    []
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

  // In-process navigation: the single entry point every link in the shell
  // goes through (window content, widgets, flyouts, menubar). The browser
  // URL never leaves /dashboard.
  const navigate = useCallback(
    (route: string) => {
      const normalized = normalizeAOSRoute(route);
      if (!normalized) return;
      openRouteInAOS(normalized);
    },
    [openRouteInAOS]
  );

  // Global anchor interception — capture phase on the shell root catches
  // EVERY in-app link (windows, widgets, flyouts, dropdowns) before the
  // router navigates, so the URL bar never changes.
  useEffect(() => {
    const root = shellRootRef.current;
    if (!root) return;
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") || "";
      const normalized = normalizeAOSRoute(href);
      if (!normalized) return; // external/other-prefix links pass through
      e.preventDefault();
      e.stopPropagation();
      navigate(normalized);
    };
    root.addEventListener("click", onClickCapture, true);
    return () => root.removeEventListener("click", onClickCapture, true);
  }, [navigate]);

  return (
    <AOSNavigateProvider navigate={navigate}>
    <div
      ref={shellRootRef}
      className={`aos-desktop win11 ${themeMode}`}
      data-theme={themeMode}
      style={shellStyle}
      onClick={() => closeAllFlyouts()}
    >
      {/* Top Menu Bar */}
      {showTopBar && (
        <TopMenuBar
          currentRole={currentRole}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          sidebarItems={menubarNavItems}
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
          windows={windows}
          activeWindowId={activeWindowId}
          onFocusWindow={focusWindow}
          onMinimizeActive={() => {
            if (activeWindowId) minimizeWindow(activeWindowId);
          }}
          onMaximizeActive={() => {
            if (activeWindowId) toggleMaximizeWindow(activeWindowId);
          }}
          onCloseActive={() => {
            if (activeWindowId) closeWindow(activeWindowId);
          }}
          topbarItems={aosSettings.topbar_items}
          onChangeTopbarItems={(items) => updateAOSSettings({ topbar_items: items })}
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
        folders={desktopLayout.folders}
        onUpdateFolders={handleUpdateDesktopFolders}
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
          topBarHeight={topBarHeight}
          onChangeTopBarHeight={setTopBarHeight}
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
          pinnedAppIds={pinnedAppIds}
          onTogglePinApp={handleTogglePinApp}
          onOpenRoute={openRouteInAOS}
          onNavigateWindowBack={navigateWindowBack}
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
          pinnedAppIds={pinnedAppIds}
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
        folders={desktopLayout.folders.length > 0 ? desktopLayout.folders : undefined}
      />

      {/* First-visit fullscreen offer */}
      {showFullscreenPrompt && (
        <div
          className="aos-desktop-prompt-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10060,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={dismissFullscreenPrompt}
        >
          <div
            className="win11-dialog"
            style={{ width: "420px", maxWidth: "92vw", padding: "22px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Maximize2 size={20} style={{ color: "var(--w11-accent)" }} />
              <span>Enter Fullscreen Mode?</span>
            </div>
            <div
              className="dialog-body"
              style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--w11-text-secondary)" }}
            >
              ASchool OS works best in fullscreen — the whole desktop, dock, and
              windows get the complete screen with no browser chrome in the way.
              You can toggle it anytime from the menu bar.
            </div>
            <div
              className="dialog-footer"
              style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
            >
              <button className="subtle" onClick={dismissFullscreenPrompt} style={{ fontSize: "12px" }}>
                Not Now
              </button>
              <button className="accent" onClick={enterFullscreen} style={{ fontSize: "12px" }}>
                <Maximize2 size={13} /> Enter Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}

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
    </AOSNavigateProvider>
  );
}
