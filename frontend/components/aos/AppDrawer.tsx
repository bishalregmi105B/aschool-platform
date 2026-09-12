"use client";

import React, { useState, useMemo } from "react";
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
  AOSLogo,
} from "@/components/aos/AOSIcons";
import { Search, X, Grid, Sparkles, Box } from "lucide-react";
import { SchoolRole, EducationalPlugin } from "@/components/aos/types";
import { useInstalledPlugins } from "@/lib/plugins";

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (appId: string) => void;
  currentRole?: SchoolRole;
  accentColor?: string;
  plugins?: EducationalPlugin[];
}

interface AppDrawerItem {
  id: string;
  name: string;
  category: "academics" | "stem" | "admin" | "campus";
  icon: React.ReactNode;
  badge?: string;
  desc: string;
}

export default function AppDrawer({
  isOpen,
  onClose,
  onOpenApp,
  currentRole = "student",
  accentColor = "#0078d4",
  plugins = [],
}: AppDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { sidebarItems, installedPlugins } = useInstalledPlugins();

  const allApps: AppDrawerItem[] = useMemo(() => {
    const core: AppDrawerItem[] = [
      {
        id: "classroom",
        name: "Live Classroom",
        category: "academics",
        icon: <AOSClassroomIcon size={52} />,
        badge: "LIVE",
        desc: "Interactive lecture streaming & whiteboard",
      },
      {
        id: "filemanager",
        name: "School Vault",
        category: "academics",
        icon: <AOSFileManagerIcon size={52} />,
        desc: "Course cloud storage, lab notes & textbooks",
      },
      {
        id: "gradebook",
        name: "Gradebook & GPA",
        category: "academics",
        icon: <AOSGradebookIcon size={52} />,
        badge: "3.98",
        desc: "Continuous assessment & transcript tracking",
      },
      {
        id: "timetable",
        name: "Weekly Timetable",
        category: "academics",
        icon: <AOSTimetableIcon size={52} />,
        desc: "Live period schedules & lecture hall directions",
      },
      {
        id: "exam",
        name: "Assessment Center",
        category: "academics",
        icon: <AOSExamIcon size={52} />,
        desc: "Timed quizzes, term midterms & scorecards",
      },
      {
        id: "lab",
        name: "Science Lab Studio",
        category: "stem",
        icon: <AOSLabIcon size={52} />,
        desc: "Interactive physics & chemistry simulations",
      },
      {
        id: "terminal",
        name: "CS Lab Shell",
        category: "stem",
        icon: <AOSTerminalIcon size={52} />,
        desc: "Linux terminal, Python interpreter & CS lab",
      },
      {
        id: "library",
        name: "Knowledge Vault",
        category: "stem",
        icon: <AOSLibraryIcon size={52} />,
        desc: "Research publications, digital textbooks & JSTOR",
      },
      {
        id: "notebook",
        name: "Study Notebook",
        category: "campus",
        icon: <AOSNotebookIcon size={52} />,
        desc: "Markdown notes, revision summaries & binder",
      },
      {
        id: "campus",
        name: "Campus Fleet GPS",
        category: "campus",
        icon: <AOSCampusIcon size={52} />,
        desc: "Bus arrival times, dining menus & campus map",
      },
      ...(currentRole === "admin"
        ? [
            {
              id: "admin",
              name: "Principal Command",
              category: "admin" as const,
              icon: <AOSAdminIcon size={52} />,
              badge: "EXEC",
              desc: "Campus security, faculty roster & broadcasts",
            },
          ]
        : []),
      ...(currentRole === "accountant" || currentRole === "admin"
        ? [
            {
              id: "finance",
              name: "Tuition & Bursar",
              category: "admin" as const,
              icon: <AOSFinanceIcon size={52} />,
              badge: "CPA",
              desc: "Tuition accounts, operating budget & receipts",
            },
          ]
        : []),
      {
        id: "appstore",
        name: "App Store",
        category: "campus",
        icon: (
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 6px 16px rgba(14, 165, 233, 0.4)",
            }}
          >
            <Sparkles size={28} />
          </div>
        ),
        badge: "STORE",
        desc: "Educational extensions, AI simulators & tools",
      },
      {
        id: "settings",
        name: "AOS Settings",
        category: "admin",
        icon: <AOSSettingsIcon size={52} />,
        desc: "System preferences, security & themes",
      },
    ];

    // Add passed plugins
    const pluginList: AppDrawerItem[] = plugins
      .filter((p) => p.isInstalled && p.isActive && (p.allowedRoles.includes(currentRole) || currentRole === "admin"))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: (p.category === "STEM & Science" ? "stem" : p.category === "School Operations" ? "admin" : "campus") as "academics" | "stem" | "admin" | "campus",
        icon: (
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: p.accent || "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: `0 6px 16px ${p.accent || "#0284c7"}50`,
            }}
          >
            {p.icon}
          </div>
        ),
        badge: p.tier === "premium" ? "PRO" : undefined,
        desc: p.description,
      }));

    // Add plugin sidebar items from useInstalledPlugins()
    const sidebarList: AppDrawerItem[] = (sidebarItems || []).map((s) => ({
      id: s.slug,
      name: s.label,
      category: "academics" as const,
      icon: (
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 6px 16px rgba(16, 185, 129, 0.4)",
          }}
        >
          <Box size={28} />
        </div>
      ),
      badge: "PLUGIN",
      desc: s.section ? `${s.section} module` : "Installed ASchool Module",
    }));

    return [...core, ...pluginList, ...sidebarList];
  }, [currentRole, plugins, sidebarItems]);

  if (!isOpen) return null;

  const filteredApps = allApps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === "all" || app.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <>
      {/* Dark Blurred Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(25px) saturate(160%)",
          WebkitBackdropFilter: "blur(25px) saturate(160%)",
          zIndex: 10003,
        }}
      />

      {/* Main Drawer Overlay Container */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "860px",
          maxWidth: "94vw",
          height: "640px",
          maxHeight: "88vh",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "20px",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.5)",
          padding: "24px 28px",
          zIndex: 10004,
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AOSLogo size={24} />
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--w11-text-primary)", lineHeight: 1.1 }}>
                AOS App Drawer & Academic Library
              </div>
              <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                Installed Modules, Plugins & Campus Tools
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              all: "unset",
              cursor: "pointer",
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: "var(--w11-control-hover)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--w11-text-primary)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Toolbar: Search + Category Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--w11-control-bg)",
              border: "1px solid var(--w11-control-border)",
              borderRadius: "10px",
              padding: "6px 12px",
              width: "280px",
            }}
          >
            <Search size={15} color="var(--w11-text-tertiary)" />
            <input
              type="text"
              placeholder="Search apps, modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                all: "unset",
                fontSize: "13px",
                color: "var(--w11-text-primary)",
                width: "100%",
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-tertiary)", display: "flex" }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {[
              { id: "all", label: "All Apps" },
              { id: "academics", label: "Academics" },
              { id: "stem", label: "STEM & Labs" },
              { id: "campus", label: "Campus Life" },
              { id: "admin", label: "Operations" },
            ].map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: active ? 600 : 500,
                    padding: "5px 12px",
                    borderRadius: "14px",
                    background: active ? accentColor : "var(--w11-control-bg)",
                    color: active ? "#ffffff" : "var(--w11-text-primary)",
                    border: active ? `1px solid ${accentColor}` : "1px solid var(--w11-control-border)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Apps Grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
            gap: "16px",
            padding: "8px 4px 16px 4px",
          }}
        >
          {filteredApps.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "260px",
                color: "var(--w11-text-secondary)",
                gap: "8px",
              }}
            >
              <Grid size={36} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: "14px", fontWeight: 600 }}>No applications found</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-tertiary)" }}>
                Try searching for something else
              </div>
            </div>
          ) : (
            filteredApps.map((app) => (
              <div
                key={app.id}
                onClick={() => {
                  onOpenApp(app.id);
                  onClose();
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px 10px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--w11-control-hover)";
                  e.currentTarget.style.transform = "scale(1.04) translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.transform = "none";
                }}
              >
                {/* Badge if present */}
                {app.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "12px",
                      fontSize: "9px",
                      fontWeight: 800,
                      background: accentColor,
                      color: "#fff",
                      padding: "1px 5px",
                      borderRadius: "6px",
                      boxShadow: `0 2px 6px ${accentColor}60`,
                    }}
                  >
                    {app.badge}
                  </span>
                )}

                <div style={{ marginBottom: "10px" }}>{app.icon}</div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--w11-text-primary)",
                    lineHeight: 1.2,
                    marginBottom: "3px",
                  }}
                >
                  {app.name}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--w11-text-secondary)",
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {app.desc}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            borderTop: "1px solid var(--w11-border-subtle)",
            paddingTop: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--w11-text-tertiary)",
          }}
        >
          <div>Showing {filteredApps.length} workstations & plugins</div>
          <div>Press ESC to close</div>
        </div>
      </div>
    </>
  );
}
