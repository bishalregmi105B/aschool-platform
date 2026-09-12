"use client";

import React, { useMemo } from "react";
import {
  AOSLogo,
  AOSClassroomIcon,
  AOSGradebookIcon,
  AOSTimetableIcon,
  AOSLibraryIcon,
  AOSExamIcon,
  AOSCampusIcon,
  AOSNotebookIcon,
  AOSLabIcon,
  AOSTerminalIcon,
  AOSSettingsIcon,
} from "@/components/aos/AOSIcons";
import { Wifi, Volume2, Battery, Search, Layers, ChevronUp, GraduationCap, LayoutGrid } from "lucide-react";
import { WindowInstance } from "@/components/aos/types";
import { useServerTime } from "@/lib/use-server-time";

interface TaskbarProps {
  isStartOpen: boolean;
  onToggleStart: () => void;
  isQuickSettingsOpen: boolean;
  onToggleQuickSettings: () => void;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
  isWidgetsOpen: boolean;
  onToggleWidgets: () => void;
  windows: WindowInstance[];
  activeWindowId: string | null;
  onToggleWindow: (id: string) => void;
  onShowDesktop: () => void;
  accentColor?: string;
  taskbarAlign?: "center" | "left";
  onToggleAppDrawer?: () => void;
  onToggleAppSwitcher?: () => void;
}

export default function Taskbar({
  isStartOpen,
  onToggleStart,
  isQuickSettingsOpen,
  onToggleQuickSettings,
  isCalendarOpen,
  onToggleCalendar,
  isWidgetsOpen,
  onToggleWidgets,
  windows,
  activeWindowId,
  onToggleWindow,
  onShowDesktop,
  accentColor = "#0078d4",
  taskbarAlign = "center",
  onToggleAppDrawer,
  onToggleAppSwitcher,
}: TaskbarProps) {
  const serverTime = useServerTime();

  const { timeStr, dateStr } = useMemo(() => {
    const d = serverTime ? new Date(serverTime.epochMs) : new Date();
    return {
      timeStr: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      dateStr: d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" }),
    };
  }, [serverTime]);

  const defaultPinned = [
    { id: "classroom", title: "Live Classroom", icon: <AOSClassroomIcon size={24} /> },
    { id: "gradebook", title: "Gradebook & GPA Scorecard", icon: <AOSGradebookIcon size={24} /> },
    { id: "timetable", title: "Weekly Bell Timetable", icon: <AOSTimetableIcon size={24} /> },
    { id: "library", title: "Digital Knowledge Vault", icon: <AOSLibraryIcon size={24} /> },
    { id: "exam", title: "Assessment & Exam Center", icon: <AOSExamIcon size={24} /> },
    { id: "campus", title: "Campus Transit & Lunch", icon: <AOSCampusIcon size={24} /> },
    { id: "notebook", title: "Student Study Binder", icon: <AOSNotebookIcon size={24} /> },
    { id: "lab", title: "Science Lab Studio", icon: <AOSLabIcon size={24} /> },
    { id: "terminal", title: "CS Lab Terminal", icon: <AOSTerminalIcon size={24} /> },
    { id: "settings", title: "Student Settings", icon: <AOSSettingsIcon size={24} /> },
  ];

  return (
    <div className="win11-taskbar">
      {/* Left Area: AOS Academic Bell & Notice Board Pill */}
      <div
        style={{
          position: "absolute",
          left: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "38px",
          padding: "0 10px",
          borderRadius: "6px",
          cursor: "pointer",
          background: isWidgetsOpen ? "var(--w11-control-hover)" : "transparent",
          transition: "background 0.15s",
        }}
        onClick={onToggleWidgets}
        title="AOS Academic Dashboard & Notices"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "26px",
            height: "26px",
            borderRadius: "6px",
            background: "rgba(0,120,212,0.15)",
            color: "var(--w11-accent)",
          }}
        >
          <GraduationCap size={16} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
            Period 2: PHY-302
          </span>
          <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
            Lab 304 • 28m left
          </span>
        </div>
      </div>

      {/* Center Area: App Icons Cluster (Center or Left aligned) */}
      <div
        className="taskbar-center"
        style={{
          position: taskbarAlign === "center" ? "relative" : "absolute",
          left: taskbarAlign === "left" ? "190px" : undefined,
          transform: "none",
        }}
      >
        {/* AOS Launcher Button */}
        <div
          className={`taskbar-item ${isStartOpen ? "is-active" : ""}`}
          onClick={onToggleStart}
          title="AOS Academic Hub"
          style={{
            background: isStartOpen ? "var(--w11-control-hover)" : undefined,
          }}
        >
          <AOSLogo size={24} />
        </div>

        {/* Quick Search */}
        <div
          className="taskbar-item"
          onClick={onToggleStart}
          title="Search Courses, Teachers & Knowledge"
        >
          <Search size={18} color="var(--w11-text-primary)" />
        </div>

        {/* App Drawer Launcher */}
        {onToggleAppDrawer && (
          <div
            className="taskbar-item"
            onClick={onToggleAppDrawer}
            title="AOS App Drawer & Library"
          >
            <LayoutGrid size={18} color="var(--w11-text-primary)" />
          </div>
        )}

        {/* Task View / App Switcher */}
        {onToggleAppSwitcher && (
          <div
            className="taskbar-item"
            onClick={onToggleAppSwitcher}
            title="App Viewer & Multitasking Switcher"
          >
            <Layers size={18} color="var(--w11-text-primary)" />
          </div>
        )}

        {/* Pinned & Running AOS Apps */}
        {defaultPinned.map((app) => {
          const win = windows.find((w) => w.id === app.id);
          const isOpen = win && win.isOpen;
          const isFocused = isOpen && activeWindowId === app.id && !win.isMinimized;

          return (
            <div
              key={app.id}
              className={`taskbar-item ${isOpen ? "is-running" : ""} ${isFocused ? "is-focused" : ""}`}
              onClick={() => onToggleWindow(app.id)}
              title={app.title}
              style={{
                background: isFocused ? "var(--w11-control-hover)" : undefined,
                borderBottom: isFocused
                  ? `3px solid ${accentColor}`
                  : isOpen
                  ? "3px solid var(--w11-text-tertiary)"
                  : undefined,
              }}
            >
              {app.icon}
            </div>
          );
        })}
      </div>

      {/* Right Area: System Tray & Clock & Show Desktop */}
      <div className="taskbar-right">
        {/* Hidden Icons Chevron */}
        <div style={{ padding: "0 4px", cursor: "pointer" }} title="AOS Background Services">
          <ChevronUp size={14} color="var(--w11-text-secondary)" />
        </div>

        {/* Quick Settings Pill (Wi-Fi, Sound, Battery) */}
        <div
          className="tray-cluster"
          onClick={onToggleQuickSettings}
          title="AOS Action Center & Campus Controls"
          style={{
            background: isQuickSettingsOpen ? "var(--w11-control-hover)" : undefined,
          }}
        >
          <Wifi size={14} color="var(--w11-text-primary)" />
          <Volume2 size={14} color="var(--w11-text-primary)" />
          <Battery size={14} color="var(--w11-text-primary)" />
        </div>

        {/* Live Clock & Calendar */}
        <div
          className="clock-cluster"
          onClick={onToggleCalendar}
          title={`${dateStr} — AOS Academic Calendar & Notifications`}
          style={{
            background: isCalendarOpen ? "var(--w11-control-hover)" : undefined,
          }}
        >
          <span>{timeStr || "8:50 AM"}</span>
          <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>{dateStr || "9/12/2026"}</span>
        </div>

        {/* Show Desktop Line */}
        <div className="show-desktop-strip" onClick={onShowDesktop} title="Show Desktop" />
      </div>
    </div>
  );
}
