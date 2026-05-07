"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import {
  Search,
  Upload,
  Image,
  FileText,
  Film,
  Music,
  Table2,
  File,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import {
  listFiles,
  uploadFiles,
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

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, { icon: React.ReactNode; bg: string; ext?: string }> = {
  image:       { icon: <FileImage className="h-8 w-8 text-blue-500" />,      bg: "bg-blue-50",    ext: "IMG" },
  document:    { icon: <FileText className="h-8 w-8 text-red-500" />,        bg: "bg-red-50",     ext: "DOC" },
  video:       { icon: <FileVideo className="h-8 w-8 text-purple-500" />,    bg: "bg-purple-50",  ext: "VID" },
  audio:       { icon: <FileAudio className="h-8 w-8 text-green-500" />,     bg: "bg-green-50",   ext: "AUD" },
  spreadsheet: { icon: <FileSpreadsheet className="h-8 w-8 text-emerald-600" />, bg: "bg-emerald-50", ext: "XLS" },
  other:       { icon: <File className="h-8 w-8 text-gray-400" />,           bg: "bg-gray-50",    ext: "FILE" },
};

function getExtLabel(file: ManagedFile): string {
  if (file.extension) return file.extension.toUpperCase();
  return TYPE_ICON[file.file_type]?.ext ?? "FILE";
}

const TYPE_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "image" as const, label: "Images" },
  { value: "document" as const, label: "Docs" },
  { value: "video" as const, label: "Videos" },
  { value: "audio" as const, label: "Audio" },
  { value: "spreadsheet" as const, label: "Sheets" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File Thumbnail Card ────────────────────────────────────────────────────

function FileThumb({
  file,
  selected,
  onClick,
}: {
  file: ManagedFile;
  selected: boolean;
  onClick: () => void;
}) {
  const typeInfo = TYPE_ICON[file.file_type] ?? TYPE_ICON.other;
  const [imgError, setImgError] = useState(false);
  const showImage = file.file_type === "image" && file.url && !imgError;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col rounded-lg border-2 overflow-hidden text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "border-primary bg-primary/5"
          : "border-muted hover:border-primary/40 bg-background"
      }`}
    >
      {/* Preview area */}
      <div className={`relative w-full aspect-square flex items-center justify-center ${showImage ? "" : typeInfo.bg}`}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.original_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            {typeInfo.icon}
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground">
              {getExtLabel(file)}
            </span>
          </div>
        )}
        {/* Selection tick */}
        {selected && (
          <div className="absolute inset-0 bg-primary/10 flex items-start justify-end p-1">
            <CheckCircle2 className="h-5 w-5 text-primary fill-white" />
          </div>
        )}
      </div>
      {/* Always-visible filename */}
      <div className="px-1.5 py-1 border-t bg-background">
        <p className="text-[11px] font-medium truncate leading-tight" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(file.size_bytes)}</p>
      </div>
    </button>
  );
}

// ── File Picker Dialog ─────────────────────────────────────────────────────

export function FilePicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  fileType = "",
  preselectedIds = [],
  title = "Select File",
}: FilePickerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileType | "all">(
    fileType || "all",
  );
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(preselectedIds),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["file-picker", page, search, typeFilter],
    queryFn: () =>
      listFiles({ page, per_page: 30, search: search || undefined, type: (typeFilter === "all" ? undefined : typeFilter) }),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadFiles(files),
    onSuccess: (uploaded) => {
      toast.success(`${uploaded.length} file(s) uploaded`);
      queryClient.invalidateQueries({ queryKey: ["file-picker"] });
      queryClient.invalidateQueries({ queryKey: ["managed-files"] });
      queryClient.invalidateQueries({ queryKey: ["file-usage"] });
      // Auto-select newly uploaded files
      setSelectedIds((prev) => {
        const next = multiple ? new Set(prev) : new Set<string>();
        uploaded.forEach((f) => next.add(f.id));
        return next;
      });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr?.response?.data?.error || "Upload failed");
    },
  });

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
      }),
      [];
    },
    [multiple],
  );

  const handleConfirm = () => {
    const selected = (data?.items ?? []).filter((f) => selectedIds.has(f.id));
    if (selected.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    onSelect(selected);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedIds(new Set(preselectedIds));
    setSearch("");
    setPage(1);
    onOpenChange(false);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadMutation.mutate(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const files = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-yellow-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files…"
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Type filter — hide if fileType prop locked */}
          {!fileType && (
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as FileType | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUploadChange}
            accept={
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
                        : undefined
            }
          />

          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="h-6 text-xs">
              {selectedIds.size} selected
            </Badge>
          )}
        </div>

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <PageLoader />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">No files found.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload your first file
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {files.map((file) => (
                <FileThumb
                  key={file.id}
                  file={file}
                  selected={selectedIds.has(file.id)}
                  onClick={() => toggleFile(file.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {pagination.page} / {pagination.pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            {multiple
              ? `Select ${selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Files`
              : "Select File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
