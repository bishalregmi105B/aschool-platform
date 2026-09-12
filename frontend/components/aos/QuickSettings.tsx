"use client";

import React, { useState } from "react";
import {
  Wifi,
  Bluetooth,
  Shield,
  Moon,
  Clock,
  BellOff,
  Volume2,
  VolumeX,
  Sun,
  Settings,
  Battery,
} from "lucide-react";

interface QuickSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  brightness?: number;
  onChangeBrightness?: (b: number) => void;
  onOpenSettings?: () => void;
}

export default function QuickSettings({
  isOpen,
  onClose,
  accentColor = "#0078d4",
  brightness = 100,
  onChangeBrightness = () => {},
  onOpenSettings = () => {},
}: QuickSettingsProps) {
  const [toggles, setToggles] = useState({
    wifi: true,
    bluetooth: true,
    examLock: false,
    focus: true,
    nightlight: false,
    silentClass: true,
  });
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);

  if (!isOpen) return null;

  const toggleItem = (key: keyof typeof toggles) => {
    setToggles({ ...toggles, [key]: !toggles[key] });
  };

  const toggleItems = [
    { key: "wifi" as const, label: "Campus WiFi", sublabel: "Campus-5G-Sec", icon: <Wifi size={18} /> },
    { key: "bluetooth" as const, label: "Smartpen/Lab", sublabel: "Connected", icon: <Bluetooth size={18} /> },
    { key: "examLock" as const, label: "Exam Lock", sublabel: "Ready", icon: <Shield size={18} /> },
    { key: "focus" as const, label: "Study Focus", sublabel: "Active", icon: <Clock size={18} /> },
    { key: "nightlight" as const, label: "Eye Comfort", sublabel: "Warm", icon: <Moon size={18} /> },
    { key: "silentClass" as const, label: "Lecture DND", sublabel: "Muted", icon: <BellOff size={18} /> },
  ];

  return (
    <>
      {/* Backdrop */}
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

      {/* Flyout Window */}
      <div
        style={{
          position: "fixed",
          bottom: "56px",
          right: "12px",
          width: "360px",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "12px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
          padding: "16px",
          zIndex: 9999,
          userSelect: "none",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toggle Tiles Grid (3x2) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {toggleItems.map((item) => {
            const active = toggles[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggleItem(item.key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 6px",
                  borderRadius: "8px",
                  background: active ? accentColor : "var(--w11-control-bg)",
                  color: active ? "#ffffff" : "var(--w11-text-primary)",
                  border: active ? `1px solid ${accentColor}` : "1px solid var(--w11-control-border)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "var(--w11-control-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "var(--w11-control-bg)";
                }}
              >
                <div style={{ marginBottom: "6px" }}>{item.icon}</div>
                <div style={{ fontSize: "11px", fontWeight: 600, lineHeight: 1.2 }}>{item.label}</div>
                <div style={{ fontSize: "10px", opacity: 0.75, marginTop: "2px" }}>{item.sublabel}</div>
              </div>
            );
          })}
        </div>

        {/* Sliders Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
          {/* Brightness Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Sun size={18} color="var(--w11-text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="range"
              min="20"
              max="100"
              value={brightness}
              onChange={(e) => onChangeBrightness(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: accentColor,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "11px", width: "32px", textAlign: "right", color: "var(--w11-text-secondary)" }}>
              {brightness}%
            </span>
          </div>

          {/* Volume Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div onClick={() => setIsMuted(!isMuted)} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              {isMuted || volume === 0 ? (
                <VolumeX size={18} color="#ef4444" />
              ) : (
                <Volume2 size={18} color="var(--w11-text-secondary)" />
              )}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              style={{
                width: "100%",
                accentColor: accentColor,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "11px", width: "32px", textAlign: "right", color: "var(--w11-text-secondary)" }}>
              {isMuted ? 0 : volume}%
            </span>
          </div>
        </div>

        {/* Footer info: Battery & Settings link */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "12px",
            borderTop: "1px solid var(--w11-control-border)",
            fontSize: "12px",
            color: "var(--w11-text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Battery size={16} color="#10b981" />
            <span>98% • Academic Performance Mode</span>
          </div>

          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "4px",
              color: "var(--w11-text-primary)",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            title="All Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
