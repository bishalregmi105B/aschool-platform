"use client";

import React, { useState } from "react";
import {
  Wifi,
  Volume2,
  Sun,
  Moon,
  Bluetooth,
  Radio,
  Plane,
  Play,
  Pause,
  SkipForward,
  Shield,
  Terminal,
  Bell,
  Sliders,
  X,
  Sparkles,
} from "lucide-react";

interface IOSControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  brightness: number;
  onChangeBrightness: (b: number) => void;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  accentColor: string;
  onOpenApp: (appId: string) => void;
}

export default function IOSControlCenter({
  isOpen,
  onClose,
  brightness,
  onChangeBrightness,
  themeMode,
  onToggleTheme,
  accentColor,
  onOpenApp,
}: IOSControlCenterProps) {
  const [wifiOn, setWifiOn] = useState(true);
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [airplaneOn, setAirplaneOn] = useState(false);
  const [cellularOn, setCellularOn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(75);
  const [examFocus, setExamFocus] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="ios-control-center-overlay" onClick={onClose}>
      <div className="ios-control-center-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700 }}>
            <Sliders size={16} color={accentColor} />
            <span>AOS Control Center</span>
          </div>
          <button
            onClick={onClose}
            style={{
              all: "unset",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Top 2 Clusters: Connectivity & Media */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* 2x2 Network Cluster */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {/* Airplane Mode */}
            <div
              onClick={() => setAirplaneOn(!airplaneOn)}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: airplaneOn ? "#f59e0b" : "rgba(255, 255, 255, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                margin: "0 auto",
                transition: "background 0.15s ease",
              }}
              title="Airplane Mode"
            >
              <Plane size={20} />
            </div>

            {/* Campus 5G Cellular */}
            <div
              onClick={() => setCellularOn(!cellularOn)}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: cellularOn ? "#10b981" : "rgba(255, 255, 255, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                margin: "0 auto",
                transition: "background 0.15s ease",
              }}
              title="Campus 5G Cellular"
            >
              <Radio size={20} />
            </div>

            {/* Campus Wi-Fi */}
            <div
              onClick={() => setWifiOn(!wifiOn)}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: wifiOn ? "#0284c7" : "rgba(255, 255, 255, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                margin: "0 auto",
                transition: "background 0.15s ease",
              }}
              title="Campus Secure Wi-Fi"
            >
              <Wifi size={20} />
            </div>

            {/* Bluetooth */}
            <div
              onClick={() => setBluetoothOn(!bluetoothOn)}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: bluetoothOn ? "#3b82f6" : "rgba(255, 255, 255, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                margin: "0 auto",
                transition: "background 0.15s ease",
              }}
              title="Bluetooth Lab Headset"
            >
              <Bluetooth size={20} />
            </div>
          </div>

          {/* Academic Lecture Media Card */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "14px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: 600 }}>CAMPUS AUDIO</div>
              <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Lecture & Notices
              </div>
              <div style={{ fontSize: "10px", color: "#d4d4d8" }}>Live Stream Broadcast</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginTop: "8px" }}>
              <div
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: "2px" }} />}
              </div>
              <div
                onClick={() => alert("Advancing to next academic audio stream.")}
                style={{ cursor: "pointer", opacity: 0.8 }}
              >
                <SkipForward size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Focus Exam Mode & Theme Mode */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Exam Focus Pill */}
          <div
            onClick={() => setExamFocus(!examFocus)}
            style={{
              background: examFocus ? "#ef4444" : "rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={20} />
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Exam Focus</span>
            </div>
            <span style={{ fontSize: "11px", opacity: 0.85 }}>
              {examFocus ? "Proctor Lockdown Active" : "Off • Tap to Lock"}
            </span>
          </div>

          {/* Theme Mode Toggle Pill */}
          <div
            onClick={onToggleTheme}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {themeMode === "dark" ? <Moon size={20} /> : <Sun size={20} />}
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Appearance</span>
            </div>
            <span style={{ fontSize: "11px", opacity: 0.85 }}>
              {themeMode === "dark" ? "Dark Mode (Mica)" : "Light Mode"}
            </span>
          </div>
        </div>

        {/* Vertical Brightness & Volume Sliders */}
        <div style={{ display: "flex", justifyContent: "space-around", gap: "16px", padding: "6px 0" }}>
          {/* Brightness Slider */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div
              className="ios-vertical-slider"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const pct = Math.max(10, Math.min(100, Math.round((1 - clickY / rect.height) * 100)));
                onChangeBrightness(pct);
              }}
            >
              <div
                className="ios-vertical-slider-fill"
                style={{ height: `${brightness}%` }}
              />
              <Sun size={20} color="#000000" style={{ position: "relative", zIndex: 10 }} />
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{brightness}%</span>
          </div>

          {/* Volume Slider */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div
              className="ios-vertical-slider"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const pct = Math.max(0, Math.min(100, Math.round((1 - clickY / rect.height) * 100)));
                setVolume(pct);
              }}
            >
              <div
                className="ios-vertical-slider-fill"
                style={{ height: `${volume}%` }}
              />
              <Volume2 size={20} color="#000000" style={{ position: "relative", zIndex: 10 }} />
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{volume}%</span>
          </div>
        </div>

        {/* Quick Utilities Row */}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px" }}>
          <div
            onClick={() => {
              onOpenApp("transport");
              onClose();
            }}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Transport Radar"
          >
            <Radio size={22} />
          </div>

          <div
            onClick={() => {
              onOpenApp("marketplace");
              onClose();
            }}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="AOS App Store"
          >
            <Sparkles size={22} />
          </div>

          <div
            onClick={() => {
              onOpenApp("timetable");
              onClose();
            }}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Bell Timetable"
          >
            <Bell size={22} />
          </div>

          <div
            onClick={() => {
              onOpenApp("settings");
              onClose();
            }}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="AOS Settings"
          >
            <Sliders size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}
