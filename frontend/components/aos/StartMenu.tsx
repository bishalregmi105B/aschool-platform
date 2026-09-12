"use client";

import React, { useState } from "react";
import {
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
import { Search, Power, FileText, BookOpen, Shield, Moon, LogOut, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (appId: string) => void;
  accentColor?: string;
}

export default function StartMenu({
  isOpen,
  onClose,
  onOpenApp,
  accentColor = "#0078d4",
}: StartMenuProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPowerMenu, setShowPowerMenu] = useState(false);

  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const userName = user?.full_name || "Bishal Regmi";
  const userRole = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : "Student";
  const userInitial = userName.charAt(0).toUpperCase() || "A";

  const pinnedApps = [
    { id: "classroom", name: "Live Classroom", icon: <AOSClassroomIcon size={34} /> },
    { id: "gradebook", name: "Gradebook", icon: <AOSGradebookIcon size={34} /> },
    { id: "timetable", name: "Bell Timetable", icon: <AOSTimetableIcon size={34} /> },
    { id: "library", name: "Knowledge Vault", icon: <AOSLibraryIcon size={34} /> },
    { id: "exam", name: "Exam Center", icon: <AOSExamIcon size={34} /> },
    { id: "campus", name: "Campus Transit", icon: <AOSCampusIcon size={34} /> },
    { id: "notebook", name: "Study Notebook", icon: <AOSNotebookIcon size={34} /> },
    { id: "lab", name: "Lab Studio", icon: <AOSLabIcon size={34} /> },
    { id: "terminal", name: "CS Terminal", icon: <AOSTerminalIcon size={34} /> },
    { id: "settings", name: "Student Settings", icon: <AOSSettingsIcon size={34} /> },
  ];

  const filteredApps = pinnedApps.filter((app) =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recommendedFiles = [
    { name: "Quantum-Physics-Notes.md", time: "Edited 10m ago", icon: <FileText size={20} color="#0078d4" />, appId: "notebook" },
    { name: "Midterm-Review-Physics.pdf", time: "Opened 1h ago", icon: <BookOpen size={20} color="#10b981" />, appId: "library" },
    { name: "Calculus-Problem-Set-4.txt", time: "30m ago", icon: <FileText size={20} color="#8b5cf6" />, appId: "notebook" },
    { name: "Periodic-Table-Formula-Sheet.pdf", time: "Yesterday", icon: <BookOpen size={20} color="#f59e0b" />, appId: "lab" },
  ];

  const handleLogout = () => {
    try {
      logout();
    } catch {
      window.location.href = "/login";
    }
  };

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

      {/* Start Menu Container */}
      <div
        className="win11-startmenu is-open animate-flyout-in"
        onClick={(e) => {
          e.stopPropagation();
          if (showPowerMenu) setShowPowerMenu(false);
        }}
      >
        {/* Search Bar */}
        <div className="start-search" style={{ borderBottom: searchTerm ? `2px solid ${accentColor}` : undefined }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search courses, professors, assignments, or apps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* Pinned Section */}
        <div className="start-pinned">
          <div className="start-section-header">
            <span>AOS Academic Suite</span>
            <button onClick={() => {}}>All Modules &gt;</button>
          </div>

          <div className="start-grid-6">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="start-app-tile"
                onClick={() => {
                  onOpenApp(app.id);
                  onClose();
                }}
              >
                <div>{app.icon}</div>
                <span>{app.name}</span>
              </div>
            ))}
          </div>

          {/* Recommended Section */}
          <div style={{ marginTop: "20px" }}>
            <div className="start-section-header">
              <span>Recent Academic Files & Lectures</span>
              <button onClick={() => {}}>Vault &gt;</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {recommendedFiles.map((file) => (
                <div
                  key={file.name}
                  onClick={() => {
                    onOpenApp(file.appId);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {file.icon}
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--w11-text-primary)" }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                      {file.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Power & Profile Bar */}
        <div className="start-powerbar" style={{ position: "relative" }}>
          <div
            className="user-profile"
            onClick={() => {
              onOpenApp("settings");
              onClose();
            }}
          >
            <div className="avatar" style={{ background: "linear-gradient(135deg, #0078d4, #005a9e)" }}>
              {userInitial}
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                {userName}
              </div>
              <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
                {userRole} • ASchool Station
              </div>
            </div>
          </div>

          <button
            className="power-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowPowerMenu(!showPowerMenu);
            }}
            title="AOS Session Controls"
          >
            <Power size={18} />
          </button>

          {/* Power Options Menu */}
          {showPowerMenu && (
            <div
              style={{
                position: "absolute",
                bottom: "64px",
                right: "32px",
                width: "180px",
                background: "var(--w11-surface-flyout)",
                backdropFilter: "blur(25px)",
                border: "1px solid var(--w11-acrylic-border)",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                padding: "6px",
                zIndex: 10001,
              }}
            >
              <div
                onClick={() => {
                  alert("Exam Lockdown Mode enabled: Screen locked to assessment session.");
                  setShowPowerMenu(false);
                }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", color: "var(--w11-text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Shield size={14} color="#0078d4" /> <span>Exam Lock</span>
              </div>
              <div
                onClick={() => {
                  alert("Putting AOS Workstation into study standby...");
                  setShowPowerMenu(false);
                }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", color: "var(--w11-text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Moon size={14} /> <span>Sleep / Standby</span>
              </div>
              <div
                onClick={() => {
                  setShowPowerMenu(false);
                  handleLogout();
                }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", color: "#f59e0b" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <LogOut size={14} color="#f59e0b" /> <span>Log Out {userName}</span>
              </div>
              <div
                onClick={() => {
                  alert("Restarting AOS workstation...");
                  setShowPowerMenu(false);
                }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", color: "#ef4444" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <RotateCcw size={14} color="#ef4444" /> <span>Restart System</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
