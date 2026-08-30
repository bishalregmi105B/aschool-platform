import { api, type ApiResponse } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface IemisFormat {
  code: string;
  name: string;
  sheet: string;
  columns: { iemis_column: string; aschool_field: string }[];
}

export interface ImportPreview {
  format: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  warnings: string[];
  preview: Record<string, string | number | null>[];
}

export interface ImportLog {
  id: string;
  format_code: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  completed_at: string | null;
  created_at: string;
  errors?: { row?: number; error: string }[];
  summary?: Record<string, unknown>;
}

export interface ImportHistoryResponse {
  items: ImportLog[];
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

// ── Service Functions ──────────────────────────────────────────────────────

export async function listFormats(): Promise<IemisFormat[]> {
  const res = await api.get<ApiResponse<IemisFormat[]>>("/iemis/formats");
  return res.data.data;
}

export async function validateImport(
  file: File,
  format?: string,
): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  if (format) form.append("format", format);
  const res = await api.post<ApiResponse<ImportPreview>>(
    "/iemis/validate",
    form,
    { headers: { "Content-Type": undefined } },
  );
  return res.data.data;
}

export async function runImport(
  file: File,
  format?: string,
): Promise<ImportLog> {
  const form = new FormData();
  form.append("file", file);
  if (format) form.append("format", format);
  const res = await api.post<ApiResponse<ImportLog>>(
    "/iemis/import",
    form,
    { headers: { "Content-Type": undefined } },
  );
  return res.data.data;
}

export async function getHistory(page = 1): Promise<ImportHistoryResponse> {
  const q = new URLSearchParams({ page: String(page), per_page: "50" });
  const res = await api.get<ApiResponse<ImportHistoryResponse>>(
    `/iemis/history?${q}`,
  );
  // The backend returns `data: [...]` (a plain list) with pagination under
  // `meta.pagination` — normalize to the {items, pagination} shape the pages
  // consume, otherwise the history table showed "No imports yet." forever.
  const raw = res.data?.data as unknown;
  const items: ImportLog[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as ImportHistoryResponse)?.items)
      ? (raw as ImportHistoryResponse).items
      : [];
  const pagination =
    (
      res.data as unknown as {
        meta?: { pagination?: ImportHistoryResponse["pagination"] };
      }
    )?.meta?.pagination ?? undefined;
  return { items, pagination };
}

/** URL of the backend-generated import template (.xlsx download). */
export function getTemplateUrl(format: string): string {
  return `${api.defaults.baseURL}/iemis/template?format=${encodeURIComponent(format)}`;
}

export async function getHistoryDetail(id: string): Promise<ImportLog> {
  const res = await api.get<ApiResponse<ImportLog>>(`/iemis/history/${id}`);
  return res.data.data;
}
