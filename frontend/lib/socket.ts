/**
 * Socket.IO Client — real-time events for notifications, live updates, chat.
 */
import Cookies from "js-cookie";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, "").replace(/^http/, "ws") ||
  (typeof window !== "undefined"
    ? window.location.origin.replace(/^http/, "ws")
    : undefined);

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== "undefined" ? Cookies.get("access_token") : undefined;

    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });
  }

  return socket;
}

export function connectSocket(token?: string): Socket {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── School-scoped rooms ──────────────────────────────────

export function joinSchoolRoom(schoolId: string): void {
  getSocket().emit("join_school", { school_id: schoolId });
}

export function leaveSchoolRoom(schoolId: string): void {
  getSocket().emit("leave_school", { school_id: schoolId });
}

// ── Event Types ──────────────────────────────────────────

export type SocketEvent =
  | "notification"
  | "attendance_update"
  | "fee_payment"
  | "notice_published"
  | "chat_message"
  | "emergency_alert"
  | "gps_update"
  | "plugin_installed"
  | "plugin_uninstalled";

// ── Typed Listeners ──────────────────────────────────────

export function onNotification(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on("notification", callback);
  return () => s.off("notification", callback);
}

export function onAttendanceUpdate(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on("attendance_update", callback);
  return () => s.off("attendance_update", callback);
}

export function onEmergencyAlert(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on("emergency_alert", callback);
  return () => s.off("emergency_alert", callback);
}

export function onGPSUpdate(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on("gps_update", callback);
  return () => s.off("gps_update", callback);
}

export function onChatMessage(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on("chat_message", callback);
  return () => s.off("chat_message", callback);
}
