"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Bell, Trash2, ArrowRight } from "lucide-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  formatTimeAgo,
  type InAppNotification,
} from "@/lib/services/notifications.service";

export interface AOSNotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  appId?: string;
  actionText?: string;
}

interface IOSNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: AOSNotificationItem[];
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  onOpenApp: (appId: string) => void;
  accentColor?: string;
}

export default function IOSNotificationCenter({
  isOpen,
  onClose,
  notifications: externalNotifications,
  onClearAll: externalClearAll,
  onDismiss: externalDismiss,
  onOpenApp,
  accentColor = "#0078d4",
}: IOSNotificationCenterProps) {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [realNotifications, setRealNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await fetchNotifications({ per_page: 15 });
      setRealNotifications(list);
    } catch {
      // Fallback gracefully
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  if (!isOpen) return null;

  // Convert real notifications or use external
  const displayItems: AOSNotificationItem[] = externalNotifications || realNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.body,
    time: formatTimeAgo(n.created_at),
    appId: n.action_url ? n.action_url.replace(/^\/dashboard\/?/, "") : undefined,
    actionText: "View Details",
  }));

  const handleClearAll = async () => {
    if (externalClearAll) {
      externalClearAll();
    } else {
      try {
        await markAllNotificationsRead();
        setRealNotifications([]);
      } catch {}
    }
  };

  const handleDismiss = async (id: string) => {
    if (externalDismiss) {
      externalDismiss(id);
    } else {
      try {
        await markNotificationRead(id);
        setRealNotifications((prev) => prev.filter((item) => item.id !== id));
      } catch {}
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10040,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "30px 16px 20px 16px",
        overflowY: "auto",
        userSelect: "none",
        color: "#ffffff",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Lockscreen Date & Clock Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "15px", fontWeight: 500, opacity: 0.9 }}>{dateStr}</div>
          <div style={{ fontSize: "64px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.1 }}>
            {timeStr}
          </div>
        </div>

        {/* Action Header Bar */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            padding: "0 4px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700 }}>
            Notifications ({displayItems.length})
          </span>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {displayItems.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  all: "unset",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#f87171",
                  background: "rgba(255,255,255,0.12)",
                  padding: "4px 10px",
                  borderRadius: "14px",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                Clear All
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                all: "unset",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Notifications Stack */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
          {displayItems.length === 0 ? (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                padding: "36px 16px",
                textAlign: "center",
                color: "#e4e4e7",
              }}
            >
              <Bell size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <div style={{ fontSize: "15px", fontWeight: 600 }}>No Notifications</div>
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
                All academic alerts and bus schedules are up to date.
              </div>
            </div>
          ) : (
            displayItems.map((n) => (
              <div
                key={n.id}
                style={{
                  background: "rgba(255, 255, 255, 0.16)",
                  backdropFilter: "blur(25px)",
                  WebkitBackdropFilter: "blur(25px)",
                  borderRadius: "18px",
                  padding: "14px 16px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>{n.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", opacity: 0.7 }}>{n.time}</span>
                    <button
                      onClick={() => handleDismiss(n.id)}
                      style={{ all: "unset", cursor: "pointer", opacity: 0.6 }}
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "12px", opacity: 0.9, lineHeight: 1.4 }}>{n.message}</div>

                {n.appId && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                    <button
                      onClick={() => {
                        onOpenApp(n.appId!);
                        onClose();
                      }}
                      style={{
                        all: "unset",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#fff",
                        background: accentColor,
                        padding: "3px 10px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <span>{n.actionText || "Open App"}</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
