"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  ChevronRight,
  Download,
  File,
  FileText,
  Film,
  FolderOpen,
  FolderPlus,
  Globe,
  Grid3X3,
  HardDrive,
  Image,
  LayoutList,
  Link2,
  Loader2,
  Music,
  Palette,
  PenLine,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  createFolder,
  deleteFile as deleteFileService,
  deleteFolder as deleteFolderService,
  type FileType,
  getStorageUsage,
  listFiles,
  listFolders,
  stockImport,
  stockSearch,
  type FileFolder,
  type ManagedFile,
  type StockPhoto,
  uploadFilesToFolder,
} from "@/lib/services/files.service";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Helpers ────────────────────────────────────────────────────────────────

const FILE_TYPE_FILTERS = [
  { value: "all", label: "All Files" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "spreadsheet", label: "Spreadsheets" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(file: ManagedFile, large = false) {
  const cls = large ? "h-10 w-10" : "h-7 w-7";
  switch (file.file_type) {
    case "image": return <Image className={`${cls} text-blue-400`} />;
    case "document": return <FileText className={`${cls} text-red-400`} />;
    case "video": return <Film className={`${cls} text-purple-400`} />;
    case "audio": return <Music className={`${cls} text-green-400`} />;
    case "spreadsheet": return <Table2 className={`${cls} text-emerald-500`} />;
    default: return <File className={`${cls} text-muted-foreground/50`} />;
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function FilesPage() {
  return (
    <PluginGate slug="file_management">
      <FilesContent />
    </PluginGate>
  );
}

function FilesContent() {
  const queryClient = useQueryClient();

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderTrail, setFolderTrail] = useState<{ id: string; name: string }[]>([]);
  const [focusedFolderId, setFocusedFolderId] = useState<string | null>(null);
  const [openOnSingleClick, setOpenOnSingleClick] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileType | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<ManagedFile | null>(null);

  // Folder creation
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Stock photos
  const [showStockImport, setShowStockImport] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data queries ──
  const { data: folders = [] } = useQuery<FileFolder[]>({
    queryKey: ["file-folders", currentFolderId],
    queryFn: () => listFolders(currentFolderId),
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["managed-files", currentFolderId, search, typeFilter],
    queryFn: () =>
      listFiles({
        folder_id: currentFolderId === null ? null : currentFolderId,
        search: search || undefined,
        type: typeFilter !== "all" ? typeFilter as ManagedFile["file_type"] : undefined,
        per_page: 100,
      }),
  });
  const files = filesData?.items ?? [];

  const { data: usageData } = useQuery({
    queryKey: ["file-usage"],
    queryFn: () => getStorageUsage(),
  });

  // ── Folder navigation ──
  const openFolder = useCallback((folder: FileFolder) => {
    setCurrentFolderId(folder.id);
    setFolderTrail((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setFocusedFolderId(null);
    setSelectedFile(null);
  }, []);

  const goToParent = useCallback(() => {
    setFolderTrail((prev) => {
      if (prev.length === 0) {
        setCurrentFolderId(null);
        setFocusedFolderId(null);
        return prev;
      }
      const next = prev.slice(0, -1);
      const parent = next[next.length - 1];
      setCurrentFolderId(parent ? parent.id : null);
      setFocusedFolderId(null);
      return next;
    });
    setSelectedFile(null);
  }, []);

  // Focus first folder when folder list changes
  useEffect(() => {
    if (!folders.length) {
      setFocusedFolderId(null);
      return;
    }
    if (!focusedFolderId || !folders.some((f) => f.id === focusedFolderId)) {
      setFocusedFolderId(folders[0].id);
    }
  }, [folders, focusedFolderId]);

  // Auto-focus new folder input
  useEffect(() => {
    if (showNewFolder) newFolderInputRef.current?.focus();
  }, [showNewFolder]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) return;

      if (e.key === "Enter" && focusedFolderId) {
        const folder = folders.find((f) => f.id === focusedFolderId);
        if (folder) { e.preventDefault(); openFolder(folder); }
        return;
      }
      if ((e.key === "Backspace" || e.key === "Escape") && folderTrail.length > 0) {
        e.preventDefault();
        goToParent();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedFolderId, folders, folderTrail.length, openFolder, goToParent]);

  // ── Upload ──
  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const arr = Array.from(fileList);
      setUploadProgress(0);
      try {
        await uploadFilesToFolder(arr, currentFolderId, (pct) => setUploadProgress(pct));
        toast.success(`${arr.length} file${arr.length > 1 ? "s" : ""} uploaded`);
        queryClient.invalidateQueries({ queryKey: ["managed-files"] });
        queryClient.invalidateQueries({ queryKey: ["file-usage"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      } finally {
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [currentFolderId, queryClient],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload],
  );

  // ── Folder creation ──
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(name, currentFolderId),
    onSuccess: () => {
      toast.success("Folder created");
      setShowNewFolder(false);
      setNewFolderName("");
      queryClient.invalidateQueries({ queryKey: ["file-folders"] });
    },
    onError: () => toast.error("Failed to create folder"),
  });

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (name) createFolderMutation.mutate(name);
  };

  // ── Folder delete ──
  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deleteFolderService(id),
    onSuccess: () => {
      toast.success("Folder deleted");
      queryClient.invalidateQueries({ queryKey: ["file-folders"] });
      queryClient.invalidateQueries({ queryKey: ["managed-files"] });
    },
    onError: () => toast.error("Failed to delete folder"),
  });

  // ── File delete ──
  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => deleteFileService(id),
    onSuccess: () => {
      toast.success("File deleted");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["managed-files"] });
      queryClient.invalidateQueries({ queryKey: ["file-usage"] });
    },
    onError: () => toast.error("Failed to delete file"),
  });

  // ── Breadcrumb ──
  const breadcrumb = [{ id: null as string | null, name: "My Files" }, ...folderTrail];
  const isRootOrEmpty = folders.length === 0 && files.length === 0 && !filesLoading;

  // ── My Designs (designer documents) ──
  const [activeTab, setActiveTab] = useState<"files" | "designs">("files");
  const { data: designDocs = [], isLoading: designsLoading } = useQuery<any[]>({
    queryKey: ["designer-docs"],
    queryFn: async () => {
      const res = await api.get("/design-studio/documents");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: activeTab === "designs",
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Tab switcher ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b bg-background shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
            activeTab === "files"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> My Files</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("designs")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
            activeTab === "designs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> My Designs</span>
        </button>
      </div>

      {/* ── My Designs panel ───────────────────────────────────────────── */}
      {activeTab === "designs" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">My Designs</h2>
              <p className="text-sm text-muted-foreground">Canvas documents saved in Docs &amp; Designer</p>
            </div>
            <Link href="/dashboard/designer/editor">
              <button type="button" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <PenLine className="h-4 w-4" /> New Design
              </button>
            </Link>
          </div>

          {designsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : designDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Palette className="h-14 w-14 opacity-20" />
              <p className="text-sm font-medium">No designs saved yet</p>
              <p className="text-xs opacity-70">Create a document in Docs &amp; Designer and save it</p>
              <Link href="/dashboard/designer/editor">
                <button type="button" className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Open Designer
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {designDocs.map((doc: any) => (
                <div key={doc.id} className="group rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Thumbnail */}
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center relative">
                    {doc.thumbnail_url ? (
                      <img src={doc.thumbnail_url} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <Palette className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Link href={doc.template_type === 'writer_doc'
                        ? `/dashboard/designer/writer?doc=${doc.id}`
                        : `/dashboard/designer/editor?doc=${doc.id}`}>
                        <button type="button" className="px-3 py-1.5 bg-white text-black rounded-md text-xs font-medium hover:bg-gray-100">
                          {doc.template_type === 'writer_doc' ? '📝 Open Writer' : '🎨 Open Canvas'}
                        </button>
                      </Link>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        doc.template_type === 'writer_doc'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>{doc.template_type === 'writer_doc' ? 'Writer Doc' : 'Canvas Design'}</span>
                    </div>
                    {doc.updated_at && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(doc.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "files" && <>
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background flex-wrap shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
          {breadcrumb.map((node, idx) => (
            <div key={`${node.id ?? "root"}-${idx}`} className="flex items-center gap-0.5 shrink-0">
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <button
                type="button"
                onClick={() => {
                  if (node.id === null) {
                    setCurrentFolderId(null);
                    setFolderTrail([]);
                    setFocusedFolderId(null);
                    setSelectedFile(null);
                  } else {
                    const trailIdx = folderTrail.findIndex((f) => f.id === node.id);
                    if (trailIdx >= 0) {
                      setFolderTrail(folderTrail.slice(0, trailIdx + 1));
                      setCurrentFolderId(node.id);
                      setFocusedFolderId(null);
                      setSelectedFile(null);
                    }
                  }
                }}
                className={`rounded px-2 py-1 text-sm transition-colors shrink-0 ${
                  idx === breadcrumb.length - 1
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {node.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as FileType | "all")}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Single-click toggle */}
        <button
          type="button"
          onClick={() => setOpenOnSingleClick((v) => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors ${
            openOnSingleClick
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground"
          }`}
          title="Toggle single-click folder open"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          1-click
        </button>

        {/* View mode */}
        <div className="flex border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-2 py-1.5 transition-colors ${viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50"}`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2 py-1.5 transition-colors ${viewMode === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* New folder */}
        {showNewFolder ? (
          <div className="flex items-center gap-1">
            <Input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
              }}
              placeholder="Folder name"
              className="h-8 text-sm w-32"
            />
            <Button size="sm" className="h-8" onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
            New Folder
          </Button>
        )}

        {/* Stock Photos */}
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowStockImport(true)}>
          <Globe className="h-3.5 w-3.5 mr-1.5" />
          Stock Photos
        </Button>

        {/* Upload */}
        <Button size="sm" className="h-8" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null}>
          {uploadProgress !== null ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{uploadProgress}%</>
          ) : (
            <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Storage usage bar */}
      {usageData && (
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground shrink-0 flex-wrap">
          <span className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{usageData.total_mb} MB</span> used
            &middot;
            <span className="font-medium text-foreground">{usageData.total_files}</span> files
          </span>
          {usageData.breakdown.map((b) => (
            <span key={b.file_type}>
              {b.file_type}: <span className="font-medium text-foreground">{b.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content + drag-drop */}
        <div
          className={`flex-1 overflow-y-auto p-4 transition-colors ${dragOver ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => {
            // Only clear if leaving the container entirely
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="flex items-center justify-center py-10 text-primary font-medium text-sm">
              <Upload className="h-6 w-6 mr-2" /> Drop files here to upload
            </div>
          )}

          {filesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isRootOrEmpty ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <FolderOpen className="h-14 w-14 mb-3 opacity-20" />
              <p className="text-sm font-medium">No files yet</p>
              <p className="text-xs mt-1 opacity-70">Upload files or create a folder to get started</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Folders section */}
              {folders.length > 0 && (
                <section>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Folders
                  </p>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {folders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          focused={focusedFolderId === folder.id}
                          openOnSingleClick={openOnSingleClick}
                          onClick={() => {
                            setFocusedFolderId(folder.id);
                            setSelectedFile(null);
                            if (openOnSingleClick) openFolder(folder);
                          }}
                          onDoubleClick={() => openFolder(folder)}
                          onDelete={() => deleteFolderMutation.mutate(folder.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 rounded-lg border overflow-hidden">
                      {folders.map((folder) => (
                        <FolderRow
                          key={folder.id}
                          folder={folder}
                          focused={focusedFolderId === folder.id}
                          openOnSingleClick={openOnSingleClick}
                          onClick={() => {
                            setFocusedFolderId(folder.id);
                            setSelectedFile(null);
                            if (openOnSingleClick) openFolder(folder);
                          }}
                          onDoubleClick={() => openFolder(folder)}
                          onDelete={() => deleteFolderMutation.mutate(folder.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Files section */}
              {files.length > 0 && (
                <section>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Files
                  </p>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {files.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          selected={selectedFile?.id === file.id}
                          onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      {files.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          selected={selectedFile?.id === file.id}
                          onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        {/* ── Detail panel ─────────────────────────────────────────────── */}
        {selectedFile && (
          <aside className="w-72 shrink-0 border-l flex flex-col bg-background overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-medium truncate pr-2">{selectedFile.original_name}</h3>
              <button type="button" onClick={() => setSelectedFile(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="p-4 border-b">
              {selectedFile.file_type === "image" && selectedFile.url ? (
                <img
                  src={selectedFile.url}
                  alt={selectedFile.original_name}
                  className="w-full rounded-lg object-cover max-h-40 bg-muted"
                />
              ) : (
                <div className="flex justify-center py-6">
                  {fileIcon(selectedFile, true)}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="p-4 space-y-3 flex-1">
              <DetailRow label="Name" value={selectedFile.original_name} />
              <DetailRow label="Size" value={formatBytes(selectedFile.size_bytes)} />
              <DetailRow label="Type" value={selectedFile.file_type} />
              {selectedFile.mime_type && <DetailRow label="MIME" value={selectedFile.mime_type} />}
              {selectedFile.extension && <DetailRow label="Ext" value={`.${selectedFile.extension}`} />}
              <DetailRow label="Uploaded" value={new Date(selectedFile.created_at).toLocaleDateString()} />
              {selectedFile.linked_module && (
                <DetailRow label="Module" value={selectedFile.linked_module} />
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex flex-col gap-2">
              {/* Open in Designer for .aschool-design or canvas JSON files */}
              {(selectedFile.extension === "aschool-design" || selectedFile.extension === "json") && (
                <Button variant="default" size="sm" className="w-full justify-start gap-2" asChild>
                  <a href={selectedFile.url} onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const r = await fetch(selectedFile.url);
                      const json = await r.json();
                      const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href     = url;
                      a.download = selectedFile.original_name;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.info("Download then open with File → Open in Designer");
                    } catch { toast.error("Could not load file"); }
                  }}>
                    <PenLine className="h-3.5 w-3.5" />
                    Open in Designer
                  </a>
                </Button>
              )}
              {/* Open image / video / audio in new tab for preview */}
              {(selectedFile.file_type === "image" || selectedFile.file_type === "video" || selectedFile.file_type === "audio") && (
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <a href={selectedFile.url} target="_blank" rel="noreferrer">
                    <Image className="h-3.5 w-3.5 mr-2" />
                    Preview
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(selectedFile.url);
                  toast.success("URL copied");
                }}
              >
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Copy URL
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <a href={selectedFile.url} target="_blank" rel="noreferrer" download>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download
                </a>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start"
                onClick={() => deleteFileMutation.mutate(selectedFile.id)}
                disabled={deleteFileMutation.isPending}
              >
                {deleteFileMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                Delete
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* Stock Photos Dialog */}
      <Dialog open={showStockImport} onOpenChange={setShowStockImport}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Import Stock Photos
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 flex flex-col overflow-hidden" style={{ height: "70vh" }}>
            <StockImageSearch
              folderId={currentFolderId}
              onImported={(files) => {
                queryClient.invalidateQueries({ queryKey: ["managed-files"] });
                toast.success(`${files.length} photo(s) added`);
                setShowStockImport(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
}

// ── Stock Image Search ────────────────────────────────────────────────────

function StockImageSearch({
  folderId,
  onImported,
}: {
  folderId: string | null;
  onImported: (files: ManagedFile[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"unsplash" | "pexels">("unsplash");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, src: "unsplash" | "pexels", pg: number) => {
      if (!q.trim()) { setResults([]); setTotal(0); setHasMore(false); return; }
      setIsSearching(true);
      try {
        const data = await stockSearch(q, src, pg);
        if (pg === 1) {
          setResults(data.results);
        } else {
          setResults((prev) => [...prev, ...data.results]);
        }
        setTotal(data.total);
        setHasMore(data.has_more);
      } catch {
        toast.error("Stock search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSelectedIds(new Set());
      runSearch(query, source, 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, source, runSearch]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    const photos = results.filter((p) => selectedIds.has(p.id));
    if (!photos.length) return;
    setImporting(true);
    const imported: ManagedFile[] = [];
    for (const photo of photos) {
      try {
        const file = await stockImport(photo, folderId);
        imported.push(file);
      } catch {
        toast.error(`Failed to import ${photo.id}`);
      }
    }
    setImporting(false);
    if (imported.length) onImported(imported);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search photos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex border rounded-md overflow-hidden shrink-0">
          {(["unsplash", "pexels"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`px-3 text-xs font-medium transition-colors ${source === s ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && page === 1 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
            <Globe className="h-8 w-8" />
            <p className="text-sm">{query.trim() ? "No results found" : "Search for free stock photos"}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">{total.toLocaleString()} results · {selectedIds.size} selected</p>
            <div className="grid grid-cols-4 gap-2">
              {results.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggleSelect(photo.id)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none ${
                    selectedIds.has(photo.id) ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/40"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumb_url}
                    alt={`by ${photo.author}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selectedIds.has(photo.id) && (
                    <div className="absolute inset-0 bg-primary/20 flex items-end p-1">
                      <span className="text-[10px] text-white bg-primary/80 rounded px-1">✓</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1 opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{photo.author}</p>
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSearching}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    runSearch(query, source, next);
                  }}
                >
                  {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t shrink-0">
        <p className="text-xs text-muted-foreground">
          Images provided by {source === "unsplash" ? "Unsplash" : "Pexels"} — free to use
        </p>
        <Button
          size="sm"
          disabled={selectedIds.size === 0 || importing}
          onClick={handleImport}
        >
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Import {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}photo{selectedIds.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function FolderCard({
  folder,
  focused,
  openOnSingleClick,
  onClick,
  onDoubleClick,
  onDelete,
}: {
  folder: FileFolder;
  focused: boolean;
  openOnSingleClick: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => e.key === "Enter" && onDoubleClick()}
      className={`group relative border rounded-lg p-3 cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        focused ? "ring-2 ring-primary/60" : ""
      }`}
    >
      <div className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2">
        <FolderOpen className="h-9 w-9 text-yellow-500/80" />
      </div>
      <p className="text-xs font-medium truncate">{folder.name}</p>
      <p className="text-[11px] text-muted-foreground">{folder.file_count} files</p>

      {/* Delete on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-all"
        title="Delete folder"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
        {openOnSingleClick ? "Click to open" : "Double-click to open"}
      </p>
    </div>
  );
}

function FolderRow({
  folder,
  focused,
  openOnSingleClick,
  onClick,
  onDoubleClick,
  onDelete,
}: {
  folder: FileFolder;
  focused: boolean;
  openOnSingleClick: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => e.key === "Enter" && onDoubleClick()}
      className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-b-0 focus-visible:outline-none ${
        focused ? "bg-primary/5" : ""
      }`}
    >
      <FolderOpen className="h-4 w-4 text-yellow-500/80 shrink-0" />
      <span className="text-sm flex-1 truncate">{folder.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{folder.file_count} files</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileCard({
  file,
  selected,
  onClick,
}: {
  file: ManagedFile;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`group relative border rounded-lg overflow-hidden cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "ring-2 ring-primary border-primary"
          : "hover:ring-2 hover:ring-primary/40"
      }`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.original_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          fileIcon(file)
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium truncate">{file.original_name}</p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(file.size_bytes)}</p>
      </div>
    </div>
  );
}

function FileRow({
  file,
  selected,
  onClick,
}: {
  file: ManagedFile;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-b-0 focus-visible:outline-none ${
        selected ? "bg-primary/5" : ""
      }`}
    >
      <div className="w-7 h-7 shrink-0 flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="w-7 h-7 rounded object-cover" loading="lazy" />
        ) : (
          fileIcon(file)
        )}
      </div>
      <span className="text-sm flex-1 truncate">{file.original_name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size_bytes)}</span>
      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
        {new Date(file.created_at).toLocaleDateString()}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{value}</p>
    </div>
  );
}
