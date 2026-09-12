"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Desktop from "@/components/aos/Desktop";
import TopMenuBar from "@/components/aos/TopMenuBar";
import Dock from "@/components/aos/Dock";
import Taskbar from "@/components/aos/Taskbar";
import WindowManager, { WindowInstance } from "@/components/aos/WindowManager";
import SpotlightSearch from "@/components/aos/SpotlightSearch";
import AppDrawer from "@/components/aos/AppDrawer";
import RoleSwitcherModal from "@/components/aos/RoleSwitcherModal";
import NotificationCenter from "@/components/aos/NotificationCenter";
import QuickSettings from "@/components/aos/QuickSettings";
import CalendarFlyout from "@/components/aos/CalendarFlyout";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule, type AOSApp } from "@/lib/aos-app-adapter";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode-context";
import { Sparkles } from "lucide-react";

export default function AOSDesktopShell() {
  const { user } = useAuth();
  const { sidebarItems, pluginBottomNav } = useInstalledPlugins();
  const { toggleMode, setMode } = useViewMode();

  // Desktop appearance customization state
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const [accentColor, setAccentColor] = useState("#0078d4");
  const [wallpaper, setWallpaper] = useState("bloom-dark");
  const [brightness, setBrightness] = useState(100);
  const [dockStyle, setDockStyle] = useState<"mac" | "win11">("mac");
  const [dockSize, setDockSize] = useState<"small" | "medium" | "large">("medium");
  const [showTopBar, setShowTopBar] = useState(true);
  const [topBarHeight, setTopBarHeight] = useState<"compact" | "standard" | "large">("standard");
  const [blurIntensity, setBlurIntensity] = useState(30);
  const [taskbarAlign, setTaskbarAlign] = useState<"center" | "left">("center");

  // User role state
  const [currentRole, setCurrentRole] = useState<string>(user?.role || "admin");

  useEffect(() => {
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [user?.role]);

  // Flyout and modal toggles
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);

  // Dynamic AOS Apps from plugins
  const allApps: AOSApp[] = useMemo(() => {
    const apps = sidebarItems.map(getAOSAppForModule);
    for (const b of pluginBottomNav) {
      if (!apps.some((a) => a.id === b.slug)) {
        apps.push({
          id: b.slug,
          name: b.label,
          route: b.route,
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
  const [maxZIndex, setMaxZIndex] = useState(20);

  // Open window helper
  const openWindow = useCallback(
    (slug: string) => {
      // Close spotlight/drawers if open
      setIsSpotlightOpen(false);
      setIsAppDrawerOpen(false);

      setWindows((prevWindows) => {
        const existing = prevWindows.find((w) => w.id === slug);
        const nextZ = maxZIndex + 1;
        setMaxZIndex(nextZ);
        setActiveWindowId(slug);

        if (existing) {
          return prevWindows.map((w) =>
            w.id === slug
              ? {
                  ...w,
                  isOpen: true,
                  isMinimized: false,
                  zIndex: nextZ,
                }
              : w
          );
        }

        // Find metadata
        const appMeta = allApps.find((a) => a.id === slug) || {
          id: slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          defaultWidth: 960,
          defaultHeight: 640,
          icon: null,
        };

        const width = appMeta.defaultWidth || 960;
        const height = appMeta.defaultHeight || 640;
        const offset = (prevWindows.length % 6) * 28;

        const screenW = typeof window !== "undefined" ? window.innerWidth : 1280;
        const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

        const initialX = Math.max(30, Math.round((screenW - width) / 2) + offset);
        const initialY = Math.max(48, Math.round((screenH - height) / 2) + offset);

        const newWindow: WindowInstance = {
          id: slug,
          title: appMeta.name,
          icon: appMeta.icon,
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
    [allApps, maxZIndex]
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
      const nextZ = maxZIndex + 1;
      setMaxZIndex(nextZ);
      setActiveWindowId(id);
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w
        )
      );
    },
    [maxZIndex]
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

  // Keyboard shortcut handler for Spotlight (Cmd+Space or Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === " ") {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsSpotlightOpen(false);
        setIsAppDrawerOpen(false);
        setIsRoleSwitcherOpen(false);
        setIsNotificationsOpen(false);
        setIsQuickSettingsOpen(false);
        setIsCalendarOpen(false);
        setIsStartOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="aos-desktop">
      {/* Top Menu Bar */}
      {showTopBar && (
        <TopMenuBar
          currentRole={currentRole}
          onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          onToggleControlCenter={() => setIsQuickSettingsOpen((prev) => !prev)}
          onToggleNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          onToggleSearch={() => setIsSpotlightOpen(true)}
          onToggleSpotlight={() => setIsSpotlightOpen((prev) => !prev)}
          onToggleWidgets={() => setIsWidgetsOpen((prev) => !prev)}
          onOpenApp={openWindow}
          onToggleAppDrawer={() => setIsAppDrawerOpen((prev) => !prev)}
          systemMode="desktop"
          onToggleSystemMode={toggleMode}
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
          onToggleTheme={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
          wallpaper={wallpaper}
          onChangeWallpaper={setWallpaper}
          dockStyle={dockStyle}
          onChangeDockStyle={setDockStyle}
          dockSize={dockSize}
          onChangeDockSize={setDockSize}
          showTopBar={showTopBar}
          onToggleTopBar={() => setShowTopBar((prev) => !prev)}
          blurIntensity={blurIntensity}
          onChangeBlurIntensity={setBlurIntensity}
          taskbarAlign={taskbarAlign}
          onToggleTaskbarAlign={() =>
            setTaskbarAlign((prev) => (prev === "center" ? "left" : "center"))
          }
          brightness={brightness}
          onChangeBrightness={setBrightness}
          currentRole={currentRole}
          onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
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
          onToggleStart={() => setIsStartOpen((prev) => !prev)}
          isStartOpen={isStartOpen}
          accentColor={accentColor}
          currentRole={currentRole}
          dockSize={dockSize}
          onToggleAppDrawer={() => setIsAppDrawerOpen((prev) => !prev)}
          sidebarItems={sidebarItems}
        />
      ) : (
        <Taskbar
          isStartOpen={isStartOpen}
          onToggleStart={() => setIsStartOpen((prev) => !prev)}
          isQuickSettingsOpen={isQuickSettingsOpen}
          onToggleQuickSettings={() => setIsQuickSettingsOpen((prev) => !prev)}
          isCalendarOpen={isCalendarOpen}
          onToggleCalendar={() => setIsCalendarOpen((prev) => !prev)}
          isWidgetsOpen={isWidgetsOpen}
          onToggleWidgets={() => setIsWidgetsOpen((prev) => !prev)}
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
          onToggleAppDrawer={() => setIsAppDrawerOpen((prev) => !prev)}
        />
      )}

      {/* Spotlight Search Overlay */}
      <SpotlightSearch
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        onOpenApp={openWindow}
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
    </div>
  );
}
