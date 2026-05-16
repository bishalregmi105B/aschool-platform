import { api, type ApiResponse } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  category: "attendance" | "fee" | "notice" | "exam" | "system" | "gamification" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  created_at: string | null;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface MarkAllReadResponse {
  marked_read: number;
}

// ── Category metadata ──────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  { key: "", label: "All", icon: "🔔" },
  { key: "attendance", label: "Attendance", icon: "📋" },
  { key: "fee", label: "Fees", icon: "💰" },
  { key: "notice", label: "Notices", icon: "📢" },
  { key: "exam", label: "Exams", icon: "📝" },
  { key: "system", label: "System", icon: "⚙️" },
  { key: "gamification", label: "Rewards", icon: "🏆" },
] as const;

// ── API functions ──────────────────────────────────────────────────────

export async function fetchNotifications(params?: {
  unread_only?: boolean;
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<InAppNotification[]> {
  const response = await api.get<ApiResponse<InAppNotification[]>>(
    "/notifications",
    { params },
  );
  return response.data.data || [];
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await api.get<ApiResponse<UnreadCountResponse>>(
    "/notifications/unread-count",
  );
  return response.data.data?.unread_count ?? 0;
}

export async function markNotificationRead(
  id: string,
): Promise<InAppNotification | null> {
  const response = await api.post<ApiResponse<InAppNotification>>(
    `/notifications/${id}/read`,
  );
  return response.data.data ?? null;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await api.post<ApiResponse<MarkAllReadResponse>>(
    "/notifications/mark-all-read",
  );
  return response.data.data?.marked_read ?? 0;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const response = await api.delete<ApiResponse<{ deleted: boolean }>>(
    `/notifications/${id}`,
  );
  return response.data.data?.deleted ?? false;
}

// ── Helpers ────────────────────────────────────────────────────────────

export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getCategoryIcon(category: string): string {
  return NOTIFICATION_CATEGORIES.find((c) => c.key === category)?.icon ?? "🔔";
}
