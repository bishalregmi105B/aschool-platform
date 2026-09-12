import React from "react";
import { ICON_MAP } from "@/components/layout/sidebar";
import * as AOSIcons from "@/components/aos/AOSIcons";
import { type PluginSidebarItem } from "@/lib/plugins";

export interface AOSApp {
  id: string;
  name: string;
  route: string;
  category: string;
  icon: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  isHeavy?: boolean;
}

export const SECTION_GRADIENTS: Record<string, string> = {
  Academics: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
  Learning: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  Money: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
  Operations: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
  Communication: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
  "Design & Web": "linear-gradient(135deg, #db2777 0%, #f472b6 100%)",
  Insights: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
  "Student Life": "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  "Safety & Compliance": "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
  Growth: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
  Admin: "linear-gradient(135deg, #475569 0%, #64748b 100%)",
  Core: "linear-gradient(135deg, #0078D4 0%, #005A9E 100%)",
};

/** Heavy workstation modules that require expanded default window bounds */
export const HEAVY_MODULE_SLUGS = new Set<string>([
  "designer",
  "website-builder",
  "lms",
  "ai-workbench",
  "analytics",
  "reports",
]);

const AOS_MODULE_ALIASES: Record<string, string> = {
  file_management: "files",
  "file-management": "files",
  filemanager: "files",
  library_management: "library",
  hr_payroll: "hr",
  visitor_management: "visitors",
  iemis_importer: "iemis-import",
  iemis: "iemis-import",
  website_builder: "website-builder",
  white_label: "white-label",
  teaching_content: "teaching-content",
  multi_branch: "multi-branch",
  content_review: "content-review",
  bulk_uploads: "bulk-uploads",
  incident_management: "incident-management",
  health_records: "health-records",
  ai_teacher: "ai-teacher",
  ai_tools: "ai-tools",
  ai_workbench: "ai-workbench",
  app_store: "appstore",
  "app-store": "appstore",
};

export function getSlugFromRoute(route?: string): string {
  const cleanedRoute = String(route || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/g, "");

  if (!cleanedRoute) return "";

  const segments = cleanedRoute.split("/").filter(Boolean);
  const dashboardIndex = segments.lastIndexOf("dashboard");
  if (dashboardIndex >= 0 && segments[dashboardIndex + 1]) {
    return segments[dashboardIndex + 1].toLowerCase();
  }
  return "";
}

export function normalizeAOSModuleId(slug: string, route?: string): string {
  const slugLower = String(slug || "").trim().toLowerCase();
  const routeSlug = getSlugFromRoute(route);
  const base = routeSlug || slugLower;
  if (!base) return "";

  const viaAlias =
    AOS_MODULE_ALIASES[base] ||
    AOS_MODULE_ALIASES[base.replace(/-/g, "_")] ||
    AOS_MODULE_ALIASES[base.replace(/_/g, "-")] ||
    AOS_MODULE_ALIASES[slugLower];

  return viaAlias || base.replace(/_/g, "-");
}

export function getDefaultWindowSize(slug: string): { width: number; height: number } {
  if (HEAVY_MODULE_SLUGS.has(slug)) {
    return { width: 1100, height: 700 };
  }
  return { width: 900, height: 600 };
}

const SLUG_TO_DEDICATED_AOS_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  classroom: AOSIcons.AOSClassroomIcon,
  lms: AOSIcons.AOSClassroomIcon,
  gradebook: AOSIcons.AOSGradebookIcon,
  timetable: AOSIcons.AOSTimetableIcon,
  library: AOSIcons.AOSLibraryIcon,
  elibrary: AOSIcons.AOSLibraryIcon,
  exam: AOSIcons.AOSExamIcon,
  exams: AOSIcons.AOSExamIcon,
  transport: AOSIcons.AOSCampusIcon,
  campus: AOSIcons.AOSCampusIcon,
  notebook: AOSIcons.AOSNotebookIcon,
  assignments: AOSIcons.AOSNotebookIcon,
  portfolio: AOSIcons.AOSNotebookIcon,
  lab: AOSIcons.AOSLabIcon,
  "ai-workbench": AOSIcons.AOSLabIcon,
  "ai-tools": AOSIcons.AOSLabIcon,
  "ai-teacher": AOSIcons.AOSLabIcon,
  terminal: AOSIcons.AOSTerminalIcon,
  settings: AOSIcons.AOSSettingsIcon,
  files: AOSIcons.AOSFileManagerIcon,
  filemanager: AOSIcons.AOSFileManagerIcon,
  admin: AOSIcons.AOSAdminIcon,
  users: AOSIcons.AOSAdminIcon,
  fees: AOSIcons.AOSFinanceIcon,
  finance: AOSIcons.AOSFinanceIcon,
  hr: AOSIcons.AOSFinanceIcon,
};

export function getAOSAppForModule(item: PluginSidebarItem): AOSApp {
  const moduleId = normalizeAOSModuleId(item.slug, item.route);
  const isHeavy = HEAVY_MODULE_SLUGS.has(moduleId);
  const { width: defaultWidth, height: defaultHeight } = getDefaultWindowSize(moduleId);

  const DedicatedIcon =
    SLUG_TO_DEDICATED_AOS_ICON[moduleId] ||
    (AOSIcons as Record<string, React.ComponentType<{ size?: number }>>)[
      `AOS${moduleId
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")}Icon`
    ];

  const LucideComp = (item.icon && ICON_MAP[item.icon]) ? ICON_MAP[item.icon] : ICON_MAP.Package;
  const gradient =
    SECTION_GRADIENTS[item.section || ""] ||
    SECTION_GRADIENTS.Core ||
    "linear-gradient(135deg, #0078D4 0%, #005A9E 100%)";

  const iconElement = DedicatedIcon ? (
    <DedicatedIcon size={48} />
  ) : (
    <div
      className="w-12 h-12 rounded-[14px] flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 active:scale-95"
      style={{
        background: gradient,
        boxShadow: "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
      }}
    >
      {LucideComp ? <LucideComp className="w-6 h-6" /> : null}
    </div>
  );

  return {
    id: moduleId || item.slug,
    name: item.label,
    route: item.route || `/dashboard/${moduleId || item.slug}`,
    category: item.section || "General",
    icon: iconElement,
    defaultWidth,
    defaultHeight,
    isHeavy,
  };
}
