"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import {
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Navigation,
  DollarSign,
  Info,
  Calendar,
  CheckCheck,
} from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  formatTimeAgo,
  getCategoryIcon,
  type InAppNotification,
} from "@/lib/services/notifications.service";
import { AOSNotification } from "@/components/aos/types";
import { normalizeAOSRoute } from "@/lib/aos-navigation";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp?: (appId: string) => void;
  onOpenRoute?: (route: string) => void;
  accentColor?: string;
  notifications?: AOSNotification[];
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
}

export default function NotificationCenter({
  isOpen,
  onClose,
  onOpenApp,
  onOpenRoute,
  accentColor = "#0078d4",
  notifications: propNotifications,
  onClearAll: propOnClearAll,
  onDismiss: propOnDismiss,
}: NotificationCenterProps) {
  const router = useAOSRouterNavigate();
  const [liveNotifications, setLiveNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync notifications from backend service
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, count] = await Promise.all([
        fetchNotifications({ per_page: 25 }),
        fetchUnreadCount(),
      ]);
      setLiveNotifications(items);
      setUnreadCount(count);
    } catch {
      // Fallback or offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !propNotifications) {
      loadNotifications();
    }
  }, [isOpen, propNotifications, loadNotifications]);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    if (propOnClearAll) {
      propOnClearAll();
      return;
    }
    try {
      await markAllNotificationsRead();
      setLiveNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleDismiss = async (id: string) => {
    if (propOnDismiss) {
      propOnDismiss(id);
      return;
    }
    try {
      await markNotificationRead(id);
      setLiveNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      setLiveNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const handleItemClick = async (item: InAppNotification) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
    if (item.action_url) {
      const internalRoute = normalizeAOSRoute(item.action_url);
      if (internalRoute && onOpenRoute) {
        onOpenRoute(internalRoute);
      } else {
        router(item.action_url);
      }
      onClose();
    } else if (onOpenApp) {
      const appId = item.category === "fee" ? "finance" : item.category === "exam" ? "exam" : "classroom";
      onOpenApp(appId);
      onClose();
    }
  };

  const getCategorySymbol = (cat: string) => {
    switch (cat) {
      case "attendance":
        return <CheckCircle size={16} color="#10b981" />;
      case "fee":
        return <DollarSign size={16} color="#f59e0b" />;
      case "exam":
        return <AlertCircle size={16} color="#ef4444" />;
      case "notice":
        return <BookOpen size={16} color="#0078d4" />;
      case "system":
        return <Info size={16} color="#8b5cf6" />;
      default:
        return <Bell size={16} color="#0078d4" />;
    }
  };

  const hasPropItems = Array.isArray(propNotifications);
  const displayCount = hasPropItems ? propNotifications.length : unreadCount || liveNotifications.length;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9998,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "38px",
          right: "12px",
          bottom: "16px",
          width: "380px",
          maxWidth: "92vw",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(35px) saturate(180%)",
          WebkitBackdropFilter: "blur(35px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "16px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
          padding: "18px",
          zIndex: 9999,
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={18} color={accentColor} />
            <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--w11-text-primary)" }}>
              AOS Notification Center
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                background: "var(--w11-control-hover)",
                padding: "2px 8px",
                borderRadius: "10px",
                color: "var(--w11-text-secondary)",
              }}
            >
              {displayCount}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {displayCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="subtle"
                style={{
                  fontSize: "11px",
                  padding: "4px 8px",
                  color: "var(--w11-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
                title="Mark all as read"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-secondary)", padding: "4px" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {hasPropItems ? (
            propNotifications.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "8px" }}>
                <CheckCircle size={36} color="#10b981" />
                <div style={{ fontSize: "13px", fontWeight: 500 }}>All Caught Up</div>
                <div style={{ fontSize: "11px", color: "var(--w11-text-tertiary)" }}>No pending school alerts or deadlines</div>
              </div>
            ) : (
              propNotifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: "var(--w11-control-bg)",
                    border: "1px solid var(--w11-control-border)",
                    borderRadius: "12px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {getCategorySymbol(n.type)}
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                        {n.title}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>{n.time}</span>
                      <button
                        onClick={() => handleDismiss(n.id)}
                        style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-tertiary)" }}
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", lineHeight: 1.4 }}>
                    {n.message}
                  </div>

                  {n.actionText && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                      <button
                        className="accent"
                        onClick={() => {
                          if (onOpenApp) onOpenApp(n.appId);
                          onClose();
                        }}
                        style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px" }}
                      >
                        {n.actionText}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          ) : liveNotifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--w11-text-secondary)", gap: "8px" }}>
              <CheckCircle size={36} color="#10b981" />
              <div style={{ fontSize: "13px", fontWeight: 500 }}>
                {isLoading ? "Fetching Notifications..." : "All Caught Up"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--w11-text-tertiary)" }}>
                {isLoading ? "Checking campus updates..." : "No pending alerts or assignment notices"}
              </div>
            </div>
          ) : (
            liveNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  background: n.is_read ? "var(--w11-control-bg)" : "rgba(0,120,212,0.12)",
                  border: n.is_read ? "1px solid var(--w11-control-border)" : `1px solid ${accentColor}40`,
                  borderRadius: "12px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {getCategorySymbol(n.category)}
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                      {n.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
                      {formatTimeAgo(n.created_at)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(n.id);
                      }}
                      style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-tertiary)" }}
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", lineHeight: 1.4 }}>
                  {n.body}
                </div>

                {n.action_url && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                    <button
                      className="accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(n);
                      }}
                      style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px" }}
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
