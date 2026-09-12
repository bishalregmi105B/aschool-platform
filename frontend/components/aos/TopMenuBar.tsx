"use client";

import React, { useState, useMemo } from "react";
import { AOSLogo } from "@/components/aos/AOSIcons";
import {
  Wifi,
  Battery,
  Sliders,
  Bell,
  Search,
  ChevronDown,
  LayoutGrid,
  Layers,
  Smartphone,
  Monitor,
  Maximize,
  Minimize,
} from "lucide-react";
import { SchoolRole } from "@/components/aos/types";
import { useServerTime } from "@/lib/use-server-time";
import { useAuth } from "@/lib/auth-context";
import { LanguageToggle } from "@/components/aos/LanguageToggle";

interface TopMenuBarProps {
  currentRole?: SchoolRole;
  onOpenRoleSwitcher?: () => void;
  onToggleControlCenter: () => void;
  onToggleNotifications: () => void;
  onToggleSearch: () => void;
  onToggleSpotlight?: () => void;
  onToggleWidgets: () => void;
  onOpenApp: (appId: string) => void;
  unreadCount?: number;
  onToggleAppDrawer?: () => void;
  onToggleAppSwitcher?: () => void;
  systemMode?: "desktop" | "mobile";
  onToggleSystemMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  topBarHeight?: "compact" | "standard" | "large";
  /** Sidebar items from plugin manifests — drives the dynamic section menus. */
  sidebarItems?: Array<{ slug: string; label: string; section?: string | null; route?: string | null }>;
}

const ROLE_COLORS: Record<string, string> = {
  student: "#0284c7",
  teacher: "#10b981",
  admin: "#6366f1",
  superadmin: "#8b5cf6",
  accountant: "#f59e0b",
  parent: "#ec4899",
};

export default function TopMenuBar({
  currentRole,
  onOpenRoleSwitcher,
  onToggleControlCenter,
  onToggleNotifications,
  onToggleSearch,
  onToggleSpotlight,
  onToggleWidgets,
  onOpenApp,
  unreadCount = 0,
  onToggleAppDrawer,
  onToggleAppSwitcher,
  systemMode = "desktop",
  onToggleSystemMode,
  isFullscreen = false,
  onToggleFullscreen,
  topBarHeight = "standard",
  sidebarItems,
}: TopMenuBarProps) {
  const [showAppleMenu, setShowAppleMenu] = useState(false);
  const [openMenuSection, setOpenMenuSection] = useState<string | null>(null);

  // Authoritative server clock
  const serverTime = useServerTime();

  // Real user authentication
  const { user, logout } = useAuth();

  // Dynamic section menus from plugin manifests — group sidebar modules by
  // their manifest section; only sections with apps render.
  const sectionMenus = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const item of sidebarItems || []) {
      const section = item.section;
      if (!section || section === "bottom_nav") continue;
      const list = groups.get(section) || [];
      list.push({ id: item.slug, name: item.label });
      groups.set(section, list);
    }
    return [...groups.entries()]
      .map(([name, apps]) => ({ name, apps }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sidebarItems]);

  const heightPx = topBarHeight === "large" ? 38 : topBarHeight === "compact" ? 26 : 30;
  const fontSizePx = topBarHeight === "large" ? "14px" : topBarHeight === "compact" ? "12px" : "13px";

  // Derive user info
  const effectiveRole = (user?.role || currentRole || "student").toLowerCase();
  const userName = user?.full_name || (effectiveRole === "admin" ? "Dr. Evelyn Carter" : effectiveRole === "teacher" ? "Dr. Robert Henderson" : effectiveRole === "accountant" ? "Clara Higgins, CPA" : "Bishal Regmi");
  const roleLabel = effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1);
  const badgeColor = ROLE_COLORS[effectiveRole] || "#0284c7";

  const timeStr = useMemo(() => {
    const d = serverTime ? new Date(serverTime.epochMs) : new Date();
    return (
      d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      "  " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    );
  }, [serverTime]);

  const handleLogout = () => {
    try {
      logout();
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <div
      className="macos-menubar"
      style={{ height: `${heightPx}px`, fontSize: fontSizePx }}
      onClick={() => setShowAppleMenu(false)}
    >
      {/* Left Area: AOS Logo & Mac Menu Items */}
      <div className="menubar-left">
        {/* Apple-style AOS System Menu */}
        <div
          className={`menubar-apple ${showAppleMenu ? "is-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowAppleMenu(!showAppleMenu);
          }}
          title="AOS System Menu"
        >
          <AOSLogo size={18} />
        </div>

        {/* AOS Apple Dropdown */}
        {showAppleMenu && (
          <div
            style={{
              position: "absolute",
              top: "32px",
              left: "8px",
              width: "220px",
              background: "var(--w11-surface-flyout)",
              backdropFilter: "blur(30px) saturate(180%)",
              border: "1px solid var(--w11-acrylic-border)",
              borderRadius: "8px",
              boxShadow: "0 14px 35px rgba(0,0,0,0.4)",
              padding: "5px",
              zIndex: 10002,
              fontSize: "12px",
              color: "var(--w11-text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onClick={() => {
                alert(`AOS (A School OS) Version 3.4.0\nAcademic Kernel 16.3\n(C) 2026 AOS Educational Foundation\nActive User: ${userName} (${roleLabel})`);
                setShowAppleMenu(false);
              }}
              style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              About This Workstation
            </div>

            {onOpenRoleSwitcher && (
              <div
                onClick={() => {
                  onOpenRoleSwitcher();
                  setShowAppleMenu(false);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>Switch School User...</span>
                <span style={{ fontSize: "10px", color: badgeColor, fontWeight: 700 }}>
                  {effectiveRole.toUpperCase()}
                </span>
              </div>
            )}

            <div
              onClick={() => {
                onOpenApp("settings");
                setShowAppleMenu(false);
              }}
              style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              System & Desktop Settings...
            </div>

            <div style={{ height: "1px", background: "var(--w11-border-subtle)", margin: "4px 0" }} />

            <div
              onClick={() => {
                alert("Station locked into Exam Proctoring Mode.");
                setShowAppleMenu(false);
              }}
              style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Lock Station (Exam Mode)
            </div>

            <div
              onClick={() => {
                setShowAppleMenu(false);
                handleLogout();
              }}
              style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer", color: "#f59e0b" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Log Out {userName}
            </div>

            <div
              onClick={() => {
                alert("Restarting AOS workstation...");
                setShowAppleMenu(false);
              }}
              style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer", color: "#ef4444" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Restart Workstation...
            </div>
          </div>
        )}

        <span className="menubar-app-title">AOS</span>

        {/* App Drawer Launcher */}
        {onToggleAppDrawer && (
          <div
            className="menubar-item"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppDrawer();
            }}
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
            title="Open AOS App Drawer & Library"
          >
            <LayoutGrid size={13} />
            <span>Apps</span>
          </div>
        )}

        {/* App Switcher Launcher */}
        {onToggleAppSwitcher && (
          <div
            className="menubar-item"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppSwitcher();
            }}
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
            title="Open AOS Multitasking App Switcher"
          >
            <Layers size={13} />
            <span>Viewer</span>
          </div>
        )}

        {/* Dynamic section menus — one menubar item per plugin sidebar
            section, each opening a dropdown of its module apps. */}
        {sectionMenus.slice(0, 5).map((section) => (
          <div
            key={section.name}
            className={`menubar-item ${openMenuSection === section.name ? "is-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuSection(openMenuSection === section.name ? null : section.name);
            }}
            style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }}
            title={`${section.name} modules`}
          >
            <span>{section.name}</span>
            {openMenuSection === section.name && (
              <div
                style={{
                  position: "absolute",
                  top: `${heightPx + 2}px`,
                  left: 0,
                  minWidth: "200px",
                  background: "var(--w11-surface-flyout)",
                  backdropFilter: "blur(30px) saturate(180%)",
                  WebkitBackdropFilter: "blur(30px) saturate(180%)",
                  border: "1px solid var(--w11-acrylic-border)",
                  borderRadius: "8px",
                  boxShadow: "0 14px 35px rgba(0,0,0,0.4)",
                  padding: "5px",
                  zIndex: 10002,
                  fontSize: "12px",
                  color: "var(--w11-text-primary)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {section.apps.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => {
                      onOpenApp(app.id);
                      setOpenMenuSection(null);
                    }}
                    style={{ padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {app.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <span className="menubar-item" onClick={(e) => { e.stopPropagation(); onOpenApp("filemanager"); }}>Vault</span>
        <span className="menubar-item" onClick={(e) => { e.stopPropagation(); onOpenApp("appstore"); }}>Store</span>
        <span className="menubar-item" onClick={(e) => { e.stopPropagation(); onToggleWidgets(); }}>Widgets</span>
      </div>

      {/* Right Area: Status Pills & Tray Controls */}
      <div className="menubar-right">
        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <div
            className="menubar-action-icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </div>
        )}

        {/* Two-Mode Switcher Toggle Pill */}
        {onToggleSystemMode && (
          <div
            className="aos-mode-switcher-pill"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSystemMode();
            }}
            title={`Current: ${systemMode.toUpperCase()} Mode. Click to switch to ${systemMode === "desktop" ? "Mobile (iOS)" : "Desktop"} mode`}
          >
            {systemMode === "desktop" ? <Smartphone size={12} /> : <Monitor size={12} />}
            <span>{systemMode === "desktop" ? "iOS Mobile View" : "Desktop Mode"}</span>
          </div>
        )}

        {/* Language Switcher */}
        <LanguageToggle />

        {/* User Role Badge */}
        <div
          className="menubar-pill role-badge"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenRoleSwitcher) onOpenRoleSwitcher();
          }}
          title="Click to switch School Role"
          style={{
            background: `${badgeColor}22`,
            borderColor: `${badgeColor}50`,
            color: badgeColor,
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: badgeColor }} />
          <span>{userName} ({roleLabel})</span>
          {onOpenRoleSwitcher && <ChevronDown size={12} />}
        </div>

        {/* Bell Schedule Live Pill */}
        <div
          className="menubar-pill bell-active"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWidgets();
          }}
          title="Period 2 active • Click to view Notice Board & Schedule"
        >
          <span>🔔 Period 2 (PHY-302) • 28m left</span>
        </div>

        {/* Spotlight / Academic Search */}
        <div
          className="menubar-action-icon"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSpotlight) onToggleSpotlight();
            else onToggleSearch();
          }}
          title="AOS Academic Spotlight Search (Cmd + Space)"
        >
          <Search size={14} />
        </div>

        {/* Notifications Center Toggle */}
        <div
          className="menubar-action-icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotifications();
          }}
          title="Notification Center"
          style={{ position: "relative" }}
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "1px",
                right: "1px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 4px #ef4444",
              }}
            />
          )}
        </div>

        {/* Control Center Toggle */}
        <div
          className="menubar-action-icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleControlCenter();
          }}
          title="AOS Control Center"
        >
          <Sliders size={14} />
        </div>

        <span title="Campus Wi-Fi: 5G Secure (Connected)" style={{ display: "flex", alignItems: "center" }}>
          <Wifi size={14} />
        </span>
        <span title="Battery: 98% (Academic Performance Mode)" style={{ display: "flex", alignItems: "center" }}>
          <Battery size={14} />
        </span>

        {/* Clock */}
        <div
          className="menubar-clock"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotifications();
          }}
          title="Calendar & Notifications"
        >
          {timeStr || "Mon Sep 12 10:48 AM"}
        </div>
      </div>
    </div>
  );
}
