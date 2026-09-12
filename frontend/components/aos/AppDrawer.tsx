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

    // Add plugin sidebar items from useInstalledPlugins() — keyed with a
    // plugin- prefix: core apps above can share the same slug (e.g.
    // "timetable"), and React keys must stay unique across the merged list.
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

  const categories = [
    { id: "all", label: "All Apps" },
    { id: "academics", label: "Academics & Vault" },
    { id: "stem", label: "STEM & Science" },
    { id: "campus", label: "Campus Life" },
    ...(currentRole === "admin" || currentRole === "accountant"
      ? [{ id: "admin", label: "Leadership & Finance" }]
      : []),
  ];

  return (
    <div className="aos-app-drawer-overlay" onClick={onClose}>
      <div
        className="aos-app-drawer-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AOSLogo size={32} />
            <div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--w11-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                AOS App Drawer & Library
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: `${accentColor}33`,
                    color: accentColor,
                    border: `1px solid ${accentColor}55`,
                  }}
                >
                  {allApps.length} APPS
                </span>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--w11-text-secondary)",
                }}
              >
                Unified application drawer compatible with Desktop and Mobile
                views
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              all: "unset",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--w11-text-primary)",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            title="Close Drawer (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="aos-drawer-search-bar">
          <Search size={18} color="var(--w11-text-secondary)" />
          <input
            type="text"
            placeholder="Search academic applications, tools or services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              all: "unset",
              flex: 1,
              fontSize: "14px",
              color: "inherit",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                all: "unset",
                cursor: "pointer",
                color: "var(--w11-text-secondary)",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Pills Filter */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            marginBottom: "16px",
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={activeCategory === cat.id ? "accent" : "subtle"}
              style={{
                fontSize: "12px",
                padding: "6px 14px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Apps Grid */}
        <div className="aos-drawer-grid">
          {filteredApps.map((app) => (
            <div
              key={`drawer-${app.id}`}
              className="aos-drawer-card aos-haptic-click"
              onClick={() => {
                onOpenApp(app.id);
                onClose();
              }}
            >
              <div style={{ position: "relative" }}>
                {app.icon}
                {app.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-6px",
                      background: "#ef4444",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "8px",
                      border: "1.5px solid #ffffff",
                    }}
                  >
                    {app.badge}
                  </span>
                )}
              </div>
              <span>{app.name}</span>
            </div>
          ))}
        </div>

        {filteredApps.length === 0 && (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--w11-text-secondary)",
            }}
          >
            <Grid size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: "15px", fontWeight: 600 }}>
              No applications match &quot;{searchQuery}&quot;
            </div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Try searching by subject, department, or keyword
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
