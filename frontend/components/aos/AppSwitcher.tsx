"use client";

import React from "react";
import { WindowInstance } from "@/components/aos/types";
import { X, ExternalLink, Layers, LayoutGrid, Check } from "lucide-react";

interface AppSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  windows: WindowInstance[];
  activeWindowId: string | null;
  onFocusWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onCloseAll: () => void;
  accentColor?: string;
}

export default function AppSwitcher({
  isOpen,
  onClose,
  windows,
  activeWindowId,
  onFocusWindow,
  onCloseWindow,
  onCloseAll,
  accentColor = "#0078d4",
}: AppSwitcherProps) {
  if (!isOpen) return null;

  const openWindows = windows.filter((w) => w.isOpen);

  return (
    <div className="aos-app-switcher-overlay" onClick={onClose}>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Switcher Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "90%",
            maxWidth: "1000px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers size={22} color={accentColor} />
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--w11-text-primary)",
              }}
            >
              AOS App Viewer & Switcher
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "10px",
                background: "var(--w11-control-hover)",
                color: "var(--w11-text-secondary)",
              }}
            >
              {openWindows.length} Running
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {openWindows.length > 0 && (
              <button
                className="subtle"
                onClick={onCloseAll}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Close All Apps
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                all: "unset",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--w11-text-primary)",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Horizontal Card Deck */}
        {openWindows.length === 0 ? (
          <div
            style={{
              padding: "60px 30px",
              background: "var(--w11-surface-flyout)",
              backdropFilter: "blur(30px)",
              border: "1px solid var(--w11-acrylic-border)",
              borderRadius: "20px",
              textAlign: "center",
              color: "var(--w11-text-secondary)",
            }}
          >
            <LayoutGrid size={44} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: "16px", fontWeight: 600 }}>No Active Applications</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Launch an educational module from the Dock or App Drawer
            </div>
          </div>
        ) : (
          <div className="aos-app-switcher-deck">
            {openWindows.map((win) => {
              const isActive = win.id === activeWindowId;

              return (
                <div
                  key={win.id}
                  className={`aos-app-switcher-card ${isActive ? "is-active" : ""}`}
                  onClick={() => onFocusWindow(win.id)}
                >
                  {/* Card Titlebar */}
                  <div className="aos-app-switcher-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                      <div style={{ flexShrink: 0 }}>{win.icon}</div>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--w11-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {win.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseWindow(win.id);
                      }}
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        color: "var(--w11-text-secondary)",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Close window"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Card Body / Simulated Mini Preview */}
                  <div className="aos-app-switcher-preview">
                    <div
                      style={{
                        transform: "scale(1.3)",
                        opacity: 0.9,
                        marginBottom: "8px",
                      }}
                    >
                      {win.icon}
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--w11-text-primary)",
                        textAlign: "center",
                        maxWidth: "90%",
                      }}
                    >
                      {win.title}
                    </div>

                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--w11-text-secondary)",
                        textAlign: "center",
                      }}
                    >
                      {isActive ? "Currently in focus" : "Running in background"}
                    </div>

                    {isActive && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "6px",
                          background: `${accentColor}25`,
                          border: `1px solid ${accentColor}50`,
                          color: accentColor,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <Check size={10} />
                        <span>ACTIVE</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
