"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Upload,
  Image as ImageIcon,
  FileText,
  FileCode,
  Archive,
  Folder,
  Cloud,
  ChevronRight,
  Loader2,
  Music,
  CheckCircle2,
  X,
  XCircle,
  FolderOpen,
} from "lucide-react";
import {
  listFiles,
  listFolders,
  uploadFilesToFolder,
  type FileFolder,
  type ManagedFile,
  type FileType,
} from "@/lib/services/files.service";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the selected file(s) when user confirms */
  onSelect: (files: ManagedFile[]) => void;
  /** Allow selecting multiple files (default: false) */
  multiple?: boolean;
  /** Restrict to a specific file type */
  fileType?: FileType | "";
  /** Pre-selected file IDs */
  preselectedIds?: string[];
  title?: string;
}

// ── Helpers (from the AOS FileManagerApp design language) ─────────────────

type IconKind = "pdf" | "code" | "image" | "archive" | "doc";

interface PathSegment {
  id: string | null;
  name: string;
}

interface UploadQueueItem {
  key: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "cpp", "cc", "c", "h", "java", "cs", "rb",
  "go", "rs", "php", "swift", "kt", "sh", "bash", "sql", "html", "css", "json",
  "xml", "yml", "yaml", "csv", "toml",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz",
]);

const TYPE_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "image" as const, label: "Images" },
  { value: "document" as const, label: "Docs" },
  { value: "video" as const, label: "Videos" },
  { value: "audio" as const, label: "Audio" },
  { value: "spreadsheet" as const, label: "Sheets" },
];

function fileIconKind(file: ManagedFile): IconKind {
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

function renderFileIcon(type: IconKind, size = 32) {
  switch (type) {
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
}

function formatBytes(bytes: number): string {
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

function apiErrorDescription(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || (err instanceof Error && err.message) || fallback
  );
}

// ── File Tile (110px grid card, FileManagerApp style) ──────────────────────

function FileTile({
  file,
  selected,
  multiple,
  onClick,
  onDoubleClick,
}: {
  file: ManagedFile;
  selected: boolean;
  multiple: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const showImage =
    file.file_type === "image" && file.url && !imgError;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={file.original_name}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "10px 6px",
        borderRadius: "8px",
        cursor: "pointer",
        position: "relative",
        background: selected ? "var(--w11-accent-light)" : "transparent",
        border: selected
          ? "1px solid var(--w11-accent)"
          : "1px solid transparent",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--w11-control-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Selection badge — checkbox in multiple mode, radio dot in single mode */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "18px",
            height: "18px",
            borderRadius: multiple ? "4px" : "50%",
            background: "var(--w11-accent)",
            color: "var(--w11-accent-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Preview area */}
      <div
        style={{
          width: "72px",
          height: "72px",
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          overflow: "hidden",
          background: "var(--w11-control-bg)",
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.original_name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        ) : (
          renderFileIcon(fileIconKind(file), 36)
        )}
      </div>
      <span
        style={{
          fontSize: "11px",
          textAlign: "center",
          wordBreak: "break-word",
          color: "var(--w11-text-primary)",
          lineHeight: 1.25,
        }}
      >
        {file.original_name}
      </span>
      <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
        {formatBytes(file.size_bytes)}
      </span>
    </div>
  );
}

// ── File Picker Dialog (AOS file-manager experience) ───────────────────────

export function FilePicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  fileType = "",
  preselectedIds = [],
  title = "Select File",
}: FilePickerProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileType | "all">(
    fileType || "all",
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<PathSegment[]>([
    { id: null, name: "My Vault" },
  ]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(preselectedIds),
  );
  const [dragOver, setDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset transient navigation state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(preselectedIds));
      setCurrentFolderId(null);
      setPath([{ id: null, name: "My Vault" }]);
      setSearchInput("");
      setSearchQuery("");
      setTypeFilter(fileType || "all");
      setUploadQueue([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Queries ────────────────────────────────────────────────────────────

  const rootFoldersQuery = useQuery({
    queryKey: ["file-picker", "folders", null],
    queryFn: () => listFolders(null),
    enabled: open,
  });

  const foldersQuery = useQuery({
    queryKey: ["file-picker", "folders", currentFolderId],
    queryFn: () => listFolders(currentFolderId),
    enabled: open,
  });

  const filesQuery = useQuery({
    queryKey: [
      "file-picker",
      "files",
      currentFolderId,
      searchQuery,
      typeFilter,
    ],
    queryFn: () =>
      listFiles({
        folder_id: currentFolderId,
        search: searchQuery || undefined,
        type: typeFilter === "all" ? undefined : typeFilter,
        per_page: 200,
      }),
    enabled: open,
  });

  const files = useMemo(
    () => filesQuery.data?.items ?? [],
    [filesQuery.data],
  );
  const folders = foldersQuery.data ?? [];

  const overallUploadProgress =
    uploadQueue.length > 0
      ? Math.round(
          uploadQueue.reduce(
            (acc, q) => acc + (q.status === "uploading" ? q.progress : 100),
            0,
          ) / uploadQueue.length,
        )
      : 0;

  // ── Upload mutation (into the CURRENT folder, with progress) ────────────

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      const initial: UploadQueueItem[] = filesToUpload.map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        progress: 0,
        status: "uploading" as const,
      }));
      setUploadQueue(initial);

      const uploaded: ManagedFile[] = [];
      for (let i = 0; i < filesToUpload.length; i++) {
        const key = initial[i].key;
        try {
          const result = await uploadFilesToFolder(
            [filesToUpload[i]],
            currentFolderId,
            (pct) =>
              setUploadQueue((q) =>
                q.map((it) => (it.key === key ? { ...it, progress: pct } : it)),
              ),
          );
          setUploadQueue((q) =>
            q.map((it) =>
              it.key === key ? { ...it, status: "done" as const, progress: 100 } : it,
            ),
          );
          uploaded.push(...result);
        } catch (err) {
          setUploadQueue((q) =>
            q.map((it) =>
              it.key === key
                ? {
                    ...it,
                    status: "error" as const,
                    error: apiErrorDescription(err, "Upload failed"),
                  }
                : it,
            ),
          );
        }
      }
      if (uploaded.length === 0) throw new Error("All uploads failed");
      return uploaded;
    },
    onSuccess: (uploaded) => {
      toast.success(`${uploaded.length} file(s) uploaded`);
      queryClient.invalidateQueries({ queryKey: ["file-picker"] });
      queryClient.invalidateQueries({ queryKey: ["managed-files"] });
      queryClient.invalidateQueries({ queryKey: ["file-usage"] });
      queryClient.invalidateQueries({ queryKey: ["aos-files"] });
      queryClient.invalidateQueries({ queryKey: ["aos-folders"] });
      // Auto-select newly uploaded files
      setSelectedIds((prev) => {
        const next = multiple ? new Set(prev) : new Set<string>();
        uploaded.forEach((f) => next.add(f.id));
        return next;
      });
      // Let the user see the per-file outcome briefly, then clear the queue.
      window.setTimeout(
        () =>
          setUploadQueue((q) =>
            q.every((i) => i.status !== "uploading") ? [] : q,
          ),
        2500,
      );
    },
    onError: (err: unknown) => {
      toast.error(apiErrorDescription(err, "Upload failed"));
    },
  });

  // ── Selection & navigation handlers ────────────────────────────────────

  const toggleFile = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (multiple) {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        return prev.has(id) ? new Set<string>() : new Set([id]);
      });
    },
    [multiple],
  );

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedIds.has(f.id)),
    [files, selectedIds],
  );

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    onSelect(selectedFiles);
    onOpenChange(false);
  };

  /** Single mode: double-click confirms instantly with that file. */
  const handleFileDoubleClick = (file: ManagedFile) => {
    if (!multiple) {
      onSelect([file]);
      onOpenChange(false);
    }
  };

  const navigateToFolder = (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    if (folderId === null) {
      setPath([{ id: null, name: "My Vault" }]);
    } else if (folderName) {
      setPath([{ id: null, name: "My Vault" }, { id: folderId, name: folderName }]);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = path[index];
    if (!target) return;
    setPath(path.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const startUpload = (filesToUpload: File[]) => {
    if (filesToUpload.length > 0 && !uploadMutation.isPending) {
      uploadMutation.mutate(filesToUpload);
    }
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startUpload(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragOver(false);
    startUpload(Array.from(e.dataTransfer.files ?? []));
  };

  const acceptAttr =
    typeFilter === "image"
      ? "image/*"
      : typeFilter === "video"
        ? "video/*"
        : typeFilter === "audio"
          ? "audio/*"
          : typeFilter === "document"
            ? ".pdf,.doc,.docx,.txt"
            : typeFilter === "spreadsheet"
              ? ".xls,.xlsx,.csv"
              : fileType === "image"
                ? "image/*"
                : undefined;

  const isLoading = filesQuery.isPending || foldersQuery.isPending;
  const activeFolderName = path[path.length - 1]?.name ?? "My Vault";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[880px] max-h-[90vh] w-[94vw] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Hidden native input — allowed here, this IS the file manager */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUploadChange}
          accept={acceptAttr}
        />

        <DialogHeader className="px-4 pt-4 pb-2 border-b" style={{ borderColor: "var(--w11-border-subtle)" }}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" style={{ color: "#f59e0b" }} />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Body: mini sidebar + content area */}
        <div className="flex flex-1 min-h-0">
          {/* Left mini-sidebar (folder tree) */}
          <div
            className="hidden sm:flex flex-col shrink-0"
            style={{
              width: "160px",
              background: "var(--w11-control-bg)",
              borderRight: "1px solid var(--w11-border-subtle)",
              padding: "10px 8px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--w11-text-secondary)",
                textTransform: "uppercase",
                padding: "0 8px 6px",
              }}
            >
              Folders
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <button
                onClick={() => navigateToFolder(null)}
                className={currentFolderId === null ? "accent" : "subtle"}
                style={{
                  justifyContent: "flex-start",
                  gap: "6px",
                  fontSize: "11px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                }}
              >
                <Cloud size={14} color="#0284c7" /> My Vault
              </button>
              {(rootFoldersQuery.data ?? []).map((folder: FileFolder) => {
                const isExpanded = expandedFolders.has(folder.id);
                return (
                  <div key={folder.id}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <button
                        className="subtle"
                        onClick={() => toggleExpanded(folder.id)}
                        title={isExpanded ? "Collapse" : "Expand"}
                        style={{
                          padding: "2px 3px",
                          fontSize: "10px",
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        <ChevronRight
                          size={11}
                          style={{
                            transform: isExpanded ? "rotate(90deg)" : "none",
                            transition: "transform 0.12s ease",
                          }}
                        />
                      </button>
                      <button
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        className={currentFolderId === folder.id ? "accent" : "subtle"}
                        style={{
                          justifyContent: "flex-start",
                          gap: "6px",
                          fontSize: "11px",
                          padding: "5px 8px 5px 4px",
                          borderRadius: "6px",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <Folder size={14} color="#38bdf8" />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {folder.name}
                        </span>
                      </button>
                    </div>
                    {isExpanded && (
                      <SubFolderList
                        parentId={folder.id}
                        currentFolderId={currentFolderId}
                        onNavigate={navigateToFolder}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar: breadcrumb + search + pills + upload */}
            <div
              className="px-3 py-2 border-b flex items-center gap-2 flex-wrap"
              style={{ borderColor: "var(--w11-border-subtle)" }}
            >
              {/* Breadcrumb path bar */}
              <div
                className="flex items-center gap-1 order-1 basis-full"
                style={{
                  background: "var(--w11-control-bg)",
                  border: "1px solid var(--w11-control-border)",
                  borderRadius: "6px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  overflowX: "auto",
                }}
              >
                {path.map((seg, idx) => (
                  <React.Fragment key={`${seg.id ?? "root"}-${idx}`}>
                    {idx > 0 && (
                      <ChevronRight size={11} color="var(--w11-text-secondary)" />
                    )}
                    <span
                      onClick={() => navigateToBreadcrumb(idx)}
                      style={{
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        color:
                          idx === path.length - 1
                            ? "var(--w11-text-primary)"
                            : "var(--w11-accent)",
                        fontWeight: idx === path.length - 1 ? 600 : 400,
                      }}
                    >
                      {seg.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[140px] order-2">
                <Search
                  className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
                  style={{ color: "var(--w11-text-secondary)" }}
                />
                <Input
                  placeholder="Search files…"
                  className="pl-7 h-7 text-xs"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              {/* Type filter pills (hidden when fileType prop locks the type) */}
              {!fileType && (
                <div className="flex items-center gap-1 order-3">
                  {TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      className={typeFilter === f.value ? "accent" : "subtle"}
                      onClick={() => setTypeFilter(f.value)}
                      style={{
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        lineHeight: 1.5,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <button
                className="accent"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                style={{
                  fontSize: "11px",
                  padding: "3px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  order: 4,
                }}
              >
                {uploadMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                Upload
              </button>
            </div>

            {/* Thin upload progress strip */}
            {uploadMutation.isPending && (
              <div style={{ height: "3px", background: "var(--w11-control-hover)" }}>
                <div
                  style={{
                    width: `${overallUploadProgress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            )}

            {/* File grid (drag-and-drop target) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                flex: 1,
                minHeight: "280px",
                maxHeight: "380px",
                overflowY: "auto",
                padding: "12px",
                outline: dragOver ? "2px dashed var(--w11-accent)" : "none",
                outlineOffset: -4,
                background: dragOver ? "var(--w11-accent-light)" : undefined,
                transition: "background 0.15s ease",
              }}
            >
              {dragOver && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "8px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    border: "1px dashed var(--w11-accent)",
                    color: "var(--w11-accent)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  <Upload size={14} /> Drop files here to upload to{" "}
                  {activeFolderName}
                </div>
              )}

              {isLoading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: "10px",
                    color: "var(--w11-text-secondary)",
                    fontSize: "12px",
                  }}
                >
                  <div className="win11-spinner sm" /> Loading files…
                </div>
              ) : folders.length > 0 && typeFilter === "all" && !searchQuery ? (
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--w11-text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Folders
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
                        title={folder.name}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "10px 8px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border: "1px solid transparent",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--w11-control-hover)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <div style={{ marginBottom: "6px" }}>
                          <Folder size={36} color="#0284c7" fill="#38bdf8" fillOpacity={0.3} />
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            textAlign: "center",
                            wordBreak: "break-word",
                            color: "var(--w11-text-primary)",
                            lineHeight: 1.25,
                          }}
                        >
                          {folder.name}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--w11-text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          {folder.file_count} item{folder.file_count === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isLoading && (
                <>
                  {folders.length > 0 && typeFilter === "all" && !searchQuery && (
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "var(--w11-text-secondary)",
                        margin: "0 0 6px",
                      }}
                    >
                      Files
                    </div>
                  )}
                  {files.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "32px 0",
                        gap: "8px",
                        color: "var(--w11-text-secondary)",
                        fontSize: "12px",
                      }}
                    >
                      <FolderOpen size={36} strokeWidth={1.25} color="var(--w11-text-tertiary)" />
                      {searchQuery || typeFilter !== "all"
                        ? "No matching files — try a different filter."
                        : "This folder is empty."}
                      <button
                        className="accent"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          fontSize: "11px",
                          padding: "3px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Upload size={12} /> Upload to this folder
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {files.map((file) => (
                        <FileTile
                          key={file.id}
                          file={file}
                          selected={selectedIds.has(file.id)}
                          multiple={multiple}
                          onClick={() => toggleFile(file.id)}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Upload queue (per-file progress) */}
            {uploadQueue.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid var(--w11-border-subtle)",
                  background: "var(--w11-surface)",
                  padding: "6px 12px",
                  maxHeight: "110px",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--w11-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "4px",
                  }}
                >
                  {uploadMutation.isPending ? "Uploading" : "Upload results"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {uploadQueue.map((q) => (
                    <div
                      key={q.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "11px",
                      }}
                    >
                      {q.status === "uploading" ? (
                        <Loader2 size={12} className="animate-spin" color="var(--w11-accent)" />
                      ) : q.status === "done" ? (
                        <CheckCircle2 size={12} color="#0f7b0f" />
                      ) : (
                        <XCircle size={12} color="#c42b1c" />
                      )}
                      <span
                        title={q.error ?? q.name}
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--w11-text-primary)",
                        }}
                      >
                        {q.name}
                      </span>
                      <div
                        style={{
                          width: "100px",
                          height: "4px",
                          borderRadius: "2px",
                          background: "var(--w11-control-hover)",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: `${q.status === "uploading" ? q.progress : 100}%`,
                            height: "100%",
                            background:
                              q.status === "error"
                                ? "#c42b1c"
                                : "linear-gradient(90deg, #0284c7, #38bdf8)",
                            transition: "width 0.2s ease",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          width: "42px",
                          textAlign: "right",
                          color: "var(--w11-text-secondary)",
                          flexShrink: 0,
                        }}
                      >
                        {q.status === "done"
                          ? "Done"
                          : q.status === "error"
                            ? "Failed"
                            : `${q.progress}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selection footer strip */}
        <div
          className="border-t px-4 py-2.5 flex items-center gap-3"
          style={{ borderColor: "var(--w11-border-subtle)" }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
            {selectedFiles.length === 0 ? (
              <span
                className="text-xs"
                style={{ color: "var(--w11-text-secondary)" }}
              >
                {multiple
                  ? "Select one or more files from your vault"
                  : "Select a file from your vault"}
              </span>
            ) : (
              selectedFiles.map((f) => (
                <div
                  key={f.id}
                  title={f.original_name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "var(--w11-accent-light)",
                    border: "1px solid var(--w11-accent)",
                    fontSize: "11px",
                    color: "var(--w11-text-primary)",
                    flexShrink: 0,
                    maxWidth: "180px",
                  }}
                >
                  {/* Small preview: image thumb or type icon */}
                  {f.file_type === "image" && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={f.original_name}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "3px",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    renderFileIcon(fileIconKind(f), 14)
                  )}
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.original_name}
                  </span>
                  <button
                    className="subtle"
                    onClick={() => toggleFile(f.id)}
                    title="Remove"
                    style={{ padding: "1px 3px", display: "flex", flexShrink: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div
            className="text-xs shrink-0"
            style={{ color: "var(--w11-text-secondary)" }}
          >
            {selectedIds.size} selected
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            {multiple
              ? `Confirm ${selectedIds.size > 0 ? `${selectedIds.size} ` : ""}File${selectedIds.size === 1 ? "" : "s"}`
              : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-folder list (one level deep inside the sidebar tree) ───────────────

function SubFolderList({
  parentId,
  currentFolderId,
  onNavigate,
}: {
  parentId: string;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null, folderName?: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["file-picker", "folders", parentId],
    queryFn: () => listFolders(parentId),
  });
  if (!data || data.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "10px" }}>
      {data.map((sub) => (
        <button
          key={sub.id}
          onClick={() => onNavigate(sub.id, sub.name)}
          className={currentFolderId === sub.id ? "accent" : "subtle"}
          style={{
            justifyContent: "flex-start",
            gap: "6px",
            fontSize: "11px",
            padding: "4px 8px",
            borderRadius: "6px",
            minWidth: 0,
          }}
          title={sub.name}
        >
          <Folder size={13} color="#38bdf8" />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.name}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Convenience hook — one-line integration for any page ───────────────────

export interface UseAOSFilePickerOptions {
  /** Allow selecting multiple files (default: false) */
  multiple?: boolean;
  /** Restrict to a specific file type */
  fileType?: FileType | "";
  /** Dialog title */
  title?: string;
  /** Called with the selected file(s) when the user confirms */
  onSelect: (files: ManagedFile[]) => void;
}

/**
 * Mount-free file picking:
 *
 *   const { openPicker, picker } = useAOSFilePicker({
 *     fileType: "image",
 *     onSelect: (files) => setAvatar(files[0]),
 *   });
 *   <button onClick={openPicker}>Browse Vault</button>
 *   {picker}
 */
export function useAOSFilePicker({
  multiple = false,
  fileType = "",
  title,
  onSelect,
}: UseAOSFilePickerOptions) {
  const [open, setOpen] = useState(false);
  const openPicker = useCallback(() => setOpen(true), []);

  const picker = (
    <FilePicker
      open={open}
      onOpenChange={setOpen}
      onSelect={onSelect}
      multiple={multiple}
      fileType={fileType}
      title={title}
    />
  );

  return { openPicker, picker, isOpen: open };
}
