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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstalledPlugins, type PluginSidebarItem } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { useState, useCallback, useEffect, useMemo } from "react";

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
  "Reports",
  "Digital & Design",
  "AI & Analytics",
  "Student Wellbeing",
  "Operations",
  "Growth",
  "Compliance",
];

// ── CORE NAV (always visible, no plugin gate) ──────────────────────────────
// These are truly core features — they appear regardless of installed plugins.
const CORE_SECTIONS: SidebarSection[] = [
  {
    header: null,
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    header: "Academic Management",
    items: [
      {
        label: "Academics",
        icon: BookOpen,
        href: "/dashboard/academics",
        roles: ["superadmin", "school_admin", "staff"],
      },
      {
        label: "Students",
        icon: GraduationCap,
        children: [
          { label: "Student Details", href: "/dashboard/students" },
          { label: "Add Student", href: "/dashboard/students/new" },
          {
            label: "Bulk Import",
            href: "/dashboard/students/bulk-import",
            icon: Upload,
          },
          {
            label: "Parents & Guardians",
            href: "/dashboard/parents",
            roles: ["superadmin", "school_admin"],
          },
          {
            label: "Assign Roll Numbers",
            href: "/dashboard/students/roll-numbers",
            icon: ListOrdered,
          },
          {
            label: "Upload Profile Images",
            href: "/dashboard/students/profile-images",
            icon: ImagePlus,
          },
          {
            label: "Transfer Student",
            href: "/dashboard/students/transfers",
            icon: ArrowRightLeft,
          },
          {
            label: "Promote Students",
            href: "/dashboard/students/promote",
            icon: TrendingUp,
          },
          {
            label: "Reset Password",
            href: "/dashboard/students/reset-password",
            icon: KeyRound,
          },
        ],
      },
      {
        label: "Teachers",
        icon: UserCog,
        roles: ["superadmin", "school_admin", "staff"],
        children: [
          { label: "Manage Teachers", href: "/dashboard/teachers" },
          {
            label: "Bulk Upload",
            href: "/dashboard/teachers/bulk-upload",
            icon: Upload,
          },
        ],
      },
      {
        label: "Users",
        icon: Users,
        href: "/dashboard/users",
        roles: ["superadmin", "school_admin"],
      },
    ],
  },
  {
    header: "Personnel Management",
    items: [
      {
        label: "Staff Management",
        icon: Briefcase,
        href: "/dashboard/staff",
        roles: ["superadmin", "school_admin"],
      },
      {
        label: "Leave",
        icon: CalendarOff,
        roles: ["superadmin", "school_admin", "staff"],
        children: [
          { label: "Staff Leave", href: "/dashboard/hr/leaves" },
          { label: "Leave Report", href: "/dashboard/hr/leaves/report" },
        ],
      },
      {
        label: "Staff Attendance",
        icon: ClipboardCheck,
        href: "/dashboard/hr/staff-attendance",
        roles: ["superadmin", "school_admin"],
      },
    ],
  },
  {
    header: "Institutional Finance",
    items: [
      {
        label: "Expense",
        icon: Receipt,
        roles: ["superadmin", "school_admin"],
        children: [
          {
            label: "Manage Categories",
            href: "/dashboard/hr/expense-categories",
          },
          { label: "Manage Expenses", href: "/dashboard/hr/expenses" },
        ],
      },
      {
        label: "Payroll",
        icon: Banknote,
        roles: ["superadmin", "school_admin"],
        children: [
          { label: "Manage Payroll", href: "/dashboard/hr/payroll" },
          {
            label: "Payroll Settings",
            href: "/dashboard/hr/payroll/settings",
          },
        ],
      },
    ],
  },
  {
    header: "Certificate & ID Card",
    items: [
      {
        label: "Certificates & ID Cards",
        icon: Award,
        href: "/dashboard/certificates",
        roles: ["superadmin", "school_admin"],
      },
    ],
  },
];

// Static bottom nav items (always shown based on roles)
const STATIC_BOTTOM_NAV: NavItem[] = [
  {
    label: "AI Token Hub",
    icon: Sparkles,
    href: "/dashboard/analytics/ai-usage",
    roles: ["superadmin", "school_admin"],
  },
  {
    label: "Marketplace",
    icon: Package,
    href: "/dashboard/marketplace",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    roles: ["superadmin", "school_admin"],
  },
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

  const userRole = user?.role ?? "";

  // Check role visibility
  const isRoleVisible = useCallback(
    (roles?: string[]) => {
      if (!roles || roles.length === 0) return true;
      return roles.includes(userRole);
    },
    [userRole],
  );

  // Auto-expand active group
  useEffect(() => {
    const next = new Set(expandedGroups);
    const checkItems = (items: NavItem[]) => {
      for (const item of items) {
        if (item.children) {
          const active = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
          );
          if (active) next.add(item.label);
        }
      }
    };
    CORE_SECTIONS.forEach((s) => checkItems(s.items));
    sidebarItems.forEach((si) => {
      if (si.subitems?.length) {
        const active = si.subitems.some(
          (sub) =>
            pathname === sub.route || pathname.startsWith(sub.route + "/"),
        );
        if (active) next.add(si.label);
      }
    });
    setExpandedGroups(next);
  }, [pathname, sidebarItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Build merged sidebar sections: core sections + plugin items slotted in
  const mergedSections = useMemo((): SidebarSection[] => {
    // Clone core sections (filter items by role)
    const sections: SidebarSection[] = CORE_SECTIONS.map((s) => ({
      header: s.header,
      items: s.items.filter((item) => isRoleVisible(item.roles)),
    })).filter((s) => s.items.length > 0);

    if (!isLoading && sidebarItems.length > 0) {
      // Group plugin items by section
      const bySection: Record<string, PluginSidebarItem[]> = {};
      for (const item of sidebarItems) {
        const sec = item.section || "__other__";
        if (!bySection[sec]) bySection[sec] = [];
        bySection[sec].push(item);
      }

      // Insert plugin items into sections (maintaining PLUGIN_SECTION_ORDER)
      for (const sectionName of PLUGIN_SECTION_ORDER) {
        const pluginItems = bySection[sectionName];
        if (!pluginItems || pluginItems.length === 0) continue;

        const navItems = pluginItems.map(pluginToNavItem);
        const existing = sections.find((s) => s.header === sectionName);
        if (existing) {
          existing.items.push(...navItems);
        } else {
          sections.push({ header: sectionName, items: navItems });
        }
      }

      // Append any items with no recognised section at the end
      if (bySection["__other__"]) {
        const otherItems = bySection["__other__"].map(pluginToNavItem);
        sections.push({ header: null, items: otherItems });
      }
    }

    return sections;
  }, [sidebarItems, isLoading, isRoleVisible]);

  // Build bottom nav: static items + plugin bottom-nav items (e.g. IEMIS Import)
  const bottomNavItems = useMemo((): NavItem[] => {
    const dynamicItems: NavItem[] = pluginBottomNav
      .filter(() => isRoleVisible(["superadmin", "school_admin"]))
      .map((item) => ({
        label: item.label,
        icon: resolveIcon(item.icon),
        href: item.route,
        pluginSlug: item.slug,
      }));
    const staticItems = STATIC_BOTTOM_NAV.filter((item) =>
      isRoleVisible(item.roles),
    );
    return [...dynamicItems, ...staticItems];
  }, [pluginBottomNav, isRoleVisible]);

  // ── Render helpers ────────────────────────────────────────────────────

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const renderDirectLink = (item: NavItem, key: string) => {
    const active = isActive(item.href!);
    return (
      <Link
        key={key}
        href={item.href!}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2",
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
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
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            hasActiveChild
              ? "text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  expanded ? "rotate-0" : "-rotate-90",
                )}
              />
            </>
          )}
        </button>

        {/* Children */}
        {!collapsed && expanded && item.children && (
          <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 mt-0.5 mb-1">
            {item.children
              .filter((c) => isRoleVisible(c.roles))
              .map((child) => {
                const childActive = isActive(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                      childActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {child.icon && (
                      <child.icon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{child.label}</span>
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
        "flex flex-col border-r bg-card h-screen sticky top-0 transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          A
        </div>
        {!collapsed && (
          <span className="font-bold text-lg truncate">ASchool</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {mergedSections.map((section, sIdx) => (
          <div key={sIdx}>
            {/* Section header */}
            {section.header && !collapsed && (
              <div className="pt-4 pb-1.5 px-3">
                <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  {section.header}
                </span>
              </div>
            )}
            {section.header && collapsed && (
              <div className="border-t my-2 mx-2" />
            )}

            {/* Items */}
            <div className="space-y-0.5">
              {section.items.map((item, iIdx) =>
                renderNavItem(item, `${sIdx}-${iIdx}-${item.label}`),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="border-t px-2 py-2 space-y-0.5">
        {bottomNavItems.map((item, i) =>
          renderNavItem(item, `bottom-${i}-${item.label}`),
        )}
      </div>

      {/* User + Collapse */}
      <div className="border-t px-3 py-3 flex items-center justify-between">
        {user && !collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.role}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
