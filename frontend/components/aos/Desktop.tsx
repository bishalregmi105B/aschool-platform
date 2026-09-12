"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Trash2,
  FolderPlus,
  RefreshCw,
  Monitor,
  Palette,
  Eye,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule, type AOSApp } from "@/lib/aos-app-adapter";

interface DesktopProps {
  onOpenApp: (appId: string) => void;
  wallpaper: string;
  themeMode: "light" | "dark";
  brightness: number;
  currentRole?: string;
  showTopBar?: boolean;
  apps?: AOSApp[];
  children?: React.ReactNode;
}

export default function Desktop({
  onOpenApp,
  wallpaper,
  themeMode,
  brightness,
  currentRole = "admin",
  showTopBar = true,
  apps: externalApps,
  children,
}: DesktopProps) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);

  const desktopRef = useRef<HTMLDivElement>(null);

  // Dynamic apps from plugins if externalApps not passed
  const { sidebarItems } = useInstalledPlugins();

  const desktopIcons = useMemo(() => {
    const list: { id: string; name: string; icon: React.ReactNode }[] = externalApps
      ? externalApps.map((a) => ({ id: a.id, name: a.name, icon: a.icon }))
      : sidebarItems.map((item) => {
          const app = getAOSAppForModule(item);
          return { id: app.id, name: app.name, icon: app.icon };
        });

    // Sidebar subitems can normalize to the same module id as their parent
    // (e.g. Website → /settings/website-design); one desktop icon per module.
    const seen = new Set<string>();
    const deduped = list.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Add Academic Archive (Recycle Bin) at the end
    deduped.push({
      id: "recycle_bin",
      name: "Academic Archive",
      icon: (
        <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={38} color="#94a3b8" />
        </div>
      ),
    });

    return deduped;
  }, [externalApps, sidebarItems]);

  const getWallpaperBackground = () => {
    if (wallpaper.startsWith("custom:")) {
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target !== desktopRef.current) return;

    setSelectedIcon(null);
    setContextMenu(null);

    setSelectionBox({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      active: true,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!selectionBox || !selectionBox.active) return;
    setSelectionBox({
      ...selectionBox,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  const handlePointerUp = () => {
    if (selectionBox?.active) {
      setSelectionBox(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getBoxStyles = () => {
    if (!selectionBox) return {};
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  return (
    <div
      ref={desktopRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenu(null)}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: getWallpaperBackground(),
        overflow: "hidden",
        userSelect: "none",
        transition: "background 0.3s ease",
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
          transition: "opacity 0.1s ease",
        }}
      />

      {/* Desktop Shortcut Icons Container */}
      <div
        style={{
          position: "absolute",
          top: showTopBar ? "42px" : "16px",
          left: "16px",
          bottom: "100px",
          maxHeight: showTopBar ? "calc(100vh - 146px)" : "calc(100vh - 116px)",
          display: "flex",
          flexDirection: "column",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: "8px 14px",
          zIndex: 5,
        }}
      >
        {desktopIcons.map((item) => {
          const isSelected = selectedIcon === item.id;
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIcon(item.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (item.id === "recycle_bin") {
                  alert("Academic Archive is clean.");
                } else {
                  onOpenApp(item.id);
                }
              }}
              style={{
                width: "82px",
                padding: "8px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "8px",
                cursor: "pointer",
                border: isSelected ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid transparent",
                background: isSelected ? "rgba(255, 255, 255, 0.22)" : "transparent",
                backdropFilter: isSelected ? "blur(12px)" : "none",
                transition: "all 0.1s ease",
              }}
              className="win11-desktop-icon"
            >
              <div style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.45))" }}>
                {item.icon}
              </div>
              <span
                style={{
                  marginTop: "5px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#ffffff",
                  textAlign: "center",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)",
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                  maxWidth: "76px",
                }}
              >
                {item.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Windows Manager Layer */}
      {children}

      {/* Marquee Selection Rectangle */}
      {selectionBox?.active && (
        <div
          style={{
            position: "absolute",
            border: "1px solid rgba(0, 120, 212, 0.8)",
            background: "rgba(0, 120, 212, 0.25)",
            borderRadius: "2px",
            pointerEvents: "none",
            zIndex: 900,
            ...getBoxStyles(),
          }}
        />
      )}

      {/* Desktop Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            width: "240px",
            background: "var(--w11-surface-flyout, rgba(32, 32, 32, 0.85))",
            backdropFilter: "blur(30px) saturate(180%)",
            WebkitBackdropFilter: "blur(30px) saturate(180%)",
            border: "1px solid var(--w11-acrylic-border, rgba(255, 255, 255, 0.12))",
            borderRadius: "8px",
            boxShadow: "0 14px 35px rgba(0, 0, 0, 0.3)",
            padding: "6px",
            zIndex: 9999,
            fontSize: "12px",
            color: "var(--w11-text-primary, #ffffff)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Eye size={14} /> <span>View</span>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <ArrowUpDown size={14} /> <span>Sort by</span>
          </div>

          <div
            onClick={() => setContextMenu(null)}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <RefreshCw size={14} /> <span>Refresh</span>
          </div>

          <div style={{ height: "1px", background: "var(--w11-control-border, rgba(255,255,255,0.08))", margin: "4px 0" }} />

          <div
            onClick={() => {
              onOpenApp("files");
              setContextMenu(null);
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <FolderPlus size={14} /> <span>Open School Vault</span>
          </div>

          <div style={{ height: "1px", background: "var(--w11-control-border, rgba(255,255,255,0.08))", margin: "4px 0" }} />

          <div
            onClick={() => {
              onOpenApp("settings");
              setContextMenu(null);
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Monitor size={14} /> <span>Display settings</span>
          </div>

          <div
            onClick={() => {
              onOpenApp("settings");
              setContextMenu(null);
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Palette size={14} /> <span>Personalize Wallpaper</span>
          </div>

          <div style={{ height: "1px", background: "var(--w11-control-border, rgba(255,255,255,0.08))", margin: "4px 0" }} />

          <div
            onClick={() => alert("AOS (A School OS) 2026.1 System Information")}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover, rgba(255,255,255,0.08))")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <MoreHorizontal size={14} /> <span>Show more options</span>
          </div>
        </div>
      )}
    </div>
  );
}
