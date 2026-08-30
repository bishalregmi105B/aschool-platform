"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  Bell,
  BarChart3,
  Globe,
  DollarSign,
  FileText,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Library,
  PenTool,
  MessageCircle,
  MessageSquare,
  UserPlus,
  MonitorPlay,
  HeartPulse,
  Smile,
  Palette,
  Bus,
  Trophy,
  FolderOpen,
  FileSpreadsheet,
  Sparkles,
  UserCog,
  Briefcase,
  Award,
  Image,
  Megaphone,
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  CalendarOff,
  Upload,
  CreditCard,
  Receipt,
  Banknote,
  MapPin,
  Route,
  ShieldCheck,
  ListOrdered,
  UserCheck,
  KeyRound,
  ImagePlus,
  ArrowRightLeft,
  TrendingUp,
  Monitor,
  Share2,
  AlertTriangle,
  Layers,
  BarChart2,
  Video,
  LogOut,
  Star,
  HelpCircle,
  BookOpenCheck,
  Database,
  Camera,
  FileBarChart2,
  Building2,
  HelpCircle as QuestionMarkCircle,
  BookUser,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstalledPlugins, type PluginSidebarItem } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { useState, useEffect, useMemo } from "react";

// ── Icon Registry (maps YAML icon string → Lucide component) ───────────────
const ICON_MAP: Record<string, LucideIcon> = {
  // People & Academics
  Users,
  GraduationCap,
  UserCog,
  UserCheck,
  UserPlus,
  BookOpen,
  BookMarked,
  BookOpenCheck,
  // Attendance & Time
  Calendar,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  ClipboardCheck,
  // Exams & Assignments
  FileText,
  PenTool,
  // Communication
  Bell,
  MessageCircle,
  MessageSquare,
  Megaphone,
  // Finance
  CreditCard,
  DollarSign,
  Receipt,
  Banknote,
  // Library & Learning
  Library,
  MonitorPlay,
  // Design & Web
  Palette,
  Globe,
  Monitor,
  Image,
  Layers,
  // AI & Analytics
  Sparkles,
  BarChart3,
  BarChart2,
  TrendingUp,
  // Operations
  Bus,
  MapPin,
  Route,
  Package,
  FolderOpen,
  FileSpreadsheet,
  // Wellbeing & Compliance
  Smile,
  HeartPulse,
  Trophy,
  ShieldCheck,
  AlertTriangle,
  // HR & Staff
  Briefcase,
  Award,
  // Social & Growth
  Share2,
  Star,
  // Misc
  Settings,
  HelpCircle,
  Video,
  LogOut,
  Upload,
  KeyRound,
  ImagePlus,
  ArrowRightLeft,
  ListOrdered,
  Database,
  Camera,
  FileBarChart2,
  BookUser,
  CalendarRange,
};

function resolveIcon(name: string | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || Package;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface NavChild {
  label: string;
  href: string;
  icon?: LucideIcon;
  roles?: string[];
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
  roles?: string[];
  pluginSlug?: string; // set for plugin-driven items (enables lock/show logic)
}

interface SidebarSection {
  header: string | null;
  items: NavItem[];
}

// ── Section Display Order ──────────────────────────────────────────────────
// Plugin items are grouped into these sections (in this order).
// Core sections (Academic Management, Personnel Management, etc.) always appear;
// plugin sections are inserted after the corresponding core section if it exists,
// or appended at the end if new.
const PLUGIN_SECTION_ORDER: string[] = [
  "Academic Management",
  "Exam & Performance",
  "Communication & Media",
  "Library & Learning",
  "Personnel Management",
  "Institutional Finance",
  "Transportation",
  "Reporting & Analytics",
  "Digital & Design",
  "AI & Analytics",
  "Student Wellbeing",
  "Operations",
  "Growth",
  "Compliance",
];


// ── Helper — convert a PluginSidebarItem to NavItem ───────────────────────
function pluginToNavItem(item: PluginSidebarItem): NavItem {
  const icon = resolveIcon(item.icon);
  if (item.subitems && item.subitems.length > 0) {
    return {
      label: item.label,
      icon,
      pluginSlug: item.slug,
      children: item.subitems.map((sub) => ({
        label: sub.label,
        href: sub.route,
      })),
    };
  }
  return {
    label: item.label,
    icon,
    href: item.route,
    pluginSlug: item.slug,
  };
}

// ── Sidebar Component ──────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { sidebarItems, pluginBottomNav, isLoading } = useInstalledPlugins();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Auto-expand active group based on API-driven sidebar items
  useEffect(() => {
    const next = new Set(expandedGroups);
    for (const item of sidebarItems) {
      if (item.subitems?.length) {
        const active = item.subitems.some(
          (sub) =>
            pathname === sub.route || pathname.startsWith(sub.route + "/"),
        );
        if (active) next.add(item.label);
      }
    }
    setExpandedGroups(next);
  }, [pathname, sidebarItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Build sidebar sections from API data only (no hardcoded nav)
  const mergedSections = useMemo((): SidebarSection[] => {
    if (isLoading || !sidebarItems.length) return [];

    // Group items by section
    const bySection = new Map<string | null, NavItem[]>();
    for (const item of sidebarItems) {
      const sec = (item.section as string | null) ?? null;
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec)!.push(pluginToNavItem(item));
    }

    const sections: SidebarSection[] = [];
    // Null-section items first (Dashboard)
    if (bySection.has(null)) {
      sections.push({ header: null, items: bySection.get(null)! });
    }
    // Named sections in preferred order
    for (const sectionName of PLUGIN_SECTION_ORDER) {
      if (bySection.has(sectionName)) {
        sections.push({ header: sectionName, items: bySection.get(sectionName)! });
      }
    }
    // Any unrecognised sections appended at end
    // (Array.from: Map iteration needs downlevelIteration — not set in tsconfig)
    for (const [key, items] of Array.from(bySection.entries())) {
      if (key !== null && !PLUGIN_SECTION_ORDER.includes(key)) {
        sections.push({ header: key, items });
      }
    }
    return sections;
  }, [sidebarItems, isLoading]);

  // Bottom nav driven entirely by plugin manifests (settings_core, marketplace_nav, etc.)
  const bottomNavItems = useMemo((): NavItem[] => {
    return pluginBottomNav.map((item) => ({
      label: item.label,
      icon: resolveIcon(item.icon),
      href: item.subitems?.length ? undefined : item.route,
      pluginSlug: item.slug,
      children: item.subitems?.length
        ? item.subitems.map((s) => ({ label: s.label, href: s.route }))
        : undefined,
    }));
  }, [pluginBottomNav]);

  // ── Render helpers ────────────────────────────────────────────────────

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const renderDirectLink = (item: NavItem, key: string) => {
    const active = isActive(item.href!);
    return (
      <Link
        key={key}
        href={item.href!}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] transition-colors",
          active
            ? "bg-white/20 text-white font-medium"
            : "text-white/75 hover:bg-white/10 hover:text-white",
          collapsed && "justify-center px-2",
        )}
      >
        <item.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </Link>
    );
  };

  const renderGroup = (item: NavItem, key: string) => {
    const expanded = expandedGroups.has(item.label);
    const hasActiveChild = item.children?.some(
      (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
    );

    return (
      <div key={key}>
        <button
          onClick={() => toggleGroup(item.label)}
          title={collapsed ? item.label : undefined}
          className={cn(
            "w-full flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] transition-colors",
            hasActiveChild
              ? "text-white font-medium bg-white/10"
              : "text-white/75 hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-2",
          )}
        >
          <item.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 opacity-60 transition-transform duration-200",
                  expanded ? "rotate-0" : "-rotate-90",
                )}
              />
            </>
          )}
        </button>

        {/* Children — bullet-point style */}
        {!collapsed && expanded && item.children && (
          <div className="ml-[22px] border-l border-white/15 pl-2.5 space-y-0.5 mt-0.5 mb-1">
            {item.children.map((child) => {
                const childActive = isActive(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2 py-[5px] text-[12px] transition-colors",
                      childActive
                        ? "bg-white/20 text-white font-medium"
                        : "text-white/65 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      childActive ? "bg-white" : "bg-white/40",
                    )} />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderNavItem = (item: NavItem, key: string) => {
    if (item.children && item.children.length > 0) {
      return renderGroup(item, key);
    }
    if (item.href) {
      return renderDirectLink(item, key);
    }
    return null;
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 transition-all duration-200 shadow-xl",
        collapsed ? "w-14" : "w-[228px]",
      )}
      style={{ background: "hsl(var(--sidebar-bg))" }}
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-2.5 px-3 h-[52px] shrink-0 select-none"
        style={{ background: "hsl(var(--sidebar-header-bg))" }}
      >
        <div className="h-7 w-7 rounded bg-white/15 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-sm leading-none">A</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-white font-bold text-[15px] tracking-wide leading-none">
              A<span className="text-yellow-300">S</span>chool
            </span>
            <p className="text-white/50 text-[9px] uppercase tracking-widest leading-tight mt-0.5">
              Management System
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-white/10 text-white/60 hover:text-white shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* School Name Strip */}
      {!collapsed && user && (
        <div
          className="px-3 py-2 shrink-0"
          style={{ background: "hsl(var(--sidebar-school-bg))" }}
        >
          <p className="text-white/90 text-[11px] font-medium leading-snug truncate">
            {user.full_name}
          </p>
          <p className="text-white/55 text-[10px] capitalize mt-0.5">
            {user.role?.replace(/_/g, " ")}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 sidebar-scroll">
        {mergedSections.map((section, sIdx) => (
          <div key={sIdx} className="mb-0.5">
            {/* Section divider / header */}
            {section.header && !collapsed && (
              <div className="pt-3 pb-1 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "hsl(var(--sidebar-text-muted))" }}>
                  {section.header}
                </span>
              </div>
            )}
            {section.header && collapsed && (
              <div className="my-2 mx-2 border-t border-white/10" />
            )}

            <div className="space-y-px">
              {section.items.map((item, iIdx) =>
                renderNavItem(item, `${sIdx}-${iIdx}-${item.label}`),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav (Settings, Marketplace, AI) */}
      <div
        className="px-1.5 py-2 space-y-px shrink-0 border-t"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {bottomNavItems.map((item, i) =>
          renderNavItem(item, `bottom-${i}-${item.label}`),
        )}
      </div>

      {/* Avatar row (collapsed only) */}
      {collapsed && user && (
        <div
          className="px-1.5 py-2 border-t flex justify-center"
          style={{ borderColor: "hsl(var(--sidebar-border))" }}
        >
          <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
        </div>
      )}
    </aside>
  );
}
