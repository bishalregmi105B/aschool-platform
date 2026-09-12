"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  X,
  Globe,
  ArrowUp,
  ArrowDown,
  Music,
  CheckCircle2,
  XCircle,
  ImagePlus,
} from "lucide-react";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  getPresignedUrl,
  getStorageUsage,
  listFiles,
  listFolders,
  renameFile,
  renameFolder,
  stockImport,
  stockSearch,
  uploadFilesToFolder,
  type FileType,
  type ManagedFile,
  type StockPhoto,
} from "@/lib/services/files.service";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { setVaultDragData } from "@/components/files/dnd";

// ── Types ──────────────────────────────────────────────────────────────────

type IconKind = "folder" | "pdf" | "code" | "image" | "archive" | "doc";
type SortKey = "name" | "date" | "size";
type SortDir = "asc" | "desc";

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
  managed?: ManagedFile;
}

interface UploadQueueItem {
  key: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ROOT_PATH: PathSegment[] = [{ id: null, name: "Academic Cloud Vault" }];

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "cpp", "cc", "c", "h", "java", "cs", "rb",
  "go", "rs", "php", "swift", "kt", "sh", "bash", "sql", "html", "css", "json",
  "xml", "yml", "yaml", "csv", "toml",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz",
]);

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "log", "ini", "cfg", "conf", "env", "rtf",
  ...CODE_EXTENSIONS,
]);

const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024; // 1 MB

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"];

// ── Helpers ────────────────────────────────────────────────────────────────

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

function isPdfFile(file: ManagedFile): boolean {
  return (
    (file.extension ?? "").toLowerCase() === "pdf" ||
    file.mime_type === "application/pdf"
  );
}

function isTextLike(file: ManagedFile): boolean {
  const mime = (file.mime_type ?? "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (
    ["application/json", "application/xml", "text/csv", "application/x-yaml", "application/toml"].includes(mime)
  ) {
    return true;
  }
  return TEXT_EXTENSIONS.has((file.extension ?? "").toLowerCase());
}

function apiErrorDescription(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error || (err instanceof Error && err.message) || fallback
  );
}

function displayFromFile(f: ManagedFile): DisplayItem {
  return {
    id: f.id,
    kind: "file",
    name: f.original_name,
    iconType: fileIconKind(f),
    sizeBytes: f.size_bytes,
    typeLabel: (f.extension ?? f.file_type ?? "file").toUpperCase(),
    modified: f.created_at,
    url: f.url,
    managed: f,
  };
}

// ── Icon renderer (reference color coding) ─────────────────────────────────

function renderFileIcon(type: IconKind, size = 32) {
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
}

// ── Preview sub-components ─────────────────────────────────────────────────

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{
    status: "loading" | "error" | "done";
    content?: string;
  }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (cancelled) return;
        setState({
          status: "done",
          content:
            t.length > 100_000 ? `${t.slice(0, 100_000)}\n… (truncated)` : t,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "24px" }}>
        <div className="win11-spinner sm" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div style={{ padding: "16px", fontSize: "11px", color: "var(--w11-text-secondary)", textAlign: "center" }}>
        Couldn&apos;t load the file contents.
      </div>
    );
  }
  return (
    <pre
      style={{
        margin: 0,
        padding: "12px",
        fontSize: "11px",
        lineHeight: 1.5,
        fontFamily: "var(--w11-font-mono)",
        background: "var(--w11-control-bg)",
        border: "1px solid var(--w11-border-subtle)",
        borderRadius: "8px",
        overflow: "auto",
        maxHeight: "420px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        userSelect: "text",
        color: "var(--w11-text-primary)",
      }}
    >
      {state.content}
    </pre>
  );
}

function GenericPreview({ file, note }: { file: ManagedFile; note?: string }) {
  return (
    <div
      style={{
        padding: "28px 16px",
        borderRadius: "8px",
        background: "var(--w11-control-bg)",
        border: "1px solid var(--w11-border-subtle)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        textAlign: "center",
      }}
    >
      {renderFileIcon(fileIconKind(file), 44)}
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--w11-text-primary)", wordBreak: "break-word" }}>
        {file.original_name}
      </div>
      <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
        {note ?? "No inline preview for this file type"}
      </div>
      <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
        {formatBytes(file.size_bytes)}
      </div>
    </div>
  );
}

/** Renders the right preview body for a file, by type. */
function FilePreviewBody({ file }: { file: ManagedFile }) {
  const url = file.url;
  if (!url) {
    return <GenericPreview file={file} note="No preview URL available — use Download" />;
  }
  if (file.file_type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.original_name}
        style={{
          width: "100%",
          maxHeight: "280px",
          objectFit: "contain",
          borderRadius: "8px",
          background: "var(--w11-control-bg)",
          border: "1px solid var(--w11-border-subtle)",
        }}
      />
    );
  }
  if (isPdfFile(file)) {
    return (
      <iframe
        src={url}
        title={file.original_name}
        style={{
          width: "100%",
          height: "440px",
          border: "1px solid var(--w11-border-subtle)",
          borderRadius: "8px",
          background: "var(--w11-control-bg)",
        }}
      />
    );
  }
  if (file.file_type === "video") {
    return (
      <video
        controls
        src={url}
        style={{ width: "100%", borderRadius: "8px", background: "#000" }}
      />
    );
  }
  if (file.file_type === "audio") {
    return (
      <div
        style={{
          padding: "20px 12px",
          borderRadius: "8px",
          background: "var(--w11-control-bg)",
          border: "1px solid var(--w11-border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Music size={30} color="var(--w11-text-tertiary)" />
        <audio controls src={url} style={{ width: "100%" }} />
      </div>
    );
  }
  if (isTextLike(file)) {
    if (file.size_bytes > TEXT_PREVIEW_MAX_BYTES) {
      return <GenericPreview file={file} note="File is too large to preview inline" />;
    }
    return <TextPreview url={url} />;
  }
  return <GenericPreview file={file} />;
}

function PreviewDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "11px" }}>
      <span
        style={{
          color: "var(--w11-text-secondary)",
          textTransform: "uppercase",
          fontSize: "10px",
          letterSpacing: "0.04em",
          paddingTop: "1px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--w11-text-primary)", textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

// ── Stock import dialog ────────────────────────────────────────────────────

function StockImportDialog({
  folderId,
  onClose,
  onImported,
}: {
  folderId: string | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"unsplash" | "pexels">("unsplash");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const runSearch = useCallback(
    async (q: string, src: "unsplash" | "pexels", pg: number) => {
      if (!q.trim()) {
        setResults([]);
        setTotal(0);
        setHasMore(false);
        return;
      }
      setIsSearching(true);
      setSearchFailed(false);
      try {
        const data = await stockSearch(q, src, pg);
        setResults((prev) => (pg === 1 ? data.results : [...prev, ...data.results]));
        setTotal(data.total);
        setHasMore(data.has_more);
      } catch {
        setSearchFailed(true);
        toast.error("Stock search failed — try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  // Debounce the stock search box (400ms) and reset the page/selection.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSelectedIds(new Set());
      runSearch(query.trim(), source, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [query, source, runSearch]);

  const importMutation = useMutation({
    mutationFn: async (photos: StockPhoto[]) => {
      let imported = 0;
      for (const photo of photos) {
        try {
          await stockImport(photo, folderId);
          imported += 1;
        } catch {
          // counted below; a single failure must not block the rest
        }
      }
      return { imported, attempted: photos.length };
    },
    onSuccess: ({ imported, attempted }) => {
      if (imported > 0) {
        toast.success(`Imported ${imported} stock photo${imported === 1 ? "" : "s"} into this folder`);
      }
      if (imported < attempted) {
        toast.error(`${attempted - imported} photo${attempted - imported === 1 ? "" : "s"} couldn't be imported`);
      }
      if (imported > 0) onImported();
    },
    onSettled: () => setSelectedIds(new Set()),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const photos = results.filter((p) => selectedIds.has(p.id));
    if (photos.length === 0 || importMutation.isPending) return;
    importMutation.mutate(photos);
  };

  return (
    <div
      className="win11-modal-backdrop"
      onClick={() => {
        if (!importMutation.isPending) onClose();
      }}
    >
      <div
        className="win11-dialog"
        style={{
          background: "var(--w11-surface-solid)",
          padding: "0",
          width: "92%",
          maxWidth: "680px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--w11-border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Globe size={18} color="var(--w11-accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
              Import Stock Photos
            </div>
            <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
              Free-to-use images from Unsplash &amp; Pexels, saved straight into your vault
            </div>
          </div>
          <button
            className="subtle"
            onClick={onClose}
            disabled={importMutation.isPending}
            style={{ padding: "4px 8px" }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search + source toggle */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--w11-border-subtle)",
            display: "flex",
            gap: "8px",
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "8px",
                top: "8px",
                color: "var(--w11-text-secondary)",
              }}
            />
            <input
              autoFocus
              type="text"
              placeholder="Search photos… (e.g. classroom, science lab)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "5px 10px 5px 28px",
                fontSize: "12px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                border: "1px solid var(--w11-control-border)",
                color: "var(--w11-text-primary)",
                outline: "none",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid var(--w11-control-border)",
            }}
          >
            {(["unsplash", "pexels"] as const).map((s) => (
              <button
                key={s}
                className={source === s ? "accent" : "subtle"}
                onClick={() => setSource(s)}
                style={{
                  padding: "5px 12px",
                  fontSize: "11px",
                  borderRadius: 0,
                  border: "none",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div style={{ height: "380px", overflowY: "auto", padding: "12px 20px" }}>
          {isSearching && page === 1 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "10px",
                color: "var(--w11-text-secondary)",
              }}
            >
              <div className="win11-spinner" />
              <div style={{ fontSize: "12px" }}>Searching {source}…</div>
            </div>
          ) : searchFailed && results.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "8px",
                color: "var(--w11-text-secondary)",
                fontSize: "12px",
              }}
            >
              <Globe size={32} strokeWidth={1.25} color="var(--w11-text-tertiary)" />
              Search failed — check your connection and try again.
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "8px",
                color: "var(--w11-text-secondary)",
                fontSize: "12px",
              }}
            >
              <Globe size={32} strokeWidth={1.25} color="var(--w11-text-tertiary)" />
              {query.trim() ? "No results found" : "Search for free stock photos to import"}
            </div>
          ) : (
            <>
              <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginBottom: "8px" }}>
                {total.toLocaleString()} results · {selectedIds.size} selected
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                  gap: "8px",
                }}
              >
                {results.map((photo) => {
                  const selected = selectedIds.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggleSelect(photo.id)}
                      title={`by ${photo.author}`}
                      style={{
                        position: "relative",
                        aspectRatio: "1",
                        borderRadius: "8px",
                        overflow: "hidden",
                        cursor: "pointer",
                        border: selected
                          ? "2px solid var(--w11-accent)"
                          : "2px solid transparent",
                        background: "var(--w11-control-bg)",
                        transition: "border-color 0.12s ease",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumb_url}
                        alt={`by ${photo.author}`}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {selected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
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
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "10px 6px 3px",
                          fontSize: "9px",
                          color: "#fff",
                          background: "linear-gradient(to top, rgba(0,0,0,.65), transparent)",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {photo.author}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}>
                  <button
                    className="subtle"
                    disabled={isSearching}
                    onClick={() => {
                      const next = page + 1;
                      setPage(next);
                      runSearch(query.trim(), source, next);
                    }}
                    style={{ padding: "4px 14px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {isSearching && <Loader2 size={12} className="animate-spin" />}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--w11-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
            Images provided by {source === "unsplash" ? "Unsplash" : "Pexels"} — free to use
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="subtle" onClick={onClose} disabled={importMutation.isPending} style={{ padding: "5px 14px", fontSize: "12px" }}>
              Cancel
            </button>
            <button
              className="accent"
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              style={{ padding: "5px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {importMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Import {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}photo{selectedIds.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FileManagerApp() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<PathSegment[]>(ROOT_PATH);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<DisplayItem | null>(null);
  const [previewFile, setPreviewFile] = useState<ManagedFile | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<DisplayItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

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
    queryKey: ["aos-files", currentFolderId, searchQuery, typeFilter],
    queryFn: () =>
      listFiles({
        folder_id: currentFolderId,
        search: searchQuery || undefined,
        type: typeFilter === "all" ? undefined : (typeFilter as FileType),
        per_page: 500,
      }),
  });

  const usageQuery = useQuery({
    queryKey: ["aos-files", "usage"],
    queryFn: getStorageUsage,
  });

  // ── Derived items (folders first, then files — client-side sort) ─────────

  const displayedItems = useMemo<DisplayItem[]>(() => {
    // A type filter only makes sense for files — hide folders unless "All".
    const folderItems: DisplayItem[] =
      typeFilter === "all"
        ? (foldersQuery.data ?? []).map((f) => ({
            id: f.id,
            kind: "folder" as const,
            name: f.name,
            iconType: "folder" as const,
            sizeBytes: null,
            fileCount: f.file_count,
            typeLabel: "File folder",
            modified: f.created_at,
          }))
        : [];
    const fileItems: DisplayItem[] = (filesQuery.data?.items ?? []).map(displayFromFile);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...folderItems, ...fileItems].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sortBy === "date") {
        const at = a.modified ? Date.parse(a.modified) : 0;
        const bt = b.modified ? Date.parse(b.modified) : 0;
        return dir * (at - bt);
      }
      if (sortBy === "size") {
        return dir * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
      }
      return dir * a.name.localeCompare(b.name);
    });
  }, [foldersQuery.data, filesQuery.data, typeFilter, sortBy, sortDir]);

  const isLoading = foldersQuery.isPending || filesQuery.isPending;
  const loadError = foldersQuery.isError || filesQuery.isError;

  const overallUploadProgress =
    uploadQueue.length > 0
      ? Math.round(
          uploadQueue.reduce(
            (acc, q) => acc + (q.status === "uploading" ? q.progress : 100),
            0,
          ) / uploadQueue.length,
        )
      : 0;

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
        description: apiErrorDescription(err, "Please try again."),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const initial: UploadQueueItem[] = files.map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        progress: 0,
        status: "uploading",
      }));
      setUploadQueue(initial);

      let succeeded = 0;
      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const key = initial[i].key;
        try {
          await uploadFilesToFolder([files[i]], currentFolderId, (pct) =>
            setUploadQueue((q) =>
              q.map((it) => (it.key === key ? { ...it, progress: pct } : it)),
            ),
          );
          setUploadQueue((q) =>
            q.map((it) =>
              it.key === key ? { ...it, status: "done", progress: 100 } : it,
            ),
          );
          succeeded += 1;
        } catch (err) {
          setUploadQueue((q) =>
            q.map((it) =>
              it.key === key
                ? {
                    ...it,
                    status: "error",
                    error: apiErrorDescription(err, "Upload failed"),
                  }
                : it,
            ),
          );
          failed.push(files[i].name);
        }
      }
      return { succeeded, failed, total: files.length };
    },
    onSuccess: ({ succeeded, failed, total }) => {
      invalidateAll();
      if (failed.length === 0) {
        toast.success(`Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`);
      } else if (succeeded === 0) {
        toast.error("Upload failed", { description: failed.join(", ") });
      } else {
        toast.warning(`Uploaded ${succeeded} of ${total} file${total === 1 ? "" : "s"}`, {
          description: `Failed: ${failed.join(", ")}`,
        });
      }
      // Let the user see the per-file outcome briefly, then clear the queue.
      window.setTimeout(
        () =>
          setUploadQueue((q) =>
            q.every((i) => i.status !== "uploading") ? [] : q,
          ),
        2500,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (item: DisplayItem) =>
      item.kind === "folder" ? deleteFolder(item.id) : deleteFile(item.id),
    onSuccess: (_result, item) => {
      toast.success(`Deleted "${item.name}"`);
      setSelectedItem((prev) => (prev?.id === item.id ? null : prev));
      setPreviewFile((prev) => (prev?.id === item.id ? null : prev));
      invalidateAll();
    },
    onError: (err) => {
      toast.error("Couldn't delete", {
        description: apiErrorDescription(err, "Please try again."),
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ item, name }: { item: DisplayItem; name: string }) => {
      if (item.kind === "folder") await renameFolder(item.id, name);
      else await renameFile(item.id, name);
    },
    onSuccess: (_result, { item, name }) => {
      toast.success(`Renamed to "${name}"`);
      setSelectedItem((prev) => (prev?.id === item.id ? { ...prev, name } : prev));
      setPreviewFile((prev) =>
        prev?.id === item.id ? { ...prev, original_name: name } : prev,
      );
      setRenameTarget(null);
      setRenameValue("");
      invalidateAll();
    },
    onError: (err) => {
      toast.error(
        renameTarget?.kind === "folder"
          ? "Couldn't rename folder"
          : "Couldn't rename file",
        { description: apiErrorDescription(err, "Please try again.") },
      );
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const navigateToFolder = (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    setSelectedItem(null);
    setPreviewFile(null);
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
      setPreviewFile(null);
      setIsMobileSidebarOpen(false);
    } else {
      // Files open in the preview pane, rendered by type.
      setSelectedItem(item);
      if (item.managed) setPreviewFile(item.managed);
    }
  };

  // Vault files are drag sources for cross-app drops (FilePicker, fields, …).
  const handleItemDragStart = (e: React.DragEvent, item: DisplayItem) => {
    if (item.kind !== "file" || !item.managed) return;
    setVaultDragData(e, item.managed);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = path[index];
    if (!target) return;
    setPath(path.slice(0, index + 1));
    setCurrentFolderId(target.id);
    setSelectedItem(null);
    setPreviewFile(null);
  };

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name || createFolderMutation.isPending) return;
    createFolderMutation.mutate(name);
  };

  const startUpload = (files: File[]) => {
    if (files.length > 0 && !uploadMutation.isPending) {
      uploadMutation.mutate(files);
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
    // Only clear when leaving the container entirely (not its children).
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragOver(false);
    startUpload(Array.from(e.dataTransfer.files ?? []));
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
          ? `"${item.name}" will be deleted and its files moved to the vault root. This cannot be undone.`
          : `"${item.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(item);
  };

  const openRename = (item: DisplayItem) => {
    setRenameValue(item.name);
    setRenameTarget(item);
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!renameTarget || !name || name === renameTarget.name || renameMutation.isPending) return;
    renameMutation.mutate({ item: renameTarget, name });
  };

  const usage = usageQuery.data;
  // The vault quota shown in the sidebar (matches the reference's 100 GB vault).
  const VAULT_QUOTA_BYTES = 100 * 1024 * 1024 * 1024;
  const usageUsedBytes = usage ? Math.min(usage.total_bytes, VAULT_QUOTA_BYTES) : 0;
  const usagePct = Math.min(100, (usageUsedBytes / VAULT_QUOTA_BYTES) * 100);

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
          overflowY: "auto",
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

        {/* View: type filters + sorting */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--w11-text-secondary)", textTransform: "uppercase", padding: "0 8px 6px" }}>
            View
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={typeFilter === f.value ? "accent" : "subtle"}
                onClick={() => setTypeFilter(f.value)}
                style={{ justifyContent: "flex-start", fontSize: "12px", padding: "6px 10px", borderRadius: "6px" }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              title="Sort by"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "4px 6px",
                fontSize: "11px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                border: "1px solid var(--w11-control-border)",
                color: "var(--w11-text-primary)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
            </select>
            <button
              className="subtle"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              style={{ padding: "4px 8px", display: "flex", alignItems: "center" }}
              title={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
            >
              {sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            </button>
          </div>
        </div>

        {/* Tools: upload + stock media */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--w11-text-secondary)", textTransform: "uppercase", padding: "0 8px 6px" }}>
            Tools
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              className="accent"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
            </button>
            <button
              className="subtle"
              onClick={() => setShowStockDialog(true)}
              style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              title="Import free stock photos into this folder"
            >
              <ImagePlus size={14} /> Stock Media
            </button>
          </div>
        </div>

        {/* Quota Indicator */}
        <div style={{ marginTop: "auto", padding: "10px", borderRadius: "8px", background: "var(--w11-control-hover)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 600, color: "var(--w11-text-primary)", marginBottom: "4px" }}>
            <span>Storage Usage</span>
            <span>{usage ? `${formatBytes(usage.total_bytes)} / 100 GB` : "—"}</span>
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
          <div style={{ position: "relative", width: "180px" }}>
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
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              style={{ padding: "4px 8px" }}
              title="Toggle View"
            >
              {viewMode === "grid" ? <List size={15} /> : <Grid size={15} />}
            </button>
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
          </div>
        </div>

        {/* Upload progress — thin accent strip directly under the toolbar */}
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

        {/* Files Display Container (drag-and-drop target) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            padding: "16px",
            overflowY: "auto",
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
                  padding: "10px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  border: "1px dashed var(--w11-accent)",
                  color: "var(--w11-accent)",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <Upload size={16} /> Drop files here to upload to {path[path.length - 1]?.name}
              </div>
            )}

            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "10px" }}>
                <div className="win11-spinner" />
                <div style={{ fontSize: "13px" }}>Loading your files...</div>
              </div>
            ) : loadError ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "10px" }}>
                <div style={{ fontSize: "13px" }}>Couldn&apos;t load your files.</div>
                <button
                  className="subtle"
                  onClick={() => {
                    foldersQuery.refetch();
                    filesQuery.refetch();
                  }}
                  style={{ padding: "4px 14px", fontSize: "12px" }}
                >
                  Retry
                </button>
              </div>
            ) : displayedItems.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "8px" }}>
                <Folder size={48} strokeWidth={1} color="var(--w11-text-tertiary)" />
                <div style={{ fontSize: "13px" }}>
                  {searchQuery || typeFilter !== "all" ? "No matching files" : "This folder is empty"}
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
                      draggable={item.kind === "file"}
                      onDragStart={(e) => handleItemDragStart(e, item)}
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
                      <div style={{ marginBottom: "6px" }}>{renderFileIcon(item.iconType, 38)}</div>
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
                      draggable={item.kind === "file"}
                      onDragStart={(e) => handleItemDragStart(e, item)}
                      style={{ cursor: "pointer", background: selectedItem?.id === item.id ? "var(--w11-control-hover)" : undefined }}
                    >
                      <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {renderFileIcon(item.iconType, 18)}
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

        {/* Upload queue (per-file progress) */}
        {uploadQueue.length > 0 && (
          <div
            style={{
              borderTop: "1px solid var(--w11-border-subtle)",
              background: "var(--w11-surface)",
              padding: "8px 16px",
              maxHeight: "150px",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--w11-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              {uploadMutation.isPending ? "Uploading" : "Upload results"} — {path[path.length - 1]?.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {uploadQueue.map((q) => (
                <div key={q.key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                  {q.status === "uploading" ? (
                    <Loader2 size={13} className="animate-spin" color="var(--w11-accent)" />
                  ) : q.status === "done" ? (
                    <CheckCircle2 size={13} color="#0f7b0f" />
                  ) : (
                    <XCircle size={13} color="#c42b1c" />
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
                  <div style={{ width: "120px", height: "4px", borderRadius: "2px", background: "var(--w11-control-hover)", overflow: "hidden", flexShrink: 0 }}>
                    <div
                      style={{
                        width: `${q.status === "uploading" ? q.progress : 100}%`,
                        height: "100%",
                        background: q.status === "error" ? "#c42b1c" : "linear-gradient(90deg, #0284c7, #38bdf8)",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                  <span style={{ width: "44px", textAlign: "right", color: "var(--w11-text-secondary)", flexShrink: 0 }}>
                    {q.status === "done" ? "Done" : q.status === "error" ? "Failed" : `${q.progress}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              {renderFileIcon(selectedItem.iconType, 20)}
              <div style={{ minWidth: 0 }}>
                <span
                  title={selectedItem.name}
                  style={{ fontWeight: 600, color: "var(--w11-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "inline-block", verticalAlign: "bottom" }}
                >
                  {selectedItem.name}
                </span>
                <span style={{ color: "var(--w11-text-secondary)", marginLeft: "8px", fontSize: "11px" }}>
                  {selectedItem.kind === "folder"
                    ? `${selectedItem.fileCount ?? 0} item${selectedItem.fileCount === 1 ? "" : "s"}`
                    : formatBytes(selectedItem.sizeBytes)}{" "}
                  • Modified {formatDate(selectedItem.modified)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {selectedItem.kind === "file" && (
                <button
                  className="accent"
                  onClick={() => selectedItem.managed && setPreviewFile(selectedItem.managed)}
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                >
                  Open
                </button>
              )}
              {selectedItem.kind === "file" && (
                <button
                  className="subtle"
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
                onClick={() => openRename(selectedItem)}
                style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Pencil size={13} /> Rename
              </button>
              <button
                className="subtle"
                onClick={() => handleDelete(selectedItem)}
                disabled={deleteMutation.isPending}
                style={{ padding: "4px 8px", fontSize: "11px", color: "#c42b1c", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Preview Pane — full-height column next to the sidebar +
          content, so all three share the flex row. */}
      {previewFile && (
        <aside
          style={{
            width: "360px",
            flexShrink: 0,
            borderLeft: "1px solid var(--w11-border-subtle)",
            background: "var(--w11-surface)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--w11-border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {renderFileIcon(fileIconKind(previewFile), 18)}
            <span
              title={previewFile.original_name}
              style={{
                flex: 1,
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--w11-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {previewFile.original_name}
            </span>
            <button
              className="subtle"
              onClick={() => setPreviewFile(null)}
              style={{ padding: "2px 6px" }}
              title="Close preview"
            >
              <X size={14} />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <FilePreviewBody file={previewFile} />

            {/* Metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <PreviewDetailRow label="Size" value={formatBytes(previewFile.size_bytes)} />
              <PreviewDetailRow label="Type" value={previewFile.file_type} />
              <PreviewDetailRow label="Uploaded" value={formatDate(previewFile.created_at)} />
              {previewFile.mime_type && (
                <PreviewDetailRow label="MIME" value={previewFile.mime_type} />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "auto", paddingTop: "4px" }}>
              <button
                className="accent"
                onClick={() => handleDownload(displayFromFile(previewFile))}
                style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Download size={13} /> Download
              </button>
              <button
                className="subtle"
                onClick={() => handleShare(displayFromFile(previewFile))}
                style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Share2 size={13} /> Share
              </button>
              <button
                className="subtle"
                onClick={() => openRename(displayFromFile(previewFile))}
                style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Pencil size={13} /> Rename
              </button>
              <button
                className="subtle"
                onClick={() => handleDelete(displayFromFile(previewFile))}
                disabled={deleteMutation.isPending}
                style={{ padding: "4px 10px", fontSize: "11px", color: "#c42b1c", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </aside>
      )}

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

      {/* Rename Dialog (files + folders) */}
      {renameTarget && (
        <div
          className="win11-modal-backdrop"
          onClick={() => {
            if (!renameMutation.isPending) setRenameTarget(null);
          }}
        >
          <div
            className="win11-dialog"
            style={{ background: "var(--w11-surface-solid)", padding: "20px", width: "90%", maxWidth: "360px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--w11-text-primary)", marginBottom: "4px" }}>
              Rename {renameTarget.kind === "folder" ? "Folder" : "File"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "12px" }}>
              in {path[path.length - 1]?.name}
            </div>
            <input
              autoFocus
              type="text"
              value={renameValue}
              placeholder={renameTarget.name}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape" && !renameMutation.isPending) setRenameTarget(null);
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
                onClick={() => setRenameTarget(null)}
                disabled={renameMutation.isPending}
                style={{ padding: "5px 14px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                className="accent"
                onClick={submitRename}
                disabled={!renameValue.trim() || renameValue.trim() === renameTarget.name || renameMutation.isPending}
                style={{ padding: "5px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {renameMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Photos Import Dialog */}
      {showStockDialog && (
        <StockImportDialog
          folderId={currentFolderId}
          onClose={() => setShowStockDialog(false)}
          onImported={() => {
            invalidateAll();
            setShowStockDialog(false);
          }}
        />
      )}
    </div>
  );
}
