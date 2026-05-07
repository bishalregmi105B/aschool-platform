import Cookies from "js-cookie";

import { api, type ApiResponse } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

export type FileType =
  | "image"
  | "document"
  | "video"
  | "audio"
  | "spreadsheet"
  | "other";

export interface FileFolder {
  id: string;
  school_id: string;
  name: string;
  parent_id: string | null;
  file_count: number;
  created_at: string;
}

export interface ManagedFile {
  id: string;
  url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  extension: string;
  folder: string;
  folder_id: string | null;
  file_type: FileType;
  tags: string[];
  linked_module: string | null;
  is_public: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface FilesListParams {
  page?: number;
  per_page?: number;
  search?: string;
  type?: FileType | "";
  folder?: string;
  folder_id?: string | null;
}

export interface FilesListResponse {
  items: ManagedFile[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

export interface StorageUsage {
  total_files: number;
  total_bytes: number;
  total_mb: number;
  breakdown: { file_type: string; count: number; total_bytes: number }[];
}

export interface FileUpdatePayload {
  folder?: string;
  folder_id?: string | null;
  tags?: string[];
  is_public?: boolean;
  original_name?: string;
}

// ── Folder Service Functions ───────────────────────────────────────────────

export async function listFolders(parentId?: string | null): Promise<FileFolder[]> {
  const q = new URLSearchParams();
  if (parentId) q.set("parent_id", parentId);
  const res = await api.get<ApiResponse<FileFolder[]>>(`/files/folders?${q.toString()}`);
  return res.data.data ?? [];
}

export async function createFolder(name: string, parentId?: string | null): Promise<FileFolder> {
  const res = await api.post<ApiResponse<FileFolder>>("/files/folders", {
    name,
    parent_id: parentId ?? null,
  });
  return res.data.data;
}

export async function deleteFolder(id: string): Promise<void> {
  await api.delete(`/files/folders/${id}`);
}

// ── File Service Functions ─────────────────────────────────────────────────

export async function listFiles(
  params: FilesListParams = {},
): Promise<FilesListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.per_page) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  if (params.type) q.set("type", params.type);
  if (params.folder) q.set("folder", params.folder);
  if (params.folder_id !== undefined && params.folder_id !== null) {
    q.set("folder_id", params.folder_id);
  } else if (params.folder_id === null) {
    q.set("folder_id", "root");
  }
  type RawFilesResponse = { data: ManagedFile[]; meta?: { pagination?: FilesListResponse["pagination"] } };
  const res = await api.get<RawFilesResponse>(`/files/?${q.toString()}`);
  return {
    items: res.data.data ?? [],
    pagination: res.data.meta?.pagination ?? {
      total: 0, page: 1, per_page: params.per_page ?? 24, pages: 1,
    },
  };
}

export async function getFile(id: string): Promise<ManagedFile> {
  const res = await api.get<ApiResponse<ManagedFile>>(`/files/${id}`);
  return res.data.data;
}

export async function uploadFilesToFolder(
  files: File[],
  folderId: string | null,
  onProgress?: (pct: number) => void,
): Promise<ManagedFile[]> {
  const results: ManagedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const form = new FormData();
    form.append("file", file);
    if (folderId) form.append("folder_id", folderId);

    if (onProgress) {
      const result = await new Promise<ManagedFile>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/files/upload`);

        // Copy auth header from axios instance
        const token = Cookies.get("access_token");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const filePct = (e.loaded / e.total) * 100;
            onProgress(Math.round(((i + filePct / 100) / files.length) * 100));
          }
        };

        xhr.onload = () => {
          let json: { data?: ManagedFile; error?: string } = {};
          try { json = JSON.parse(xhr.responseText || "{}"); } catch { /* */ }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json.data as ManagedFile);
          } else {
            reject(new Error((json as { error?: string }).error || `Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });
      results.push(result);
    } else {
      const res = await api.post<ApiResponse<ManagedFile>>(
        "/files/upload",
        form,
        { headers: { "Content-Type": undefined } },
      );
      results.push(res.data.data);
    }

    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * 100));
  }
  return results;
}

// Keep legacy wrapper for components that use the old signature
export async function uploadFiles(files: File[]): Promise<ManagedFile[]> {
  return uploadFilesToFolder(files, null);
}

export async function updateFile(
  id: string,
  payload: FileUpdatePayload,
): Promise<ManagedFile> {
  const res = await api.patch<ApiResponse<ManagedFile>>(
    `/files/${id}`,
    payload,
  );
  return res.data.data;
}

export async function deleteFile(id: string): Promise<void> {
  await api.delete(`/files/${id}`);
}

export async function getPresignedUrl(id: string): Promise<string> {
  const res = await api.get<ApiResponse<{ url: string }>>(
    `/files/${id}/presigned`,
  );
  return res.data.data.url;
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const res = await api.get<ApiResponse<StorageUsage>>("/files/usage");
  return res.data.data;
}

// ── Stock Photos ───────────────────────────────────────────────────────────

export interface StockPhoto {
  id: string;
  thumb_url: string;
  preview_url: string;
  full_url: string;
  author: string;
  author_url: string;
  source: "unsplash" | "pexels";
  source_url: string;
  download_trigger_url: string | null;
  width: number | null;
  height: number | null;
}

export interface StockSearchResult {
  results: StockPhoto[];
  total: number;
  has_more: boolean;
  error?: string;
}

export async function stockSearch(
  q: string,
  source: "unsplash" | "pexels",
  page: number,
  perPage = 20,
): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    q, source, page: String(page), per_page: String(perPage),
  });
  const res = await api.get<ApiResponse<StockSearchResult>>(`/files/stock-search?${params}`);
  return res.data.data;
}

export async function stockImport(
  photo: StockPhoto,
  folderId: string | null,
): Promise<ManagedFile> {
  const rawExt = photo.full_url.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt : "jpg";
  const filename = `${photo.source}-${photo.id}.${ext}`;
  const res = await api.post<ApiResponse<ManagedFile>>("/files/stock-import", {
    url: photo.full_url,
    filename,
    folder_id: folderId,
    source: photo.source,
    download_trigger_url: photo.download_trigger_url,
  });
  return res.data.data;
}

