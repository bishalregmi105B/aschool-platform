"use client";

import React, { useState, useRef, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { resolveModuleComponent } from "./AOSModuleRegistry";
import { resolveRouteComponent } from "./AOSRouteTable";
import { AOSWindowRouteProvider } from "@/lib/aos-window-route";
import { SchoolRole } from "./RoleSwitcherModal";
import type { EducationalPlugin } from "./apps/AppStoreApp";
import { normalizeAOSRoute } from "@/lib/aos-navigation";

export interface WindowInstance {
  id: string;
  moduleId?: string;
  route?: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface WindowManagerProps {
  windows: WindowInstance[];
  activeWindowId: string | null;
  onFocusWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onMinimizeWindow: (id: string) => void;
  onToggleMaximizeWindow: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onResizeWindow: (id: string, x: number, y: number, width: number, height: number) => void;
  onSnapWindow: (id: string, x: number, y: number, width: number, height: number) => void;
  accentColor: string;
  onChangeAccent: (color: string) => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  wallpaper: string;
  onChangeWallpaper: (wp: string) => void;
  dockStyle: "mac" | "win11";
  onChangeDockStyle: (style: "mac" | "win11") => void;
  dockSize: "small" | "medium" | "large";
  onChangeDockSize: (size: "small" | "medium" | "large") => void;
  showTopBar: boolean;
  onToggleTopBar: () => void;
  topBarHeight?: "compact" | "standard" | "large";
  onChangeTopBarHeight?: (h: "compact" | "standard" | "large") => void;
  blurIntensity: number;
  onChangeBlurIntensity: (val: number) => void;
  taskbarAlign: "center" | "left";
  onToggleTaskbarAlign: () => void;
  brightness: number;
  onChangeBrightness: (b: number) => void;
  currentRole: SchoolRole;
  onOpenRoleSwitcher: () => void;
  plugins?: EducationalPlugin[];
  onToggleInstallPlugin?: (id: string) => void;
  onToggleActivePlugin?: (id: string) => void;
  onPurchasePlugin?: (id: string) => void;
  onUpdatePluginRoles?: (id: string, roles: SchoolRole[]) => void;
  onLaunchPluginDemo?: (id: string) => void;
  pinnedAppIds?: string[];
  onTogglePinApp?: (id: string) => void;
  onOpenRoute?: (route: string) => void;
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export default function WindowManager({
  windows,
  activeWindowId,
  onFocusWindow,
  onCloseWindow,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onUpdatePosition,
  onResizeWindow,
  onSnapWindow,
  accentColor,
  onChangeAccent,
  themeMode,
  onToggleTheme,
  wallpaper,
  onChangeWallpaper,
  dockStyle,
  onChangeDockStyle,
  dockSize,
  onChangeDockSize,
  showTopBar,
  onToggleTopBar,
  topBarHeight = "standard",
  onChangeTopBarHeight,
  blurIntensity,
  onChangeBlurIntensity,
  taskbarAlign,
  onToggleTaskbarAlign,
  brightness,
  onChangeBrightness,
  currentRole,
  onOpenRoleSwitcher,
  plugins = [],
  onToggleInstallPlugin = () => {},
  onToggleActivePlugin = () => {},
  onPurchasePlugin = () => {},
  onUpdatePluginRoles = () => {},
  onLaunchPluginDemo = () => {},
  pinnedAppIds = [],
  onTogglePinApp = () => {},
  onOpenRoute,
}: WindowManagerProps) {
  const [draggingWindowId, setDraggingWindowId] = useState<string | null>(null);
  const [resizingWindowId, setResizingWindowId] = useState<string | null>(null);
  const [resizingDirection, setResizingDirection] = useState<ResizeDirection | null>(null);
  const [snapHoverWindowId, setSnapHoverWindowId] = useState<string | null>(null);

  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number; initW: number; initH: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    initW: 0,
    initH: 0,
  });

  const rafRef = useRef<number | null>(null);

  const topOffset = showTopBar ? (topBarHeight === "large" ? 40 : topBarHeight === "compact" ? 26 : 30) : 0;
  const bottomOffset = 80;

  // Clean up rAF
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Titlebar drag start
  const handleTitlebarPointerDown = (e: React.PointerEvent, win: WindowInstance) => {
    const target = e.target as HTMLElement;
    if (target.closest(".win11-titlebar-controls") || target.tagName === "BUTTON") {
      return;
    }

    onFocusWindow(win.id);
    if (win.isMaximized) return;

    setDraggingWindowId(win.id);
    dragOffsetRef.current = {
      x: e.clientX - win.x,
      y: e.clientY - win.y,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Resize handle start (8-directional)
  const handleResizePointerDown = (e: React.PointerEvent, win: WindowInstance, dir: ResizeDirection) => {
    e.stopPropagation();
    onFocusWindow(win.id);
    if (win.isMaximized) return;

    setResizingWindowId(win.id);
    setResizingDirection(dir);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: win.x,
      initY: win.y,
      initW: win.width,
      initH: win.height,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // High-performance 120 FPS pointer move with requestAnimationFrame
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingWindowId && !resizingWindowId) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const clientX = e.clientX;
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      // 1. Dragging movement
      if (draggingWindowId) {
        const newX = Math.max(0, Math.min(window.innerWidth - 120, clientX - dragOffsetRef.current.x));
        const newY = Math.max(topOffset, Math.min(window.innerHeight - 80, clientY - dragOffsetRef.current.y));
        onUpdatePosition(draggingWindowId, newX, newY);
      }

      // 2. 8-Direction Resizing calculations
      if (resizingWindowId && resizingDirection) {
        const { startX, startY, initX, initY, initW, initH } = resizeStartRef.current;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        let nextX = initX;
        let nextY = initY;
        let nextW = initW;
        let nextH = initH;

        const minW = 380;
        const minH = 260;

        if (resizingDirection.includes("e")) {
          nextW = Math.max(minW, initW + deltaX);
        }
        if (resizingDirection.includes("s")) {
          nextH = Math.max(minH, initH + deltaY);
        }
        if (resizingDirection.includes("w")) {
          const potentialW = initW - deltaX;
          if (potentialW >= minW) {
            nextW = potentialW;
            nextX = initX + deltaX;
          }
        }
        if (resizingDirection.includes("n")) {
          const potentialH = initH - deltaY;
          if (potentialH >= minH) {
            nextH = potentialH;
            nextY = initY + deltaY;
          }
        }

        onResizeWindow(resizingWindowId, nextX, nextY, nextW, nextH);
      }
    });
  };

  const handlePointerUp = () => {
    if (draggingWindowId) setDraggingWindowId(null);
    if (resizingWindowId) {
      setResizingWindowId(null);
      setResizingDirection(null);
    }
  };

  // Screen snap calculations (Windows 11 Snap Assist)
  const snapTo = (winId: string, type: "left50" | "right50" | "left70" | "right30" | "tl" | "tr" | "bl" | "br") => {
    const screenW = window.innerWidth;
    const availableH = window.innerHeight - topOffset - bottomOffset;

    switch (type) {
      case "left50":
        onSnapWindow(winId, 0, topOffset, screenW / 2, availableH);
        break;
      case "right50":
        onSnapWindow(winId, screenW / 2, topOffset, screenW / 2, availableH);
        break;
      case "left70":
        onSnapWindow(winId, 0, topOffset, screenW * 0.7, availableH);
        break;
      case "right30":
        onSnapWindow(winId, screenW * 0.7, topOffset, screenW * 0.3, availableH);
        break;
      case "tl":
        onSnapWindow(winId, 0, topOffset, screenW / 2, availableH / 2);
        break;
      case "tr":
        onSnapWindow(winId, screenW / 2, topOffset, screenW / 2, availableH / 2);
        break;
      case "bl":
        onSnapWindow(winId, 0, topOffset + availableH / 2, screenW / 2, availableH / 2);
        break;
      case "br":
        onSnapWindow(winId, screenW / 2, topOffset + availableH / 2, screenW / 2, availableH / 2);
        break;
    }
    setSnapHoverWindowId(null);
  };

  const handleInternalAnchorNavigation = (
    e: React.MouseEvent<HTMLDivElement>,
    win: WindowInstance
  ) => {
    if (!onOpenRoute) return;

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
    onOpenRoute(normalized);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {windows.map((win) => {
        if (!win.isOpen || win.isMinimized) return null;

        const isActive = activeWindowId === win.id;
        const isInteracting = draggingWindowId === win.id || resizingWindowId === win.id;

        const windowStyle: React.CSSProperties = {
          position: "absolute",
          left: win.isMaximized ? 0 : `${win.x}px`,
          top: win.isMaximized ? `${topOffset}px` : `${win.y}px`,
          width: win.isMaximized ? "100vw" : `${win.width}px`,
          height: win.isMaximized ? `calc(100vh - ${topOffset + bottomOffset}px)` : `${win.height}px`,
          zIndex: win.zIndex,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          borderRadius: win.isMaximized ? 0 : "12px",
          transition: isInteracting
            ? "none"
            : "width 0.16s cubic-bezier(0.16, 1, 0.3, 1), height 0.16s cubic-bezier(0.16, 1, 0.3, 1), left 0.16s cubic-bezier(0.16, 1, 0.3, 1), top 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: isActive
            ? "0 28px 70px rgba(0, 0, 0, 0.38), 0 0 1px rgba(255, 255, 255, 0.2)"
            : "0 10px 30px rgba(0, 0, 0, 0.2)",
          contain: "layout",
        };

        // Exact-route resolution first (the route table maps every path to
        // its exact page — subroutes swap content within the same window),
        // then the module registry, iframe as a last resort.
        const routeComponent = win.route ? resolveRouteComponent(win.route) : null;
        const ResolvedComponent = routeComponent
          ? routeComponent
          : resolveModuleComponent(win.route ? `route:${win.route}` : win.moduleId || win.id);

        return (
          <div
            key={win.id}
            className={`win11-window animate-window-in aos-gpu-accel ${isActive ? "active" : ""} ${win.isMaximized ? "is-maximized" : ""}`}
            style={windowStyle}
            onPointerDown={() => onFocusWindow(win.id)}
          >
            {/* 8 Resizable Handles for fluid desktop resizing */}
            {!win.isMaximized && (
              <>
                <div
                  className="win11-resize-handle resize-n"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "n")}
                />
                <div
                  className="win11-resize-handle resize-s"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "s")}
                />
                <div
                  className="win11-resize-handle resize-w"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "w")}
                />
                <div
                  className="win11-resize-handle resize-e"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "e")}
                />
                <div
                  className="win11-resize-handle resize-nw"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "nw")}
                />
                <div
                  className="win11-resize-handle resize-ne"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "ne")}
                />
                <div
                  className="win11-resize-handle resize-sw"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "sw")}
                />
                <div
                  className="win11-resize-handle resize-se"
                  onPointerDown={(e) => handleResizePointerDown(e, win, "se")}
                />
              </>
            )}

            {/* Titlebar — 38px, macOS-grade icon + title arrangement */}
            <div
              className="win11-titlebar"
              onPointerDown={(e) => handleTitlebarPointerDown(e, win)}
              onDoubleClick={() => onToggleMaximizeWindow(win.id)}
              style={{
                cursor: win.isMaximized ? "default" : "move",
                height: "38px",
                paddingLeft: "14px",
                paddingRight: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div
                className="win11-titlebar-title"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    flexShrink: 0,
                  }}
                >
                  {win.icon}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={win.title}
                >
                  {win.title}
                </span>
              </div>

              {/* Titlebar Window Controls */}
              <div
                className="win11-titlebar-controls"
                style={{ position: "relative", height: "38px", alignSelf: "stretch", flexShrink: 0 }}
              >
                <button
                  aria-label="Minimize"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMinimizeWindow(win.id);
                  }}
                  title="Minimize"
                >
                  <Minus size={14} />
                </button>

                <button
                  aria-label={win.isMaximized ? "Restore" : "Maximize"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMaximizeWindow(win.id);
                  }}
                  onMouseEnter={() => setSnapHoverWindowId(win.id)}
                  onMouseLeave={() => setSnapHoverWindowId(null)}
                  title="Maximize / Snap Layouts"
                  style={{ position: "relative" }}
                >
                  {win.isMaximized ? <Copy size={12} /> : <Square size={12} />}

                  {/* Windows 11 Snap Layouts Popover */}
                  {snapHoverWindowId === win.id && (
                    <div
                      className="win11-snap-menu"
                      onMouseEnter={() => setSnapHoverWindowId(win.id)}
                      onMouseLeave={() => setSnapHoverWindowId(null)}
                    >
                      {/* Layout 1: 50 / 50 Split */}
                      <div className="snap-layout-card" title="Split 50 / 50">
                        <div
                          className="snap-zone"
                          style={{ flex: 1, height: "100%" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            snapTo(win.id, "left50");
                          }}
                        />
                        <div
                          className="snap-zone"
                          style={{ flex: 1, height: "100%" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            snapTo(win.id, "right50");
                          }}
                        />
                      </div>

                      {/* Layout 2: 70 / 30 Split */}
                      <div className="snap-layout-card" title="Split 70 / 30">
                        <div
                          className="snap-zone"
                          style={{ flex: 7, height: "100%" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            snapTo(win.id, "left70");
                          }}
                        />
                        <div
                          className="snap-zone"
                          style={{ flex: 3, height: "100%" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            snapTo(win.id, "right30");
                          }}
                        />
                      </div>

                      {/* Layout 3: 4 Quadrants */}
                      <div className="snap-layout-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }} title="4 Quadrants">
                        <div className="snap-zone" style={{ height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "tl"); }} />
                        <div className="snap-zone" style={{ height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "tr"); }} />
                        <div className="snap-zone" style={{ height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "bl"); }} />
                        <div className="snap-zone" style={{ height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "br"); }} />
                      </div>

                      {/* Layout 4: 3-Column */}
                      <div className="snap-layout-card" title="3 Columns">
                        <div className="snap-zone" style={{ flex: 1, height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "left50"); }} />
                        <div className="snap-zone" style={{ flex: 2, height: "100%" }} onClick={(e) => { e.stopPropagation(); onToggleMaximizeWindow(win.id); }} />
                        <div className="snap-zone" style={{ flex: 1, height: "100%" }} onClick={(e) => { e.stopPropagation(); snapTo(win.id, "right50"); }} />
                      </div>
                    </div>
                  )}
                </button>

                <button
                  aria-label="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseWindow(win.id);
                  }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Window Content Body with CSS Containment */}
            <div
              className="win11-window-body aos-window-content"
              onClickCapture={(e) => handleInternalAnchorNavigation(e, win)}
              style={{
                contain: "layout paint",
                transform: "translateZ(0)",
                overflow: "auto",
                position: "relative",
                height: "100%",
                flex: 1,
                minHeight: 0,
                pointerEvents: isInteracting ? "none" : "auto",
              }}
            >
              <AOSWindowRouteProvider route={win.route || `/dashboard/${win.moduleId || win.id}`}>
              <ResolvedComponent
                window={win}
                pluginId={win.id}
                currentRole={currentRole}
                accentColor={accentColor}
                themeMode={themeMode}
                onToggleTheme={onToggleTheme}
                wallpaper={wallpaper}
                onChangeWallpaper={onChangeWallpaper}
                dockStyle={dockStyle}
                onChangeDockStyle={onChangeDockStyle}
                dockSize={dockSize}
                onChangeDockSize={onChangeDockSize}
                showTopBar={showTopBar}
                onToggleTopBar={onToggleTopBar}
                topBarHeight={topBarHeight}
                onChangeTopBarHeight={onChangeTopBarHeight}
                blurIntensity={blurIntensity}
                onChangeBlurIntensity={onChangeBlurIntensity}
                taskbarAlign={taskbarAlign}
                onToggleTaskbarAlign={onToggleTaskbarAlign}
                brightness={brightness}
                onChangeBrightness={onChangeBrightness}
                onOpenRoleSwitcher={onOpenRoleSwitcher}
                pinnedAppIds={pinnedAppIds}
                onTogglePinApp={onTogglePinApp}
                plugins={plugins}
                onToggleInstallPlugin={onToggleInstallPlugin}
                onToggleActivePlugin={onToggleActivePlugin}
                onPurchasePlugin={onPurchasePlugin}
                onUpdatePluginRoles={onUpdatePluginRoles}
                onLaunchPluginDemo={onLaunchPluginDemo}
              />
              </AOSWindowRouteProvider>
            </div>
          </div>
        );
      })}
    </div>
  );
}
