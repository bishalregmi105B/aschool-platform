"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ArrowRight,
  BookOpen,
  FileText,
  ShieldCheck,
  Zap,
  Sparkles,
  User,
} from "lucide-react";
import {
  AOSClassroomIcon,
  AOSFileManagerIcon,
  AOSGradebookIcon,
  AOSTimetableIcon,
  AOSLibraryIcon,
  AOSExamIcon,
  AOSTerminalIcon,
  AOSAdminIcon,
  AOSFinanceIcon,
  AOSSettingsIcon,
  AOSLogo,
} from "@/components/aos/AOSIcons";
import { SchoolRole } from "@/components/aos/types";
import { api } from "@/lib/api";
import { useInstalledPlugins } from "@/lib/plugins";
import { extractAOSModuleSlug, normalizeAOSRoute } from "@/lib/aos-navigation";

export interface SpotlightItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Apps & Plugins" | "Academic Results" | "Quick Actions";
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
}

interface ApiSearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp?: (appId: string) => void;
  onOpenRoute?: (route: string) => void;
  currentRole?: SchoolRole;
  accentColor?: string;
}

export default function SpotlightSearch({
  isOpen,
  onClose,
  onOpenApp,
  onOpenRoute,
  currentRole = "student",
  accentColor = "#0078d4",
}: SpotlightSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [apiResults, setApiResults] = useState<ApiSearchResult[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { sidebarItems } = useInstalledPlugins();

  // 300ms Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setApiResults([]);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global Cmd+Space / Ctrl+Space and Escape keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch real ASchool search results from backend API
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setApiResults([]);
      setIsLoadingApi(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingApi(true);

    api
      .get("/search", { params: { q: debouncedQuery.trim(), limit: 10 } })
      .then((res) => {
        if (!isCancelled) {
          const data = (res.data?.data || res.data || []) as ApiSearchResult[];
          setApiResults(Array.isArray(data) ? data : []);
          setIsLoadingApi(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setApiResults([]);
          setIsLoadingApi(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  const openDestination = useCallback(
    (moduleId: string, route?: string) => {
      if (route) {
        const normalized = normalizeAOSRoute(route);
        if (normalized && onOpenRoute) {
          onOpenRoute(normalized);
          return;
        }
      }

      if (onOpenApp) {
        onOpenApp(moduleId);
        return;
      }

      if (route) {
        router.push(route);
      }
    },
    [onOpenApp, onOpenRoute, router]
  );

  // Core base apps catalog
  const baseApps: SpotlightItem[] = useMemo(() => [
    {
      id: "app-classroom",
      title: "Live Classroom",
      subtitle: "Interactive lecture streaming & whiteboard",
      category: "Apps & Plugins",
      icon: <AOSClassroomIcon size={26} />,
      action: () => openDestination("classroom", "/dashboard/classroom"),
      badge: "CORE",
    },
    {
      id: "app-filemanager",
      title: "School Cloud Vault & Documents",
      subtitle: "Course materials, textbook PDFs, lab submissions",
      category: "Apps & Plugins",
      icon: <AOSFileManagerIcon size={26} />,
      action: () => openDestination("filemanager", "/dashboard/files"),
      badge: "VAULT",
    },
    {
      id: "app-gradebook",
      title: "Academic Gradebook & GPA",
      subtitle: "Continuous assessment & transcript tracking",
      category: "Apps & Plugins",
      icon: <AOSGradebookIcon size={26} />,
      action: () => openDestination("gradebook", "/dashboard/academics/grades"),
    },
    {
      id: "app-timetable",
      title: "Weekly Timetable & Schedule",
      subtitle: "Live bell schedule, class periods & rooms",
      category: "Apps & Plugins",
      icon: <AOSTimetableIcon size={26} />,
      action: () => openDestination("timetable", "/dashboard/timetable"),
    },
    {
      id: "app-library",
      title: "Digital Knowledge Vault & Library",
      subtitle: "Academic publications, journals & textbooks",
      category: "Apps & Plugins",
      icon: <AOSLibraryIcon size={26} />,
      action: () => openDestination("library", "/dashboard/library"),
    },
    {
      id: "app-exam",
      title: "Assessment Center & Exams",
      subtitle: "Timed quizzes, midterms & examination hall",
      category: "Apps & Plugins",
      icon: <AOSExamIcon size={26} />,
      action: () => openDestination("exam", "/dashboard/exams"),
      badge: "EXAM",
    },
    {
      id: "app-terminal",
      title: "CS Lab Shell & Python Terminal",
      subtitle: "Compiler shell, coding workbench & tools",
      category: "Apps & Plugins",
      icon: <AOSTerminalIcon size={26} />,
      action: () => openDestination("terminal", "/dashboard/terminal"),
    },
    {
      id: "app-settings",
      title: "AOS Desktop & System Settings",
      subtitle: "Personalization, wallpapers, dock pinning, accessibility",
      category: "Apps & Plugins",
      icon: <AOSSettingsIcon size={26} />,
      action: () => openDestination("settings", "/dashboard/settings"),
    },
    ...(currentRole === "admin"
      ? [
          {
            id: "app-admin",
            title: "Executive Command Center",
            subtitle: "Campus security, faculty management & broadcasts",
            category: "Apps & Plugins" as const,
            icon: <AOSAdminIcon size={26} />,
            action: () => openDestination("admin", "/dashboard/admin"),
            badge: "ADMIN",
          },
        ]
      : []),
    ...(currentRole === "accountant"
      ? [
          {
            id: "app-finance",
            title: "Tuition & Bursar Accounts",
            subtitle: "Invoices, payment receipts & student accounts",
            category: "Apps & Plugins" as const,
            icon: <AOSFinanceIcon size={26} />,
            action: () => openDestination("finance", "/dashboard/finance"),
            badge: "FINANCE",
          },
        ]
      : []),
  ], [currentRole, openDestination]);

  // Plugin-derived items from useInstalledPlugins()
  const pluginItems: SpotlightItem[] = useMemo(() => {
    const allItems: SpotlightItem[] = [];

    for (const item of sidebarItems || []) {
      const pluginIcon = (
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <Sparkles size={15} />
        </div>
      );

      allItems.push({
        id: `plugin-${item.slug}`,
        title: item.label,
        subtitle: item.section ? `${item.section} Module` : "Installed ASchool Plugin",
        category: "Apps & Plugins" as const,
        icon: pluginIcon,
        action: () => openDestination(item.slug, item.route),
        badge: "PLUGIN",
      });

      for (const sub of item.subitems || []) {
        allItems.push({
          id: `plugin-sub-${item.slug}-${sub.route}`,
          title: `${item.label} / ${sub.label}`,
          subtitle: "Module subpage",
          category: "Apps & Plugins" as const,
          icon: pluginIcon,
          action: () => openDestination(item.slug, sub.route),
          badge: "SUB",
        });
      }
    }

    return allItems;
  }, [sidebarItems, openDestination]);

  // Quick Action Utilities
  const quickActions: SpotlightItem[] = useMemo(() => [
    {
      id: "act-exam-lockdown",
      title: "Lock Station for Proctor Exam",
      subtitle: "Secure examination environment and proctor lockdown",
      category: "Quick Actions",
      icon: <ShieldCheck size={22} color="#ef4444" />,
      action: () => openDestination("exam", "/dashboard/exams"),
    },
    {
      id: "act-campus-bus",
      title: "Campus Shuttle Bus Fleet GPS",
      subtitle: "Live shuttle route tracking and arrival times",
      category: "Quick Actions",
      icon: <Zap size={22} color="#fbbf24" />,
      action: () => openDestination("campus", "/dashboard/campus"),
    },
  ], [openDestination]);

  // Convert real API search results
  const mappedApiItems: SpotlightItem[] = useMemo(() => {
    return apiResults.map((r, idx) => ({
      id: `api-res-${r.id || idx}`,
      title: r.title,
      subtitle: r.subtitle || `${r.type || "Search Result"} • ASchool`,
      category: "Academic Results" as const,
      icon: r.type === "student" || r.type === "teacher" ? (
        <User size={22} color="#38bdf8" />
      ) : r.type === "course" || r.type === "class" ? (
        <BookOpen size={22} color="#34d399" />
      ) : (
        <FileText size={22} color="#fbbf24" />
      ),
      action: () => {
        if (!r.url) return;

        const internal = normalizeAOSRoute(r.url);
        if (internal) {
          openDestination(extractAOSModuleSlug(internal) || "dashboard", internal);
          return;
        }

        router.push(r.url);
      },
      badge: r.type?.toUpperCase() || "RESULT",
    }));
  }, [apiResults, openDestination, router]);

  // Combine and filter results
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default suggestions
      return [...baseApps.slice(0, 6), ...pluginItems.slice(0, 4), ...quickActions];
    }

    const matchedApps = [...baseApps, ...pluginItems].filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );

    const matchedActions = quickActions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );

    return [...matchedApps, ...mappedApiItems, ...matchedActions];
  }, [query, baseApps, pluginItems, mappedApiItems, quickActions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="aos-spotlight-overlay" onClick={onClose}>
      <div className="aos-spotlight-box" onClick={(e) => e.stopPropagation()}>
        {/* Search Input Bar */}
        <div className="aos-spotlight-input-row">
          <Search size={22} color={accentColor} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="aos-spotlight-input"
            type="text"
            placeholder="Spotlight Search courses, apps, students, notices, exams..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setSelectedIndex(0);
              }}
              style={{
                all: "unset",
                cursor: "pointer",
                color: "var(--w11-text-tertiary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={18} />
            </button>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "var(--w11-text-tertiary)",
              background: "rgba(255,255,255,0.08)",
              padding: "3px 7px",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="aos-spotlight-results">
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                color: "var(--w11-text-secondary)",
              }}
            >
              <Search size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
              <div style={{ fontSize: "15px", fontWeight: 600 }}>
                {isLoadingApi ? "Searching campus network..." : `No results for "${query}"`}
              </div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Try searching for courses, assignments, faculty or plugins
              </div>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`aos-spotlight-item ${isSelected ? "is-selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>{item.icon}</div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        className="aos-spotlight-item-desc"
                        style={{
                          fontSize: "12px",
                          color: "var(--w11-text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "6px",
                          background: isSelected ? "rgba(255,255,255,0.25)" : "rgba(0,120,212,0.18)",
                          color: isSelected ? "#fff" : accentColor,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        color: isSelected ? "rgba(255,255,255,0.8)" : "var(--w11-text-tertiary)",
                        fontWeight: 500,
                      }}
                    >
                      {item.category}
                    </span>
                    <ArrowRight size={14} style={{ opacity: isSelected ? 1 : 0.3 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "11px",
            color: "var(--w11-text-tertiary)",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <AOSLogo size={12} />
            <span>AOS Spotlight • ⌘ Space</span>
          </div>
        </div>
      </div>
    </div>
  );
}
