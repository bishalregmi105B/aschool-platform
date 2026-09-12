"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Folder,
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Download,
  Upload,
  Plus,
  Search,
  Grid,
  List,
  Cloud,
  ChevronRight,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  getPresignedUrl,
  getStorageUsage,
  listFiles,
  listFolders,
  uploadFilesToFolder,
} from "@/lib/services/files.service";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ── Types ──────────────────────────────────────────────────────────────────

type IconKind = "folder" | "pdf" | "code" | "image" | "archive" | "doc";

interface PathSegment {
  id: string | null;
  name: string;
}

interface DisplayItem {
  id: string;
  kind: "folder" | "file";
  name: string;
  iconType: IconKind;
  sizeBytes: number | null;
  fileCount?: number;
  typeLabel: string;
  modified: string | null;
  url?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROOT_PATH: PathSegment[] = [{ id: null, name: "Academic Cloud Vault" }];

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "cpp", "cc", "c", "h", "java", "cs", "rb",
  "go", "rs", "php", "swift", "kt", "sh", "bash", "sql", "html", "css", "json",
  "xml", "yml", "yaml", "csv", "toml",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz",
]);

function fileIconKind(file: {
  extension?: string | null;
  mime_type?: string | null;
  file_type?: string | null;
}): IconKind {
  const ext = (file.extension ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archive";
  if (
    file.file_type === "image" ||
    (file.mime_type ?? "").startsWith("image/")
  ) {
    return "image";
  }
  return "doc";
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy, h:mm a");
  } catch {
    return "—";
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FileManagerApp() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<PathSegment[]>(ROOT_PATH);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<DisplayItem | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const rootFoldersQuery = useQuery({
    queryKey: ["aos-folders", null],
    queryFn: () => listFolders(null),
  });

  const foldersQuery = useQuery({
    queryKey: ["aos-folders", currentFolderId],
    queryFn: () => listFolders(currentFolderId),
  });

  const filesQuery = useQuery({
    queryKey: ["aos-files", currentFolderId, searchQuery],
    queryFn: () =>
      listFiles({
        folder_id: currentFolderId,
        search: searchQuery || undefined,
        per_page: 500,
      }),
  });

  const usageQuery = useQuery({
    queryKey: ["aos-files", "usage"],
    queryFn: getStorageUsage,
  });

  // ── Derived items (folders first, then files, name asc — client-side) ────

  const displayedItems = useMemo<DisplayItem[]>(() => {
    const folderItems: DisplayItem[] = (foldersQuery.data ?? []).map((f) => ({
      id: f.id,
      kind: "folder",
      name: f.name,
      iconType: "folder",
      sizeBytes: null,
      fileCount: f.file_count,
      typeLabel: "File folder",
      modified: f.created_at,
    }));
    const fileItems: DisplayItem[] = (filesQuery.data?.items ?? []).map((f) => ({
      id: f.id,
      kind: "file",
      name: f.original_name,
      iconType: fileIconKind(f),
      sizeBytes: f.size_bytes,
      typeLabel: (f.extension ?? f.file_type ?? "file").toUpperCase(),
      modified: f.created_at,
      url: f.url,
    }));
    return [...folderItems, ...fileItems].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [foldersQuery.data, filesQuery.data]);

  const isLoading = foldersQuery.isLoading || filesQuery.isLoading;

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["aos-files"] });
    queryClient.invalidateQueries({ queryKey: ["aos-folders"] });
  };

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(name, currentFolderId),
    onSuccess: (folder, name) => {
      toast.success(`Folder "${name}" created`);
      setShowNewFolderDialog(false);
      setNewFolderName("");
      queryClient.invalidateQueries({ queryKey: ["aos-folders"] });
    },
    onError: (err) => {
      toast.error("Couldn't create folder", {
        description:
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "Please try again.",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ files }: { files: File[] }) =>
      uploadFilesToFolder(files, currentFolderId, (pct) =>
        setUploadProgress(pct),
      ),
    onSuccess: (uploaded) => {
      toast.success(
        `Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`,
      );
      invalidateAll();
    },
    onError: (err) => {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
    onSettled: () => setUploadProgress(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: DisplayItem) =>
      item.kind === "folder" ? deleteFolder(item.id) : deleteFile(item.id),
    onSuccess: (_result, item) => {
      toast.success(`Deleted "${item.name}"`);
      setSelectedItem(null);
      invalidateAll();
    },
    onError: (err) => {
      toast.error("Couldn't delete", {
        description:
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "Please try again.",
      });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const navigateToFolder = (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    setSelectedItem(null);
    setIsMobileSidebarOpen(false);
    if (folderId === null) {
      setPath(ROOT_PATH);
    } else if (folderName) {
      setPath([...ROOT_PATH, { id: folderId, name: folderName }]);
    }
  };

  const openItem = (item: DisplayItem) => {
    if (item.kind === "folder") {
      setPath((prev) => [...prev, { id: item.id, name: item.name }]);
      setCurrentFolderId(item.id);
      setSelectedItem(null);
      setIsMobileSidebarOpen(false);
    } else {
      setSelectedItem(item);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = path[index];
    if (!target) return;
    setPath(path.slice(0, index + 1));
    setCurrentFolderId(target.id);
    setSelectedItem(null);
  };

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name || createFolderMutation.isPending) return;
    createFolderMutation.mutate(name);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadMutation.mutate({ files });
    e.target.value = "";
  };

  const handleDownload = async (item: DisplayItem) => {
    if (!item.url) {
      try {
        const url = await getPresignedUrl(item.id);
        window.open(url, "_blank");
      } catch {
        toast.error("Couldn't get download link");
      }
      return;
    }
    window.open(item.url, "_blank");
  };

  const handleShare = async (item: DisplayItem) => {
    const link = item.url;
    if (!link) {
      toast.error("No shareable link for this file");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Link copied — share "${item.name}" with classmates.`);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleDelete = async (item: DisplayItem) => {
    const ok = await confirm({
      title: `Delete ${item.kind === "folder" ? "folder" : "file"}?`,
      body:
        item.kind === "folder"
          ? `"${item.name}" and everything inside it will be permanently deleted. This cannot be undone.`
          : `"${item.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(item);
  };

  // ── Icon renderer (reference color coding) ───────────────────────────────

  const getFileIcon = (type: IconKind, size = 32) => {
    switch (type) {
      case "folder":
        return <Folder size={size} color="#0284c7" fill="#38bdf8" fillOpacity={0.3} />;
      case "pdf":
        return <FileText size={size} color="#ef4444" />;
      case "code":
        return <FileCode size={size} color="#10b981" />;
      case "image":
        return <ImageIcon size={size} color="#8b5cf6" />;
      case "archive":
        return <Archive size={size} color="#f59e0b" />;
      default:
        return <FileText size={size} color="#0078d4" />;
    }
  };

  const usage = usageQuery.data;
  const usagePct = usage && usage.total_bytes > 0 ? 100 : 0;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--w11-window-bg)", userSelect: "none", position: "relative" }}>
      {/* Hidden real file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleUploadChange}
      />

      {/* Left Sidebar */}
      <div
        className={isMobileSidebarOpen ? "filemanager-sidebar-open" : "filemanager-sidebar"}
        style={{
          width: "210px",
          background: "var(--w11-control-bg)",
          borderRight: "1px solid var(--w11-border-subtle)",
          padding: "14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--w11-text-secondary)", textTransform: "uppercase", padding: "0 8px 6px" }}>
            Campus Cloud Storage
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <button
              onClick={() => navigateToFolder(null)}
              className={currentFolderId === null ? "accent" : "subtle"}
              style={{
                justifyContent: "flex-start",
                gap: "8px",
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "6px",
              }}
            >
              <Cloud size={15} color="#0284c7" /> My Vault
            </button>
            {(rootFoldersQuery.data ?? []).map((folder) => (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className={currentFolderId === folder.id ? "accent" : "subtle"}
                style={{
                  justifyContent: "flex-start",
                  gap: "8px",
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                }}
              >
                <Folder size={15} color="#38bdf8" /> {folder.name}
              </button>
            ))}
          </div>
        </div>

        {/* Quota Indicator */}
        <div style={{ marginTop: "auto", padding: "10px", borderRadius: "8px", background: "var(--w11-control-hover)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 600, color: "var(--w11-text-primary)", marginBottom: "4px" }}>
            <span>Storage Usage</span>
            <span>{usage ? `${formatBytes(usage.total_bytes)} used` : "—"}</span>
          </div>
          <div style={{ width: "100%", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
            <div style={{ width: `${usagePct}%`, height: "100%", background: "linear-gradient(90deg, #0284c7, #38bdf8)" }} />
          </div>
          <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)", marginTop: "4px" }}>
            {usage ? `${usage.total_files} file${usage.total_files === 1 ? "" : "s"} • High Speed Academic SSD` : "High Speed Academic SSD"}
          </div>
        </div>
      </div>

      {/* Main File Browser Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Navigation Toolbar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--w11-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "var(--w11-surface)",
          }}
        >
          {/* Folder Drawer Toggle */}
          <button
            className="subtle"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            style={{ padding: "4px 8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
            title="Toggle Sidebar Storage"
          >
            <Folder size={15} />
          </button>

          {/* Breadcrumb Path Bar */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "var(--w11-control-bg)",
              border: "1px solid var(--w11-control-border)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              overflowX: "auto",
            }}
          >
            {path.map((seg, idx) => (
              <React.Fragment key={`${seg.id ?? "root"}-${idx}`}>
                {idx > 0 && <ChevronRight size={13} color="var(--w11-text-secondary)" />}
                <span
                  onClick={() => navigateToBreadcrumb(idx)}
                  style={{
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    color: idx === path.length - 1 ? "var(--w11-text-primary)" : "var(--w11-accent)",
                    fontWeight: idx === path.length - 1 ? 600 : 400,
                  }}
                >
                  {seg.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", width: "180px", flexShrink: 0 }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "var(--w11-text-secondary)" }} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 10px 4px 28px",
                fontSize: "11px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                border: "1px solid var(--w11-control-border)",
                color: "var(--w11-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              className="subtle"
              onClick={() => {
                setNewFolderName("");
                setShowNewFolderDialog(true);
              }}
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              <Plus size={14} /> New Folder
            </button>
            <button
              className="subtle"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
            </button>
            <button
              className="subtle"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              style={{ padding: "4px 8px" }}
              title="Toggle View"
            >
              {viewMode === "grid" ? <List size={15} /> : <Grid size={15} />}
            </button>
          </div>
        </div>

        {/* Upload progress */}
        {uploadMutation.isPending && uploadProgress !== null && (
          <div style={{ height: "3px", background: "var(--w11-control-hover)" }}>
            <div
              style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        )}

        {/* Files Display Container */}
        <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "8px" }}>
              <Loader2 size={28} className="animate-spin" color="var(--w11-text-tertiary)" />
              <div style={{ fontSize: "13px" }}>Loading your files...</div>
            </div>
          ) : displayedItems.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "8px" }}>
              <Folder size={48} strokeWidth={1} color="var(--w11-text-tertiary)" />
              <div style={{ fontSize: "13px" }}>
                {searchQuery ? `No results for "${searchQuery}"` : "This folder is empty"}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "12px" }}>
              {displayedItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    onDoubleClick={() => openItem(item)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "10px 8px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: isSelected ? "var(--w11-control-hover)" : "transparent",
                      border: isSelected ? "1px solid var(--w11-accent)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ marginBottom: "6px" }}>{getFileIcon(item.iconType, 38)}</div>
                    <span
                      style={{
                        fontSize: "11px",
                        textAlign: "center",
                        wordBreak: "break-word",
                        color: "var(--w11-text-primary)",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
                      {item.kind === "folder"
                        ? `${item.fileCount ?? 0} item${item.fileCount === 1 ? "" : "s"}`
                        : formatBytes(item.sizeBytes)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="win11-datagrid" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Date Modified</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    onDoubleClick={() => openItem(item)}
                    style={{ cursor: "pointer", background: selectedItem?.id === item.id ? "var(--w11-control-hover)" : undefined }}
                  >
                    <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {getFileIcon(item.iconType, 18)}
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </td>
                    <td style={{ textTransform: "uppercase", fontSize: "11px", color: "var(--w11-text-secondary)" }}>{item.typeLabel}</td>
                    <td>{item.kind === "folder" ? "—" : formatBytes(item.sizeBytes)}</td>
                    <td>{formatDate(item.modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected File Details / Quick Action Footer */}
        {selectedItem && (
          <div
            style={{
              padding: "8px 16px",
              background: "var(--w11-surface)",
              borderTop: "1px solid var(--w11-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {getFileIcon(selectedItem.iconType, 20)}
              <div>
                <span style={{ fontWeight: 600, color: "var(--w11-text-primary)" }}>{selectedItem.name}</span>
                <span style={{ color: "var(--w11-text-secondary)", marginLeft: "8px", fontSize: "11px" }}>
                  {selectedItem.kind === "folder"
                    ? `${selectedItem.fileCount ?? 0} item${selectedItem.fileCount === 1 ? "" : "s"}`
                    : formatBytes(selectedItem.sizeBytes)}{" "}
                  • Modified {formatDate(selectedItem.modified)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {selectedItem.kind === "file" && (
                <button
                  className="accent"
                  onClick={() => handleDownload(selectedItem)}
                  style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Download size={13} /> Download
                </button>
              )}
              {selectedItem.kind === "file" && (
                <button
                  className="subtle"
                  onClick={() => handleShare(selectedItem)}
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                >
                  <Share2 size={13} /> Share
                </button>
              )}
              <button
                className="subtle"
                onClick={() => handleDelete(selectedItem)}
                style={{ padding: "4px 8px", fontSize: "11px", color: "#c42b1c", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Folder Dialog (win11-dialog pattern) */}
      {showNewFolderDialog && (
        <div
          className="win11-modal-backdrop"
          onClick={() => {
            if (!createFolderMutation.isPending) setShowNewFolderDialog(false);
          }}
        >
          <div
            className="win11-dialog"
            style={{ background: "var(--w11-surface-solid)", padding: "20px", width: "90%", maxWidth: "360px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--w11-text-primary)", marginBottom: "4px" }}>
              Create Folder
            </div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "12px" }}>
              in {path[path.length - 1]?.name}
            </div>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              placeholder="New Project Folder"
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewFolder();
                if (e.key === "Escape" && !createFolderMutation.isPending) setShowNewFolderDialog(false);
              }}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                border: "1px solid var(--w11-control-border)",
                color: "var(--w11-text-primary)",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button
                className="subtle"
                onClick={() => setShowNewFolderDialog(false)}
                style={{ padding: "5px 14px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                className="accent"
                onClick={submitNewFolder}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                style={{ padding: "5px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {createFolderMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
