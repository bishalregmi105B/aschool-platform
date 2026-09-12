"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Palette,
  Wifi,
  Shield,
  Sun,
  Moon,
  Check,
  GraduationCap,
  HardDrive,
  Layout,
  ChevronRight,
  ChevronLeft,
  Pin,
  PinOff,
  Sparkles,
} from "lucide-react";
import { SchoolRole, SCHOOL_PROFILES } from "../RoleSwitcherModal";
import {
  AOSClassroomIcon,
  AOSFileManagerIcon,
  AOSGradebookIcon,
  AOSTimetableIcon,
  AOSLibraryIcon,
  AOSExamIcon,
  AOSCampusIcon,
  AOSNotebookIcon,
  AOSLabIcon,
  AOSTerminalIcon,
  AOSAdminIcon,
  AOSFinanceIcon,
  AOSSettingsIcon,
} from "../AOSIcons";
import { useAuth } from "@/lib/auth-context";

export interface SettingsAppProps {
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
  accentColor?: string;
  onChangeAccent?: (color: string) => void;
  wallpaper?: string;
  onChangeWallpaper?: (wp: string) => void;
  dockStyle?: "mac" | "win11";
  onChangeDockStyle?: (style: "mac" | "win11") => void;
  dockSize?: "small" | "medium" | "large";
  onChangeDockSize?: (size: "small" | "medium" | "large") => void;
  showTopBar?: boolean;
  onToggleTopBar?: () => void;
  topBarHeight?: "compact" | "standard" | "large";
  onChangeTopBarHeight?: (h: "compact" | "standard" | "large") => void;
  blurIntensity?: number;
  onChangeBlurIntensity?: (val: number) => void;
  taskbarAlign?: "center" | "left";
  onToggleTaskbarAlign?: () => void;
  brightness?: number;
  onChangeBrightness?: (b: number) => void;
  currentRole?: SchoolRole;
  onOpenRoleSwitcher?: () => void;
  pinnedAppIds?: string[];
  onTogglePinApp?: (id: string) => void;
}

export default function SettingsApp({
  themeMode = "dark",
  onToggleTheme = () => {},
  accentColor = "#0078d4",
  onChangeAccent = () => {},
  wallpaper = "bloom-dark",
  onChangeWallpaper = () => {},
  dockStyle = "mac",
  onChangeDockStyle,
  dockSize = "medium",
  onChangeDockSize,
  showTopBar = true,
  onToggleTopBar,
  topBarHeight = "standard",
  onChangeTopBarHeight,
  blurIntensity = 30,
  onChangeBlurIntensity,
  taskbarAlign = "center",
  onToggleTaskbarAlign,
  brightness = 100,
  onChangeBrightness,
  currentRole = "student",
  onOpenRoleSwitcher = () => {},
  pinnedAppIds = ["classroom", "filemanager", "gradebook", "timetable", "library", "exam", "campus", "notebook", "lab", "terminal", "appstore", "settings"],
  onTogglePinApp,
}: SettingsAppProps) {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("personalization");
  const [mobileActiveSection, setMobileActiveSection] = useState<string | null>(null);
  const [examMode, setExamMode] = useState(false);
  const [customWallpaperInput, setCustomWallpaperInput] = useState("");
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Map backend user role or fallback to simulated profile
  const effectiveRole: SchoolRole = (user?.role as SchoolRole) in SCHOOL_PROFILES
    ? (user?.role as SchoolRole)
    : currentRole;

  const fallbackProfile = SCHOOL_PROFILES[effectiveRole] || SCHOOL_PROFILES.student;
  const profile = {
    id: user?.id ? `USR-${user.id.slice(0, 8).toUpperCase()}` : fallbackProfile.id,
    name: user?.full_name || fallbackProfile.name,
    role: effectiveRole,
    roleLabel: user?.role
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/_/g, " ")
      : fallbackProfile.roleLabel,
    department: user?.email || fallbackProfile.department,
    avatar: user?.full_name ? user.full_name.charAt(0).toUpperCase() : fallbackProfile.avatar,
    avatarUrl: user?.avatar_url,
    badgeColor: fallbackProfile.badgeColor,
    tagline: fallbackProfile.tagline,
    phone: user?.phone,
    schoolId: user?.school_id,
    language: user?.preferred_language || "en",
  };

  useEffect(() => {
    const checkScreen = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const colors = [
    { name: "Academic Blue", hex: "#0078d4" },
    { name: "Emerald Honor", hex: "#10b981" },
    { name: "Amethyst Scholar", hex: "#8b5cf6" },
    { name: "Amber Crimson", hex: "#d83b01" },
    { name: "Teal Science", hex: "#008272" },
    { name: "Midnight Navy", hex: "#1e3a8a" },
    { name: "Rose Gold", hex: "#f43f5e" },
    { name: "Cyber Cyan", hex: "#06b6d4" },
  ];

  const wallpapers = [
    { id: "bloom-dark", name: "Win11 Bloom Dark", desc: "Classic Deep Mica", preview: "#0b1220" },
    { id: "bloom-light", name: "Win11 Bloom Light", desc: "Daylight Mica", preview: "#e2e8f0" },
    { id: "sonoma", name: "macOS Sonoma Aurora", desc: "Vibrant Indigo Glass", preview: "linear-gradient(135deg, #1e1b4b, #4338ca)" },
    { id: "ventura", name: "macOS Ventura Sunburst", desc: "Warm Sunset Glow", preview: "linear-gradient(135deg, #ea580c, #c2410c)" },
    { id: "blueprint", name: "AOS Engineering Blueprint", desc: "Academic Technical", preview: "linear-gradient(135deg, #0f172a, #0284c7)" },
    { id: "nebula", name: "Cosmic Nebula", desc: "Astrophysics Deep Sky", preview: "linear-gradient(135deg, #09090b, #701a75)" },
    { id: "forest", name: "Emerald Campus Forest", desc: "Organic Botanical", preview: "linear-gradient(135deg, #022c22, #065f46)" },
    { id: "minimal", name: "Minimalist Slate", desc: "Zero Distraction Dark", preview: "linear-gradient(135deg, #18181b, #09090b)" },
  ];

  const pinnableApps = [
    { id: "classroom", name: "Live Classroom", desc: "Lecture streaming & whiteboard", icon: <AOSClassroomIcon size={28} /> },
    { id: "filemanager", name: "School Cloud Vault", desc: "Course materials & lab storage", icon: <AOSFileManagerIcon size={28} /> },
    { id: "gradebook", name: "Academic Gradebook", desc: "GPA scorecard & exams", icon: <AOSGradebookIcon size={28} /> },
    { id: "timetable", name: "Weekly Bell Timetable", desc: "Lecture schedule & rooms", icon: <AOSTimetableIcon size={28} /> },
    { id: "library", name: "Knowledge Vault", desc: "12,500+ research papers & e-books", icon: <AOSLibraryIcon size={28} /> },
    { id: "exam", name: "Assessment Center", desc: "Midterms & proctor quizzes", icon: <AOSExamIcon size={28} /> },
    { id: "campus", name: "Campus Transit", desc: "Fleet GPS tracking & cafeterias", icon: <AOSCampusIcon size={28} /> },
    { id: "notebook", name: "Study Notebook", desc: "Markdown notes & study binder", icon: <AOSNotebookIcon size={28} /> },
    { id: "lab", name: "Science Lab Studio", desc: "Interactive physics simulations", icon: <AOSLabIcon size={28} /> },
    { id: "terminal", name: "CS Lab Shell", desc: "Linux Bash shell & Python", icon: <AOSTerminalIcon size={28} /> },
    { id: "appstore", name: "AOS App Store", desc: "Educational plugin marketplace", icon: <Sparkles size={28} color="#0ea5e9" /> },
    { id: "settings", name: "AOS Settings", desc: "Personalization & customization", icon: <AOSSettingsIcon size={28} /> },
    ...(effectiveRole === "admin" ? [{ id: "admin", name: "Principal Hub", desc: "Executive command center", icon: <AOSAdminIcon size={28} /> }] : []),
    ...(effectiveRole === "accountant" ? [{ id: "finance", name: "Tuition Ledger", desc: "Accounts & student bursar", icon: <AOSFinanceIcon size={28} /> }] : []),
  ];

  const categories = [
    { id: "personalization", label: "Themes & Wallpapers", icon: <Palette size={16} />, desc: "Mica blur, dark mode, 8 wallpapers" },
    { id: "dock", label: "Dock, Taskbar & Top Bar", icon: <Layout size={16} />, desc: "Top bar height, dock style, pin apps" },
    { id: "profile", label: "User Account & Role", icon: <User size={16} />, desc: `${profile.name} (${profile.roleLabel})` },
    { id: "storage", label: "School Cloud Storage", icon: <HardDrive size={16} />, desc: "Vault space, cached lab files" },
    { id: "exammode", label: "Exam Focus Mode", icon: <Shield size={16} />, desc: "Proctor lockdown, distractions" },
    { id: "network", label: "Campus Network", icon: <Wifi size={16} />, desc: "5G Campus Wi-Fi & latency" },
    { id: "about", label: "About AOS", icon: <GraduationCap size={16} />, desc: "Version 3.4.0 (Dual-View)" },
  ];

  // ==========================================
  // MOBILE NAVIGATION LAYOUT (< 768px)
  // ==========================================
  if (isMobileScreen) {
    if (mobileActiveSection) {
      return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--w11-window-bg)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderBottom: "1px solid var(--w11-border-subtle)",
              background: "var(--w11-control-bg)",
            }}
          >
            <button
              className="subtle"
              onClick={() => setMobileActiveSection(null)}
              style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
            <div style={{ fontSize: "15px", fontWeight: 700, marginLeft: "auto", marginRight: "auto" }}>
              {categories.find((c) => c.id === mobileActiveSection)?.label}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {renderCategoryContent(mobileActiveSection)}
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: "100%", overflowY: "auto", background: "var(--w11-window-bg)", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: profile.badgeColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            {profile.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>{profile.name}</div>
            <div style={{ fontSize: "12px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => setMobileActiveSection(c.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--w11-card-bg)",
                border: "1px solid var(--w11-border-subtle)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ color: accentColor }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>{c.desc}</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--w11-text-tertiary)" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // DESKTOP TWO-COLUMN NAVIGATION LAYOUT
  // ==========================================
  return (
    <div style={{ display: "flex", height: "100%", background: "var(--w11-window-bg)" }}>
      {/* Left Navigation Sidebar */}
      <div
        style={{
          width: "240px",
          borderRight: "1px solid var(--w11-border-subtle)",
          background: "var(--w11-control-bg)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        {/* User Mini Profile Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px",
            borderRadius: "10px",
            background: "rgba(0,120,212,0.06)",
            marginBottom: "12px",
            border: "1px solid var(--w11-border-subtle)",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: profile.badgeColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {profile.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile.name}
            </div>
            <div style={{ fontSize: "11px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={activeCategory === c.id ? "accent" : "subtle"}
            style={{
              justifyContent: "flex-start",
              gap: "10px",
              fontSize: "13px",
              padding: "8px 12px",
            }}
          >
            {c.icon}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop Main Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {renderCategoryContent(activeCategory)}
      </div>
    </div>
  );

  // Helper renderer for each category
  function renderCategoryContent(catId: string) {
    switch (catId) {
      case "personalization":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Appearance & Themes</h2>

            {/* Dark / Light Toggle */}
            <div className="win11-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>System Appearance Mode</div>
                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                  Fluent 2 Mica High-Contrast Dark or Crisp Daylight Light theme.
                </div>
              </div>
              <button className="accent" onClick={onToggleTheme} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span>{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>

            {/* Wallpaper Selection Gallery */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                AOS Campus Wallpapers (8 Built-In Styles)
              </div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Choose high-resolution school campus or modern macOS / Windows aesthetic backgrounds.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                {wallpapers.map((wp) => {
                  const isSelected = wallpaper === wp.id;
                  return (
                    <div
                      key={wp.id}
                      onClick={() => onChangeWallpaper(wp.id)}
                      style={{
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: isSelected ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                        cursor: "pointer",
                        background: "var(--w11-control-bg)",
                        boxShadow: isSelected ? "0 4px 12px rgba(0,120,212,0.3)" : "none",
                      }}
                    >
                      <div
                        style={{
                          height: "65px",
                          background: wp.preview,
                          backgroundSize: "cover",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                        }}
                      >
                        {isSelected && (
                          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--w11-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={13} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700 }}>{wp.name}</div>
                        <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>{wp.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Image URL Wallpaper Input */}
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--w11-border-subtle)" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Custom School Photo URL Wallpaper:</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="https://example.com/school-aerial.jpg"
                    value={customWallpaperInput}
                    onChange={(e) => setCustomWallpaperInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="accent"
                    onClick={() => {
                      if (customWallpaperInput.trim()) {
                        onChangeWallpaper(customWallpaperInput.trim());
                      }
                    }}
                  >
                    Apply Photo
                  </button>
                </div>
              </div>
            </div>

            {/* Accent Color Palette */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>System Accent Color</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Fluent accents apply to active window borders, buttons, and parabolic dock highlights.
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {colors.map((c) => {
                  const isSelected = accentColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      onClick={() => onChangeAccent(c.hex)}
                      title={c.name}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: c.hex,
                        border: isSelected ? "3px solid #fff" : "none",
                        boxShadow: isSelected ? `0 0 0 2px ${c.hex}, 0 4px 10px rgba(0,0,0,0.3)` : "0 2px 4px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      {isSelected && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "dock":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Dock, Taskbar & macOS Top Bar</h2>

            {/* macOS Top Bar Toggle & Height */}
            <div className="win11-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>macOS Frosted Top Menu Bar</div>
                  <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                    Displays Apple/AOS menu, active app menu items, control center flyout, and clock.
                  </div>
                </div>
                <button className={showTopBar ? "accent" : "subtle"} onClick={onToggleTopBar}>
                  {showTopBar ? "Visible" : "Hidden"}
                </button>
              </div>

              {showTopBar && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>Top Bar Height Preset</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(["compact", "standard", "large"] as const).map((h) => (
                      <button
                        key={h}
                        className={topBarHeight === h ? "accent" : "subtle"}
                        onClick={() => onChangeTopBarHeight && onChangeTopBarHeight(h)}
                        style={{ fontSize: "11px", padding: "4px 10px", textTransform: "capitalize" }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dock Style: macOS Parabolic vs Win11 Centered Taskbar */}
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                Bottom Navigation Architecture
              </div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Switch between fluid parabolic magnification (macOS) and centered taskbar (Windows 11).
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div
                  onClick={() => onChangeDockStyle && onChangeDockStyle("mac")}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: dockStyle === "mac" ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                    background: dockStyle === "mac" ? "rgba(0,120,212,0.1)" : "var(--w11-control-bg)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                     macOS Parabolic Dock
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                    120 FPS magnetic cursor magnification curve and floating frosted glass shelf.
                  </div>
                </div>

                <div
                  onClick={() => onChangeDockStyle && onChangeDockStyle("win11")}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: dockStyle === "win11" ? "2px solid var(--w11-accent)" : "1px solid var(--w11-border-subtle)",
                    background: dockStyle === "win11" ? "rgba(0,120,212,0.1)" : "var(--w11-control-bg)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                    ⊞ Windows 11 Taskbar
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                    Centered app badges, Start menu button, and tray clock.
                  </div>
                </div>
              </div>

              {/* Dock Icon Scale */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Dock Icon Scale</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["small", "medium", "large"] as const).map((sz) => (
                    <button
                      key={sz}
                      className={dockSize === sz ? "accent" : "subtle"}
                      onClick={() => onChangeDockSize && onChangeDockSize(sz)}
                      style={{ fontSize: "11px", padding: "4px 10px", textTransform: "capitalize" }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taskbar Alignment for Win11 mode */}
              {dockStyle === "win11" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>Taskbar Alignment</span>
                  <button className="subtle" onClick={onToggleTaskbarAlign} style={{ fontSize: "12px" }}>
                    {taskbarAlign === "center" ? "Centered" : "Left-Aligned"}
                  </button>
                </div>
              )}

              {/* Acrylic Blur Slider */}
              <div style={{ borderTop: "1px solid var(--w11-border-subtle)", paddingTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 600 }}>Mica & Acrylic Blur Intensity</span>
                  <span>{blurIntensity}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={blurIntensity}
                  onChange={(e) => onChangeBlurIntensity && onChangeBlurIntensity(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Dock Icon Pinning & Customization Panel */}
            <div className="win11-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Dock Icon Pinning Manager</div>
                <span style={{ fontSize: "11px", color: accentColor, fontWeight: 700 }}>
                  {pinnedAppIds.length} Apps Pinned
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginBottom: "14px" }}>
                Select which educational apps appear pinned to the bottom shelf.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pinnableApps.map((app) => {
                  const isPinned = pinnedAppIds.includes(app.id);
                  return (
                    <div
                      key={app.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--w11-control-bg)",
                        borderRadius: "8px",
                        border: "1px solid var(--w11-border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {app.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{app.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>{app.desc}</div>
                        </div>
                      </div>

                      <button
                        className={isPinned ? "accent" : "subtle"}
                        onClick={() => onTogglePinApp && onTogglePinApp(app.id)}
                        style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
                        <span>{isPinned ? "Pinned" : "Pin"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "profile":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>User Account & Role</h2>
            <div className="win11-card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: profile.badgeColor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 700,
                  overflow: "hidden",
                }}
              >
                {profile.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.avatar
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "17px", fontWeight: 700 }}>{profile.name}</div>
                <div style={{ fontSize: "13px", color: profile.badgeColor, fontWeight: 600 }}>{profile.roleLabel}</div>
                <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "4px" }}>
                  {profile.department} • Active Station
                </div>
              </div>
              <button className="accent" onClick={onOpenRoleSwitcher}>
                Switch Role
              </button>
            </div>

            {/* Account Details */}
            <div className="win11-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Authentication & Identity Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>User ID</div>
                  <div style={{ fontWeight: 600 }} className="font-mono">{profile.id}</div>
                </div>
                <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>Assigned Role</div>
                  <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{profile.roleLabel}</div>
                </div>
                {profile.phone && (
                  <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>Registered Mobile</div>
                    <div style={{ fontWeight: 600 }}>{profile.phone}</div>
                  </div>
                )}
                {profile.schoolId && (
                  <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>School Tenant</div>
                    <div style={{ fontWeight: 600 }} className="font-mono">{profile.schoolId}</div>
                  </div>
                )}
                <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>Interface Language</div>
                  <div style={{ fontWeight: 600 }}>{profile.language.toUpperCase()}</div>
                </div>
                <div style={{ background: "var(--w11-control-bg)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--w11-text-secondary)", marginBottom: "2px" }}>Session Protocol</div>
                  <div style={{ fontWeight: 600, color: "#10b981" }}>HttpOnly TLS Cookie</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "storage":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>School Cloud Vault</h2>
            <div className="win11-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>Storage Utilization</span>
                <span style={{ fontWeight: 700 }}>84.2 GB / 128 GB</span>
              </div>
              <div style={{ height: "8px", background: "var(--w11-border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: "65%", height: "100%", background: accentColor }} />
              </div>
            </div>
          </div>
        );

      case "exammode":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Exam Proctor & Focus Mode</h2>
            <div className="win11-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Workstation Proctor Lockdown</div>
                <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>
                  Blocks unauthorized tabs and locks screen to Exam Assessment.
                </div>
              </div>
              <button
                className={examMode ? "accent" : "subtle"}
                onClick={() => setExamMode(!examMode)}
                style={{ background: examMode ? "#ef4444" : undefined }}
              >
                {examMode ? "Lockdown Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        );

      case "network":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Campus Network</h2>
            <div className="win11-card">
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#10b981" }}>Connected: Campus-5G-Enterprise</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "4px" }}>
                Signal: 100% • Encryption: WPA3 Academic Enterprise
              </div>
            </div>
          </div>
        );

      case "about":
      default:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>About AOS (A School OS)</h2>
            <div className="win11-card">
              <div style={{ fontSize: "16px", fontWeight: 700, color: accentColor }}>AOS Workstation Release 3.4.0</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
                A modern hybrid Operating System environment combining macOS glass elegance with Windows 11 Fluent 2 power and iOS mobile agility for next-generation school management systems.
              </div>
              <div style={{ fontSize: "11px", color: "var(--w11-text-tertiary)", marginTop: "12px" }}>
                (C) 2026 ASchool Platform. All rights reserved.
              </div>
            </div>
          </div>
        );
    }
  }
}
