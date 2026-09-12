"use client";

import React, { useState } from "react";
import {
  AOSLogo,
  AOSFileManagerIcon,
  AOSClassroomIcon,
  AOSGradebookIcon,
  AOSTimetableIcon,
  AOSLibraryIcon,
  AOSExamIcon,
  AOSCampusIcon,
  AOSNotebookIcon,
  AOSLabIcon,
  AOSTerminalIcon,
  AOSAdminIcon,
  AOSFinanceIcon,
  AOSSettingsIcon,
} from "@/components/aos/AOSIcons";
import { Trash2, LayoutGrid, Layers, Sparkles, Box } from "lucide-react";
import { WindowInstance, SchoolRole, EducationalPlugin } from "@/components/aos/types";
import { useInstalledPlugins, PluginSidebarItem } from "@/lib/plugins";

interface DynamicDockApp {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface DockProps {
  windows: WindowInstance[];
  activeWindowId: string | null;
  onToggleWindow: (appId: string) => void;
  onToggleStart: () => void;
  isStartOpen: boolean;
  accentColor?: string;
  currentRole?: SchoolRole;
  dockSize?: "small" | "medium" | "large";
  onToggleAppDrawer?: () => void;
  onToggleAppSwitcher?: () => void;
  pinnedAppIds?: string[];
  plugins?: EducationalPlugin[];
  dynamicApps?: DynamicDockApp[];
  sidebarItems?: PluginSidebarItem[];
}

export default function Dock({
  windows,
  activeWindowId,
  onToggleWindow,
  onToggleStart,
  isStartOpen,
  accentColor = "#0078d4",
  currentRole = "student",
  dockSize = "medium",
  onToggleAppDrawer,
  onToggleAppSwitcher,
  pinnedAppIds = [
    "filemanager",
    "classroom",
    "gradebook",
    "timetable",
    "library",
    "exam",
    "campus",
    "notebook",
    "lab",
    "terminal",
    "appstore",
    "settings",
  ],
  plugins = [],
  dynamicApps = [],
  sidebarItems,
}: DockProps) {
  const [bouncingId, setBouncingId] = useState<string | null>(null);

  // Hook into installed plugins if sidebarItems not directly passed
  const { sidebarItems: contextSidebarItems } = useInstalledPlugins();
  const effectiveSidebar = sidebarItems || contextSidebarItems || [];

  // Icon dimension based on user setting
  const iconPx = dockSize === "small" ? 38 : dockSize === "large" ? 56 : 46;

  const handleAppClick = (id: string) => {
    setBouncingId(id);
    setTimeout(() => setBouncingId(null), 600);
    onToggleWindow(id);
  };

  // Base system apps repository
  const appCatalog: Record<string, { id: string; title: string; icon: React.ReactNode }> = {
    filemanager: { id: "filemanager", title: "School Cloud Vault & Files", icon: <AOSFileManagerIcon size={iconPx} /> },
    classroom: { id: "classroom", title: "Live Classroom", icon: <AOSClassroomIcon size={iconPx} /> },
    gradebook: { id: "gradebook", title: "Academic Gradebook & GPA", icon: <AOSGradebookIcon size={iconPx} /> },
    timetable: { id: "timetable", title: "Weekly Bell Timetable", icon: <AOSTimetableIcon size={iconPx} /> },
    library: { id: "library", title: "Digital Knowledge Vault", icon: <AOSLibraryIcon size={iconPx} /> },
    exam: { id: "exam", title: "Assessment & Exam Center", icon: <AOSExamIcon size={iconPx} /> },
    campus: { id: "campus", title: "Campus Fleet GPS & Dining", icon: <AOSCampusIcon size={iconPx} /> },
    notebook: { id: "notebook", title: "Study Notebook & Binder", icon: <AOSNotebookIcon size={iconPx} /> },
    lab: { id: "lab", title: "Science Lab Studio", icon: <AOSLabIcon size={iconPx} /> },
    terminal: { id: "terminal", title: "CS Lab Terminal", icon: <AOSTerminalIcon size={iconPx} /> },
    appstore: {
      id: "appstore",
      title: "AOS App Store & Extensions",
      icon: (
        <div
          style={{
            width: `${iconPx}px`,
            height: `${iconPx}px`,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 4px 10px rgba(14, 165, 233, 0.4)",
          }}
        >
          <Sparkles size={Math.round(iconPx * 0.55)} />
        </div>
      ),
    },
    settings: { id: "settings", title: "AOS Settings & Personalization", icon: <AOSSettingsIcon size={iconPx} /> },
    admin: { id: "admin", title: "Institutional Command Center", icon: <AOSAdminIcon size={iconPx} /> },
    finance: { id: "finance", title: "Tuition & Bursar Ledger", icon: <AOSFinanceIcon size={iconPx} /> },
  };

  // Add active plugins into appCatalog
  plugins.forEach((p) => {
    if (p.isInstalled && p.isActive && (p.allowedRoles.includes(currentRole) || currentRole === "admin")) {
      appCatalog[p.id] = {
        id: p.id,
        title: p.name,
        icon: (
          <div
            style={{
              width: `${iconPx}px`,
              height: `${iconPx}px`,
              borderRadius: "12px",
              background: p.accent || "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: `0 4px 10px ${p.accent || "#0284c7"}50`,
            }}
          >
            {p.icon}
          </div>
        ),
      };
    }
  });

  // Add dynamic apps
  dynamicApps.forEach((d) => {
    appCatalog[d.id] = d;
  });

  // Add sidebar items dynamically from YAML manifests
  effectiveSidebar.forEach((sb) => {
    if (!appCatalog[sb.slug]) {
      appCatalog[sb.slug] = {
        id: sb.slug,
        title: sb.label,
        icon: (
          <div
            style={{
              width: `${iconPx}px`,
              height: `${iconPx}px`,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 10px rgba(16, 185, 129, 0.4)",
            }}
          >
            <Box size={Math.round(iconPx * 0.52)} />
          </div>
        ),
      };
    }
  });

  // Filter pinned apps that exist and are authorized
  const visiblePinnedApps = pinnedAppIds
    .filter((id) => {
      if (id === "admin" && currentRole !== "admin") return false;
      if (id === "finance" && currentRole !== "accountant" && currentRole !== "admin") return false;
      return Boolean(appCatalog[id]);
    })
    .map((id) => appCatalog[id]);

  // Find running windows that are NOT in pinned apps (macOS temporary running icons)
  const unpinnedRunningWindows = windows.filter(
    (w) => w.isOpen && !pinnedAppIds.includes(w.id) && Boolean(appCatalog[w.id])
  );

  return (
    <div className="macos-dock-wrapper">
      <div className="macos-dock">
        {/* AOS Launcher Button */}
        <div
          className={`dock-app-item ${isStartOpen ? "dock-bounce" : ""}`}
          onClick={onToggleStart}
        >
          <div className="dock-tooltip">AOS Academic Hub</div>
          <div className="dock-icon-wrapper" style={{ width: `${iconPx}px`, height: `${iconPx}px` }}>
            <AOSLogo size={iconPx} />
          </div>
          {isStartOpen && (
            <div className="dock-dot" style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
          )}
        </div>

        {/* Launchpad / App Drawer */}
        {onToggleAppDrawer && (
          <div
            className="dock-app-item"
            onClick={onToggleAppDrawer}
          >
            <div className="dock-tooltip">App Drawer & Library</div>
            <div
              className="dock-icon-wrapper"
              style={{
                width: `${iconPx}px`,
                height: `${iconPx}px`,
                background: "linear-gradient(135deg, #6366f1, #4338ca)",
                borderRadius: "12px",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(99, 102, 241, 0.4)",
              }}
            >
              <LayoutGrid size={Math.round(iconPx * 0.52)} />
            </div>
          </div>
        )}

        {/* Multitasking App Switcher */}
        {onToggleAppSwitcher && (
          <div
            className="dock-app-item"
            onClick={onToggleAppSwitcher}
          >
            <div className="dock-tooltip">App Viewer & Switcher</div>
            <div
              className="dock-icon-wrapper"
              style={{
                width: `${iconPx}px`,
                height: `${iconPx}px`,
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                borderRadius: "12px",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(2, 132, 199, 0.4)",
              }}
            >
              <Layers size={Math.round(iconPx * 0.52)} />
            </div>
          </div>
        )}

        {/* Vertical Separator */}
        <div className="dock-separator" />

        {/* Pinned Educational Apps */}
        {visiblePinnedApps.map((app) => {
          const win = windows.find((w) => w.id === app.id);
          const isOpen = win && win.isOpen;
          const isFocused = isOpen && activeWindowId === app.id && !win.isMinimized;
          const isBouncing = bouncingId === app.id;

          return (
            <div
              key={app.id}
              className={`dock-app-item ${isBouncing ? "dock-bounce" : ""}`}
              onClick={() => handleAppClick(app.id)}
            >
              <div className="dock-tooltip">{app.title}</div>
              <div
                className="dock-icon-wrapper"
                style={{
                  width: `${iconPx}px`,
                  height: `${iconPx}px`,
                  filter: isFocused ? "drop-shadow(0 4px 10px rgba(0,120,212,0.5))" : undefined,
                }}
              >
                {app.icon}
              </div>

              {/* Running / Active Indicator Dot */}
              {isOpen && (
                <div
                  className="dock-dot"
                  style={{
                    background: isFocused ? accentColor : "rgba(255,255,255,0.75)",
                    boxShadow: isFocused ? `0 0 6px ${accentColor}` : undefined,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Unpinned but Running Windows (macOS style dynamic items) */}
        {unpinnedRunningWindows.length > 0 && (
          <>
            <div className="dock-separator" />
            {unpinnedRunningWindows.map((win) => {
              const app = appCatalog[win.id];
              if (!app) return null;
              const isFocused = activeWindowId === win.id && !win.isMinimized;
              const isBouncing = bouncingId === win.id;

              return (
                <div
                  key={win.id}
                  className={`dock-app-item ${isBouncing ? "dock-bounce" : ""}`}
                  onClick={() => handleAppClick(win.id)}
                >
                  <div className="dock-tooltip">{app.title} (Running)</div>
                  <div
                    className="dock-icon-wrapper"
                    style={{
                      width: `${iconPx}px`,
                      height: `${iconPx}px`,
                    }}
                  >
                    {app.icon}
                  </div>
                  <div
                    className="dock-dot"
                    style={{
                      background: isFocused ? accentColor : "rgba(255,255,255,0.75)",
                      boxShadow: isFocused ? `0 0 6px ${accentColor}` : undefined,
                    }}
                  />
                </div>
              );
            })}
          </>
        )}

        {/* Separator before Trash */}
        <div className="dock-separator" />

        {/* Academic Archive / Trash */}
        <div
          className="dock-app-item"
          onClick={() => alert("Academic Archive: Recycle Bin is clean.")}
        >
          <div className="dock-tooltip">Academic Archive</div>
          <div
            className="dock-icon-wrapper"
            style={{
              width: `${iconPx}px`,
              height: `${iconPx}px`,
              background: "rgba(255,255,255,0.12)",
              borderRadius: "12px",
            }}
          >
            <Trash2 size={Math.round(iconPx * 0.6)} color="#94a3b8" />
          </div>
        </div>
      </div>
    </div>
  );
}
