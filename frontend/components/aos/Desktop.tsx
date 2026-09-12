"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Trash2,
  FolderPlus,
  RefreshCw,
  Monitor,
  Palette,
  Eye,
  ArrowUpDown,
  MoreHorizontal,
  Folder,
  FolderOpen,
  FolderMinus,
  PenLine,
  ListPlus,
  ChevronRight,
  Plus,
  AppWindow,
} from "lucide-react";
import { useInstalledPlugins } from "@/lib/plugins";
import { getAOSAppForModule, SECTION_GRADIENTS, type AOSApp } from "@/lib/aos-app-adapter";
import {
  createFolderId,
  generateUniqueFolderName,
  validateFolderName,
  FOLDER_NAME_MAX_LENGTH,
  type AOSDesktopFolder,
  type ResolvedAOSDesktopFolder,
} from "@/lib/aos-launcher";

interface DesktopProps {
  onOpenApp: (appId: string) => void;
  wallpaper: string;
  themeMode: "light" | "dark";
  brightness: number;
  currentRole?: string;
  showTopBar?: boolean;
  apps?: AOSApp[];
  /**
   * Resolved folder layout (folder -> live apps). When undefined the classic
   * folder-less desktop is rendered (backward compatibility).
   */
  folders?: ResolvedAOSDesktopFolder[];
  /** Persist the next folder list (called only on explicit user edits). */
  onUpdateFolders?: (folders: AOSDesktopFolder[]) => void;
  children?: React.ReactNode;
}

type ContextMenuTarget =
  | { kind: "desktop" }
  | { kind: "folder"; folderId: string }
  | { kind: "app"; appId: string };

interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

type FolderDialog =
  | { type: "rename"; folderId: string; name: string }
  | { type: "remove"; folderId: string }
  | { type: "addApps"; folderId: string; selected: string[] }
  | { type: "newFolder"; appId: string; name: string };

const CONTEXT_MENU_WIDTH = 240;

/** Acrylic flyout surface shared by the context menu, submenus and folder popup. */
const acrylicSurfaceStyle: React.CSSProperties = {
  background: "var(--w11-surface-flyout, rgba(32, 32, 32, 0.85))",
  backdropFilter: "blur(30px) saturate(180%)",
  WebkitBackdropFilter: "blur(30px) saturate(180%)",
  border: "1px solid var(--w11-acrylic-border, rgba(255, 255, 255, 0.12))",
  boxShadow: "0 14px 35px rgba(0, 0, 0, 0.3)",
  color: "var(--w11-text-primary, #ffffff)",
};

const dialogInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: "13px",
  borderRadius: "6px",
  background: "var(--w11-control-bg)",
  border: "1px solid var(--w11-control-border)",
  color: "var(--w11-text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

function MenuDivider() {
  return (
    <div
      style={{
        height: "1px",
        background: "var(--w11-control-border, rgba(255,255,255,0.08))",
        margin: "4px 0",
      }}
    />
  );
}

function DesktopMenuItem({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        color: danger ? "#c42b1c" : "inherit",
        userSelect: "none",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor =
          "var(--w11-control-hover, rgba(255,255,255,0.08))")
      }
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <span style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {trailing}
    </div>
  );
}

/** macOS-style stack tile: rounded gradient square with a folder glyph. */
function FolderTile({ name, size = 44 }: { name: string; size?: number }) {
  const sectionGradient = SECTION_GRADIENTS[name];
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size >= 52 ? "14px" : Math.max(6, Math.round(size * 0.22)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        // Solid accent fallback first so browsers without color-mix() degrade
        // to a flat accent tile instead of a transparent one.
        background: sectionGradient || "var(--w11-accent, #0078d4)",
        backgroundImage:
          sectionGradient ||
          "linear-gradient(135deg, var(--w11-accent, #0078d4) 0%, color-mix(in srgb, var(--w11-accent, #0078d4) 55%, #001a3a) 100%)",
        boxShadow:
          "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
      }}
    >
      <Folder
        size={Math.max(13, Math.round(size * 0.55))}
        strokeWidth={2.2}
        fill="rgba(255,255,255,0.18)"
      />
    </div>
  );
}

/** Shared chrome for desktop icons (app + folder + recycle bin). */
function DesktopIconTile({
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  icon,
  label,
}: {
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        width: "82px",
        padding: "8px 4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderRadius: "8px",
        cursor: "pointer",
        border: selected ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid transparent",
        background: selected ? "rgba(255, 255, 255, 0.22)" : "transparent",
        backdropFilter: selected ? "blur(12px)" : "none",
        transition: "all 0.1s ease",
      }}
      className="win11-desktop-icon"
    >
      <div style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.45))" }}>{icon}</div>
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
        {label}
      </span>
    </div>
  );
}

export default function Desktop({
  onOpenApp,
  wallpaper,
  themeMode,
  brightness,
  currentRole = "admin",
  showTopBar = true,
  apps: externalApps,
  folders: resolvedFolders,
  onUpdateFolders,
  children,
}: DesktopProps) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [folderPopup, setFolderPopup] = useState<{
    folderId: string;
    left: number;
    top: number;
  } | null>(null);
  const [dialog, setDialog] = useState<FolderDialog | null>(null);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);

  const desktopRef = useRef<HTMLDivElement>(null);

  // Folder mode is active as soon as the resolved layout is provided; without
  // it the desktop behaves exactly as before (loose icons only).
  const folderMode = resolvedFolders !== undefined;

  // Dynamic apps from plugins if externalApps not passed
  const { sidebarItems } = useInstalledPlugins();

  const folderedAppIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of resolvedFolders ?? []) {
      for (const app of folder.apps) ids.add(app.id);
    }
    return ids;
  }, [resolvedFolders]);

  // Persisted-shape folders (id/name/appIds) for edits + name validation.
  const currentFolders: AOSDesktopFolder[] = useMemo(
    () =>
      (resolvedFolders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        appIds: folder.appIds,
      })),
    [resolvedFolders]
  );

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

    // Foldered apps are represented by their folder icon instead.
    const loose = folderMode
      ? deduped.filter((item) => !folderedAppIds.has(item.id))
      : deduped;

    // Add Academic Archive (Recycle Bin) at the end
    loose.push({
      id: "recycle_bin",
      name: "Academic Archive",
      icon: (
        <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={38} color="#94a3b8" />
        </div>
      ),
    });

    return loose;
  }, [externalApps, sidebarItems, folderMode, folderedAppIds]);

  const popupFolder = useMemo(
    () =>
      folderPopup
        ? (resolvedFolders ?? []).find((f) => f.id === folderPopup.folderId) ?? null
        : null,
    [folderPopup, resolvedFolders]
  );

  const dialogFolder = useMemo(() => {
    if (!dialog || dialog.type === "newFolder") return null;
    return (resolvedFolders ?? []).find((f) => f.id === dialog.folderId) ?? null;
  }, [dialog, resolvedFolders]);

  // Close the folder popup / dialogs on Escape (matches shell flyout behavior).
  useEffect(() => {
    if (!folderPopup && !dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFolderPopup(null);
        setDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [folderPopup, dialog]);

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
        return "linear-gradient(135deg, #f6d365 0%, #fda085 100%)";
      case "ventura":
        return "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)";
      case "blueprint":
        return "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%)";
      case "nebula":
        return "radial-gradient(ellipse at top, #312e81, #0c0a09)";
      case "forest":
        return "linear-gradient(135deg, #14532d 0%, #166534 50%, #052e16 100%)";
      case "minimal":
        return "linear-gradient(135deg, #f5f5f5, #e5e5e5)";
      default:
        return themeMode === "dark"
          ? "linear-gradient(135deg, #0b192c 0%, #1e3a8a 50%, #0f172a 100%)"
          : "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 80%, #38bdf8 100%)";
    }
  };

  // ── Folder popup positioning ──────────────────────────────────────────────
  // Anchored below/beside the trigger point, clamped into the viewport (and
  // flipped above the anchor when it would overflow the bottom edge).
  const computePopupPosition = (
    folder: ResolvedAOSDesktopFolder,
    centerX: number,
    anchorBottom: number,
    anchorTop: number
  ) => {
    const POPUP_WIDTH = 300;
    const estimatedHeight = Math.min(64 + folder.apps.length * 56, 420);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = centerX - POPUP_WIDTH / 2;
    left = Math.max(12, Math.min(left, vw - POPUP_WIDTH - 12));

    let top = anchorBottom + 10;
    if (top + estimatedHeight > vh - 12) {
      const above = anchorTop - estimatedHeight - 10;
      top = above >= 12 ? above : Math.max(12, vh - estimatedHeight - 12);
    }
    return { left, top };
  };

  const openFolderPopupFromIcon = (
    folder: ResolvedAOSDesktopFolder,
    e: React.MouseEvent
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { left, top } = computePopupPosition(
      folder,
      rect.left + rect.width / 2,
      rect.bottom,
      rect.top
    );
    setFolderPopup({ folderId: folder.id, left, top });
  };

  // ── Folder mutations (each commits the full next folder list) ─────────────
  const commitFolders = (next: AOSDesktopFolder[]) => {
    onUpdateFolders?.(next);
  };

  const addAppToFolder = (folderId: string, appId: string) => {
    commitFolders(
      currentFolders.map((f) =>
        f.id === folderId && !f.appIds.includes(appId)
          ? { ...f, appIds: [...f.appIds, appId] }
          : f
      )
    );
  };

  const nameDialog =
    dialog && (dialog.type === "rename" || dialog.type === "newFolder") ? dialog : null;
  const nameError = nameDialog
    ? validateFolderName(
        nameDialog.name,
        currentFolders,
        nameDialog.type === "rename" ? nameDialog.folderId : undefined
      )
    : null;

  const submitRename = () => {
    if (!dialog || dialog.type !== "rename" || nameError) return;
    const { folderId, name } = dialog;
    commitFolders(
      currentFolders.map((f) => (f.id === folderId ? { ...f, name: name.trim() } : f))
    );
    setDialog(null);
  };

  const submitNewFolder = () => {
    if (!dialog || dialog.type !== "newFolder" || nameError) return;
    const { appId, name } = dialog;
    const trimmed = name.trim();
    commitFolders([
      ...currentFolders,
      { id: createFolderId(trimmed, currentFolders), name: trimmed, appIds: [appId] },
    ]);
    setDialog(null);
  };

  const submitAddApps = () => {
    if (!dialog || dialog.type !== "addApps" || dialog.selected.length === 0) return;
    const { folderId, selected } = dialog;
    commitFolders(
      currentFolders.map((f) =>
        f.id === folderId
          ? {
              ...f,
              appIds: [...f.appIds, ...selected.filter((id) => !f.appIds.includes(id))],
            }
          : f
      )
    );
    setDialog(null);
  };

  const submitRemoveFolder = () => {
    if (!dialog || dialog.type !== "remove") return;
    const { folderId } = dialog;
    // Apps in the folder simply return loose — no appIds to migrate.
    commitFolders(currentFolders.filter((f) => f.id !== folderId));
    setDialog(null);
  };

  const looseAppsForDialog = desktopIcons.filter((item) => item.id !== "recycle_bin");

  // ── Pointer / selection plumbing (unchanged behavior) ─────────────────────
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

  const openContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 16));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 360));
    setSubmenuOpen(false);
    setFolderPopup(null);
    setContextMenu({ x, y, target });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 16));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 360));
    setSubmenuOpen(false);
    setContextMenu({ x, y, target: { kind: "desktop" } });
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

  // ── Context menu fragments ────────────────────────────────────────────────
  const contextMenuShell = (content: React.ReactNode) => (
    <div
      style={{
        position: "fixed",
        top: `${contextMenu!.y}px`,
        left: `${contextMenu!.x}px`,
        width: `${CONTEXT_MENU_WIDTH}px`,
        ...acrylicSurfaceStyle,
        borderRadius: "8px",
        padding: "6px",
        zIndex: 9999,
        fontSize: "12px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );

  const renderFolderMenu = (folderId: string) => {
    const folder = (resolvedFolders ?? []).find((f) => f.id === folderId);
    if (!folder) return null;
    return contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<FolderOpen size={14} />}
          label="Open"
          onClick={() => {
            const { left, top } = computePopupPosition(
              folder,
              contextMenu!.x + 80,
              contextMenu!.y,
              contextMenu!.y
            );
            setFolderPopup({ folderId: folder.id, left, top });
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <DesktopMenuItem
          icon={<PenLine size={14} />}
          label="Rename Folder"
          onClick={() => {
            setDialog({ type: "rename", folderId, name: folder.name });
            setContextMenu(null);
          }}
        />
        <DesktopMenuItem
          icon={<ListPlus size={14} />}
          label="Add Apps to Folder…"
          onClick={() => {
            setDialog({ type: "addApps", folderId, selected: [] });
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <DesktopMenuItem
          icon={<FolderMinus size={14} />}
          label="Remove Folder"
          danger
          onClick={() => {
            setDialog({ type: "remove", folderId });
            setContextMenu(null);
          }}
        />
      </>
    );
  };

  const renderAppMenu = (appId: string) => {
    const app = desktopIcons.find((item) => item.id === appId);
    if (!app) return null;
    const submenuFitsRight =
      contextMenu!.x + CONTEXT_MENU_WIDTH + 210 < window.innerWidth;
    return contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<AppWindow size={14} />}
          label="Open"
          onClick={() => {
            onOpenApp(appId);
            setContextMenu(null);
          }}
        />
        <MenuDivider />
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          <DesktopMenuItem
            icon={<FolderPlus size={14} />}
            label="Add to Folder"
            trailing={<ChevronRight size={14} style={{ opacity: 0.8, flexShrink: 0 }} />}
          />
          {submenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "-6px",
                width: "200px",
                ...(submenuFitsRight
                  ? { left: "calc(100% + 4px)" }
                  : { right: "calc(100% + 4px)" }),
                ...acrylicSurfaceStyle,
                borderRadius: "8px",
                padding: "6px",
                fontSize: "12px",
                boxShadow: "0 14px 35px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {currentFolders.length === 0 && (
                <div
                  style={{
                    padding: "6px 10px",
                    color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                  }}
                >
                  No folders yet
                </div>
              )}
              {currentFolders.map((folder) => (
                <DesktopMenuItem
                  key={folder.id}
                  icon={<Folder size={14} />}
                  label={folder.name}
                  trailing={
                    <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>
                      {folder.appIds.length}
                    </span>
                  }
                  onClick={() => {
                    addAppToFolder(folder.id, appId);
                    setContextMenu(null);
                  }}
                />
              ))}
              {currentFolders.length > 0 && <MenuDivider />}
              <DesktopMenuItem
                icon={<Plus size={14} />}
                label="New Folder…"
                onClick={() => {
                  setDialog({
                    type: "newFolder",
                    appId,
                    name: generateUniqueFolderName(currentFolders),
                  });
                  setContextMenu(null);
                }}
              />
            </div>
          )}
        </div>
      </>
    );
  };

  const renderDesktopMenu = () =>
    contextMenuShell(
      <>
        <DesktopMenuItem
          icon={<Eye size={14} />}
          label="View"
        />

        <DesktopMenuItem icon={<ArrowUpDown size={14} />} label="Sort by" />

        <DesktopMenuItem
          icon={<RefreshCw size={14} />}
          label="Refresh"
          onClick={() => setContextMenu(null)}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<FolderPlus size={14} />}
          label="Open School Vault"
          onClick={() => {
            onOpenApp("files");
            setContextMenu(null);
          }}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<Monitor size={14} />}
          label="Display settings"
          onClick={() => {
            onOpenApp("settings");
            setContextMenu(null);
          }}
        />

        <DesktopMenuItem
          icon={<Palette size={14} />}
          label="Personalize Wallpaper"
          onClick={() => {
            onOpenApp("settings");
            setContextMenu(null);
          }}
        />

        <MenuDivider />

        <DesktopMenuItem
          icon={<MoreHorizontal size={14} />}
          label="Show more options"
          onClick={() => alert("AOS (A School OS) 2026.1 System Information")}
        />
      </>
    );

  // ── Folder dialogs (win11-dialog pattern) ─────────────────────────────────
  const renderNameHelper = (name: string) => {
    if (name.trim().length === 0) {
      return (
        <div style={{ fontSize: 11, marginTop: 6, color: "var(--w11-text-secondary)" }}>
          Enter a name for this folder.
        </div>
      );
    }
    if (nameError) {
      return (
        <div style={{ fontSize: 11, marginTop: 6, color: "#c42b1c" }}>{nameError}</div>
      );
    }
    return (
      <div
        style={{
          fontSize: 11,
          marginTop: 6,
          color: "var(--w11-text-secondary)",
          textAlign: "right",
        }}
      >
        {name.trim().length}/{FOLDER_NAME_MAX_LENGTH}
      </div>
    );
  };

  const renderDialog = () => {
    if (!dialog || (dialog.type !== "newFolder" && !dialogFolder)) return null;

    return (
      <div
        className="win11-modal-backdrop"
        onClick={() => setDialog(null)}
      >
        <div
          className="win11-dialog"
          style={{ width: "420px", maxWidth: "92vw" }}
          onClick={(e) => e.stopPropagation()}
        >
          {dialog.type === "rename" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <PenLine size={18} style={{ color: "var(--w11-accent)" }} />
                <span>Rename Folder</span>
              </div>
              <div className="dialog-body">
                <input
                  autoFocus
                  type="text"
                  value={dialog.name}
                  maxLength={FOLDER_NAME_MAX_LENGTH}
                  placeholder="Folder name"
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                  }}
                  style={dialogInputStyle}
                />
                {renderNameHelper(dialog.name)}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", ...(nameError ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                  disabled={!!nameError}
                  onClick={submitRename}
                >
                  Save
                </button>
              </div>
            </>
          )}

          {dialog.type === "remove" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FolderMinus size={18} style={{ color: "#c42b1c" }} />
                <span>Remove Folder?</span>
              </div>
              <div className="dialog-body">
                Remove &ldquo;{dialogFolder.name}&rdquo;? Its {dialogFolder.apps.length}{" "}
                {dialogFolder.apps.length === 1 ? "app" : "apps"} will return to the
                desktop. This does not uninstall anything.
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", background: "#c42b1c" }}
                  onClick={submitRemoveFolder}
                >
                  Remove Folder
                </button>
              </div>
            </>
          )}

          {dialog.type === "addApps" && dialogFolder && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <ListPlus size={18} style={{ color: "var(--w11-accent)" }} />
                <span>Add Apps to {dialogFolder.name}</span>
              </div>
              <div className="dialog-body">
                {looseAppsForDialog.length === 0 ? (
                  <div style={{ color: "var(--w11-text-secondary)" }}>
                    Every app is already in a folder.
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "240px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    {looseAppsForDialog.map((app) => {
                      const checked = dialog.selected.includes(app.id);
                      return (
                        <label
                          key={app.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: checked
                              ? "var(--w11-accent-light, rgba(0, 120, 212, 0.12))"
                              : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setDialog({
                                ...dialog,
                                selected: checked
                                  ? dialog.selected.filter((id) => id !== app.id)
                                  : [...dialog.selected, app.id],
                              })
                            }
                            style={{ width: 16, height: 16, accentColor: "var(--w11-accent)" }}
                          />
                          {app.icon}
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--w11-text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {app.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{
                    fontSize: "12px",
                    ...(dialog.selected.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}
                  disabled={dialog.selected.length === 0}
                  onClick={submitAddApps}
                >
                  Add {dialog.selected.length > 0 ? `(${dialog.selected.length})` : ""}
                </button>
              </div>
            </>
          )}

          {dialog.type === "newFolder" && (
            <>
              <div
                className="dialog-header"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FolderPlus size={18} style={{ color: "var(--w11-accent)" }} />
                <span>New Folder</span>
              </div>
              <div className="dialog-body">
                <div style={{ marginBottom: "10px", color: "var(--w11-text-secondary)" }}>
                  &ldquo;{desktopIcons.find((a) => a.id === dialog.appId)?.name ?? dialog.appId}
                  &rdquo; will be added to the new folder.
                </div>
                <input
                  autoFocus
                  type="text"
                  value={dialog.name}
                  maxLength={FOLDER_NAME_MAX_LENGTH}
                  placeholder="Folder name"
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewFolder();
                  }}
                  style={dialogInputStyle}
                />
                {renderNameHelper(dialog.name)}
              </div>
              <div className="dialog-footer">
                <button className="subtle" style={{ fontSize: "12px" }} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="accent"
                  style={{ fontSize: "12px", ...(nameError ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                  disabled={!!nameError}
                  onClick={submitNewFolder}
                >
                  Create Folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
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
        {/* Folder icons render first, before loose apps */}
        {folderMode &&
          (resolvedFolders ?? []).map((folder) => (
            <DesktopIconTile
              key={folder.id}
              selected={selectedIcon === folder.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIcon(folder.id);
                setContextMenu(null);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openFolderPopupFromIcon(folder, e);
              }}
              onContextMenu={(e) => openContextMenu(e, { kind: "folder", folderId: folder.id })}
              icon={<FolderTile name={folder.name} />}
              label={folder.name}
            />
          ))}

        {desktopIcons.map((item) => {
          const isSelected = selectedIcon === item.id;
          return (
            <DesktopIconTile
              key={item.id}
              selected={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIcon(item.id);
                setContextMenu(null);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (item.id === "recycle_bin") {
                  alert("Academic Archive is clean.");
                } else {
                  onOpenApp(item.id);
                }
              }}
              onContextMenu={(e) => {
                // Loose apps get their own menu in folder mode; the recycle
                // bin and the classic desktop keep the background menu.
                if (item.id === "recycle_bin" || !folderMode) return;
                openContextMenu(e, { kind: "app", appId: item.id });
              }}
              icon={item.icon}
              label={item.name}
            />
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

      {/* Folder popup — acrylic panel listing the folder's apps.
          Stays open until the backdrop is clicked. */}
      {folderPopup && popupFolder && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10010 }}
            onClick={() => setFolderPopup(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderPopup(null);
            }}
          />
          <div
            style={{
              position: "fixed",
              left: `${folderPopup.left}px`,
              top: `${folderPopup.top}px`,
              width: "300px",
              maxWidth: "340px",
              ...acrylicSurfaceStyle,
              borderRadius: "12px",
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.4)",
              padding: "10px",
              zIndex: 10020,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "2px 6px 10px",
                borderBottom: "1px solid var(--w11-control-border, rgba(255,255,255,0.08))",
                marginBottom: "6px",
              }}
            >
              <FolderTile name={popupFolder.name} size={28} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{popupFolder.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: "var(--w11-text-secondary, rgba(255,255,255,0.65))",
                }}
              >
                {popupFolder.apps.length} {popupFolder.apps.length === 1 ? "app" : "apps"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: "360px",
                overflowY: "auto",
              }}
            >
              {popupFolder.apps.map((app) => (
                <div
                  key={app.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp(app.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--w11-control-hover, rgba(255,255,255,0.08))")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {app.icon}
                  <span
                    style={{
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {app.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Desktop Context Menus */}
      {contextMenu?.target.kind === "desktop" && renderDesktopMenu()}
      {contextMenu?.target.kind === "folder" && renderFolderMenu(contextMenu.target.folderId)}
      {contextMenu?.target.kind === "app" && renderAppMenu(contextMenu.target.appId)}

      {/* Folder management dialogs */}
      {renderDialog()}
    </div>
  );
}
