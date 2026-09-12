"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle } from "lucide-react";
import {
  formatAOSRouteTitle,
  parseAOSRouteWindowId,
  routeToAOSAppPath,
} from "@/lib/aos-navigation";

/**
 * Standard AOS Window Loading Spinner
 * Renders an acrylic glowing spinner while heavy dashboard chunks are hydrated.
 */
export function AOSModuleLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[350px] w-full p-8 text-muted-foreground select-none">
      <div className="relative flex items-center justify-center mb-4">
        <Loader2 className="w-9 h-9 animate-spin text-primary opacity-80" />
        <div className="absolute w-12 h-12 rounded-full border border-primary/20 animate-ping" />
      </div>
      <span className="text-sm font-medium tracking-wide text-foreground/80">
        Loading Application...
      </span>
      <span className="text-xs text-muted-foreground/60 mt-1">
        Initializing window workspace
      </span>
    </div>
  );
}

function AOSModuleFallback({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] w-full p-8 text-center text-muted-foreground select-none">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
        <AlertCircle className="w-6 h-6 text-amber-500" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Module Window Unavailable</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        No active visual component is registered for module ID: <code className="font-mono text-primary font-medium">{slug}</code>.
      </p>
    </div>
  );
}

/**
 * Dynamic registry mapping all 58 ASchool dashboard modules to lazy-loaded client components.
 */
export const AOS_MODULE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  // ── Home (dashboard root — the widget board) ─────────────────────────────
  home: dynamic(() => import("@/app/dashboard/page"), { loading: AOSModuleLoading }),
  dashboard: dynamic(() => import("@/app/dashboard/page"), { loading: AOSModuleLoading }),

  // ── Core Academics ────────────────────────────────────────────────────────
  students: dynamic(() => import("@/app/dashboard/students/page"), { loading: AOSModuleLoading }),
  teachers: dynamic(() => import("@/app/dashboard/teachers/page"), { loading: AOSModuleLoading }),
  academics: dynamic(() => import("@/app/dashboard/academics/page"), { loading: AOSModuleLoading }),
  timetable: dynamic(() => import("@/app/dashboard/timetable/page"), { loading: AOSModuleLoading }),
  attendance: dynamic(() => import("@/app/dashboard/attendance/page"), { loading: AOSModuleLoading }),
  admission: dynamic(() => import("@/app/dashboard/admission/page"), { loading: AOSModuleLoading }),
  alumni: dynamic(() => import("@/app/dashboard/alumni/page"), { loading: AOSModuleLoading }),

  // ── Learning & Examinations ───────────────────────────────────────────────
  lms: dynamic(() => import("@/app/dashboard/lms/page"), { loading: AOSModuleLoading }),
  elibrary: dynamic(() => import("@/app/dashboard/elibrary/page"), { loading: AOSModuleLoading }),
  library: dynamic(() => import("@/app/dashboard/library/page"), { loading: AOSModuleLoading }),
  assignments: dynamic(() => import("@/app/dashboard/assignments/page"), { loading: AOSModuleLoading }),
  exams: dynamic(() => import("@/app/dashboard/exams/page"), { loading: AOSModuleLoading }),
  portfolio: dynamic(() => import("@/app/dashboard/portfolio/page"), { loading: AOSModuleLoading }),
  "teaching-content": dynamic(() => import("@/app/dashboard/teaching-content/page"), { loading: AOSModuleLoading }),

  // ── Finance & HR ──────────────────────────────────────────────────────────
  fees: dynamic(() => import("@/app/dashboard/fees/page"), { loading: AOSModuleLoading }),
  hr: dynamic(() => import("@/app/dashboard/hr/page"), { loading: AOSModuleLoading }),

  // ── Campus Operations & Logistics ─────────────────────────────────────────
  transport: dynamic(() => import("@/app/dashboard/transport/page"), { loading: AOSModuleLoading }),
  biometric: dynamic(() => import("@/app/dashboard/biometric/page"), { loading: AOSModuleLoading }),
  inventory: dynamic(() => import("@/app/dashboard/inventory/page"), { loading: AOSModuleLoading }),
  hostel: dynamic(() => import("@/app/dashboard/hostel/page"), { loading: AOSModuleLoading }),
  visitors: dynamic(() => import("@/app/dashboard/visitors/page"), { loading: AOSModuleLoading }),
  dismissal: dynamic(() => import("@/app/dashboard/dismissal/page"), { loading: AOSModuleLoading }),
  conferences: dynamic(() => import("@/app/dashboard/conferences/page"), { loading: AOSModuleLoading }),

  // ── AI & Automation ───────────────────────────────────────────────────────
  "ai-teacher": dynamic(() => import("@/app/dashboard/ai-teacher/page"), { loading: AOSModuleLoading }),
  "ai-tools": dynamic(() => import("@/app/dashboard/ai-tools/page"), { loading: AOSModuleLoading }),
  "ai-workbench": dynamic(() => import("@/app/dashboard/ai-workbench/page"), { loading: AOSModuleLoading }),

  // ── Creative & Web ────────────────────────────────────────────────────────
  designer: dynamic(() => import("@/app/dashboard/designer/page"), { loading: AOSModuleLoading }),
  "website-builder": dynamic(() => import("@/app/dashboard/website-builder/page"), { loading: AOSModuleLoading }),
  "white-label": dynamic(() => import("@/app/dashboard/white-label/page"), { loading: AOSModuleLoading }),
  certificates: dynamic(() => import("@/app/dashboard/certificates/page"), { loading: AOSModuleLoading }),

  // ── Communication ─────────────────────────────────────────────────────────
  communications: dynamic(() => import("@/app/dashboard/communications/page"), { loading: AOSModuleLoading }),
  notices: dynamic(() => import("@/app/dashboard/notices/page"), { loading: AOSModuleLoading }),
  notifications: dynamic(() => import("@/app/dashboard/notifications/page"), { loading: AOSModuleLoading }),
  sms: dynamic(() => import("@/app/dashboard/sms/page"), { loading: AOSModuleLoading }),

  // ── Safety & Health ───────────────────────────────────────────────────────
  emergency: dynamic(() => import("@/app/dashboard/emergency/page"), { loading: AOSModuleLoading }),
  disaster: dynamic(() => import("@/app/dashboard/disaster/page"), { loading: AOSModuleLoading }),
  "incident-management": dynamic(() => import("@/app/dashboard/incident-management/page"), { loading: AOSModuleLoading }),
  incidents: dynamic(() => import("@/app/dashboard/incidents/page"), { loading: AOSModuleLoading }),
  compliance: dynamic(() => import("@/app/dashboard/compliance/page"), { loading: AOSModuleLoading }),
  wellbeing: dynamic(() => import("@/app/dashboard/wellbeing/page"), { loading: AOSModuleLoading }),
  "health-records": dynamic(() => import("@/app/dashboard/health-records/page"), { loading: AOSModuleLoading }),

  // ── Platform Administration & System ──────────────────────────────────────
  marketplace: dynamic(() => import("@/app/dashboard/marketplace/page"), { loading: AOSModuleLoading }),
  plugins: dynamic(() => import("@/app/dashboard/plugins/page"), { loading: AOSModuleLoading }),
  users: dynamic(() => import("@/app/dashboard/users/page"), { loading: AOSModuleLoading }),
  "multi-branch": dynamic(() => import("@/app/dashboard/multi-branch/page"), { loading: AOSModuleLoading }),
  settings: dynamic(() => import("@/app/dashboard/settings/page"), { loading: AOSModuleLoading }),
  "iemis-import": dynamic(() => import("@/app/dashboard/iemis-import/page"), { loading: AOSModuleLoading }),
  "bulk-uploads": dynamic(() => import("@/app/dashboard/bulk-uploads/page"), { loading: AOSModuleLoading }),

  // ── Analytics & Engagement ────────────────────────────────────────────────
  reports: dynamic(() => import("@/app/dashboard/reports/page"), { loading: AOSModuleLoading }),
  analytics: dynamic(() => import("@/app/dashboard/analytics/page"), { loading: AOSModuleLoading }),
  benchmarking: dynamic(() => import("@/app/dashboard/benchmarking/page"), { loading: AOSModuleLoading }),
  gamification: dynamic(() => import("@/app/dashboard/gamification/page"), { loading: AOSModuleLoading }),
  "content-review": dynamic(() => import("@/app/dashboard/content-review/page"), { loading: AOSModuleLoading }),

  // ── General Utilities & User Hubs ─────────────────────────────────────────
  faqs: dynamic(() => import("@/app/dashboard/faqs/page"), { loading: AOSModuleLoading }),
  files: dynamic(() => import("@/app/dashboard/files/page"), { loading: AOSModuleLoading }),
  profile: dynamic(() => import("@/app/dashboard/profile/page"), { loading: AOSModuleLoading }),
  staff: dynamic(() => import("@/app/dashboard/staff/page"), { loading: AOSModuleLoading }),
  parents: dynamic(() => import("@/app/dashboard/parents/page"), { loading: AOSModuleLoading }),

  // ── AOS Native System Applications ────────────────────────────────────────
  appstore: dynamic(() => import("./apps/AppStoreApp"), { loading: AOSModuleLoading }),
  "plugin-runner": dynamic(() => import("./apps/PluginRunnerApp"), { loading: AOSModuleLoading }),
  "aos-settings": dynamic(() => import("./apps/SettingsApp"), { loading: AOSModuleLoading }),
  filemanager: dynamic(() => import("./apps/FileManagerApp"), { loading: AOSModuleLoading }),
};

/**
 * Common slug aliases and legacy compatibility mappings
 */
const MODULE_ALIASES: Record<string, string> = {
  // Legacy Win7Css names
  classroom: "lms",
  gradebook: "exams",
  exam: "exams",
  timetable_management: "timetable",
  "timetable-management": "timetable",
  file_management: "files",
  "file-management": "files",
  // "filemanager" resolves directly to the AOS native FileManager app above;
  // these aliases route the Vault naming onto it. Note "files" itself stays a
  // direct registry entry pointing at the dashboard files page.
  file_manager: "filemanager",
  vault: "filemanager",
  campus: "transport",
  notebook: "assignments",
  lab: "ai-workbench",
  admin: "users",
  finance: "fees",
  "app-store": "appstore",
  store: "appstore",
  library_management: "library",
  hr_payroll: "hr",
  visitor_management: "visitors",
  iemis: "iemis-import",
  iemis_importer: "iemis-import",
  health: "health-records",
  "health-record": "health-records",
  health_records: "health-records",
  incident_management: "incident-management",
  website_builder: "website-builder",
  white_label: "white-label",
  ai_teacher: "ai-teacher",
  ai_tools: "ai-tools",
  ai_workbench: "ai-workbench",
  teaching_content: "teaching-content",
  multi_branch: "multi-branch",
  content_review: "content-review",
  bulk_uploads: "bulk-uploads",
  "bulk-upload": "bulk-uploads",
  system_settings: "aos-settings",
  "system-settings": "aos-settings",
  personalization: "aos-settings",
};

function normalizeModuleSlug(rawSlug: string): string {
  const cleaned = String(rawSlug || "")
    .trim()
    .toLowerCase()
    .split("?")[0]
    .split("#")[0]
    .replace(/^\/+|\/+$/g, "");

  if (!cleaned) return "";

  const dashboardMatch = cleaned.match(/(?:^|\/)dashboard\/([^/]+)/);
  const segment = dashboardMatch?.[1] || cleaned;

  return segment.replace(/\s+/g, "-");
}

function createFallbackComponent(slug: string): React.ComponentType<any> {
  function FallbackWrapper(props: any) {
    const effectiveSlug = props?.window?.id || props?.pluginId || slug;
    return <AOSModuleFallback slug={effectiveSlug} />;
  }
  FallbackWrapper.displayName = `AOSModuleFallback_${slug || "unknown"}`;
  return FallbackWrapper;
}

function AOSRouteFrame(props: any) {
  const rawRoute =
    props?.window?.route ||
    parseAOSRouteWindowId(props?.window?.id || "") ||
    props?.route;

  const src = rawRoute ? routeToAOSAppPath(rawRoute) : null;
  if (!src) {
    return <AOSModuleFallback slug={props?.window?.id || "route"} />;
  }

  const title = formatAOSRouteTitle(rawRoute);

  return (
    <iframe
      src={src}
      title={title}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        background: "var(--background)",
      }}
    />
  );
}

/**
 * Resolve any module slug or alias to its dynamic React component
 */
export function resolveModuleComponent(slug: string): React.ComponentType<any> {
  if (!slug) {
    return createFallbackComponent("unknown");
  }

  if (slug.startsWith("route:")) {
    // Delegate to route-aware resolution: inline component when registered,
    // iframe only as a last resort.
    const route = parseAOSRouteWindowId(slug) || slug.slice("route:".length);
    return resolveRouteWindowComponent(route);
  }

  const normalized = normalizeModuleSlug(slug);
  const candidates = Array.from(
    new Set([
      slug,
      slug.toLowerCase(),
      normalized,
      normalized.replace(/_/g, "-"),
      normalized.replace(/-/g, "_"),
    ])
  ).filter(Boolean);

  // 1. Direct registry hits across normalized variants
  for (const candidate of candidates) {
    if (AOS_MODULE_COMPONENTS[candidate]) {
      return AOS_MODULE_COMPONENTS[candidate];
    }
  }

  // 2. Known alias hits across normalized variants
  for (const candidate of candidates) {
    const aliased = MODULE_ALIASES[candidate];
    if (aliased && AOS_MODULE_COMPONENTS[aliased]) {
      return AOS_MODULE_COMPONENTS[aliased];
    }
  }

  // 3. Final dashed normalization pass (e.g. "bulk_uploads" -> "bulk-uploads")
  for (const candidate of candidates) {
    const dashed = candidate.replace(/_/g, "-");
    if (AOS_MODULE_COMPONENTS[dashed]) {
      return AOS_MODULE_COMPONENTS[dashed];
    }
  }

  // 4. Plugin runner pattern (e.g. "plugin-physics-ai", "plugin-attendance")
  if (normalized.startsWith("plugin-") || slug.startsWith("plugin-")) {
    return AOS_MODULE_COMPONENTS["plugin-runner"];
  }

  // 5. Fallback safe placeholder
  return createFallbackComponent(normalized || slug);
}

/**
 * Route windows prefer inline rendering: resolve the route's module segment
 * against the registry so most subroutes open as real components. Only
 * genuinely unregistered routes fall back to the aos_embed iframe — iframes
 * are the last resort because proxy/redirect edge cases can make them fail
 * to load ("refused connection" class of bug documented in files.py).
 */
export function resolveRouteWindowComponent(route: string): React.ComponentType<any> {
  const path = route.split("?")[0].replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean); // ["dashboard", "fees", "collect"]
  const moduleSegment = segments[1]; // segment after /dashboard
  if (!moduleSegment) {
    return AOSRouteFrame;
  }
  const resolved = resolveModuleComponent(moduleSegment);
  // resolveModuleComponent returns a fallback for unknown slugs — detect by
  // displayName convention used in createFallbackComponent.
  if (resolved && typeof resolved === "function" && !String(resolved.displayName || "").startsWith("AOSModuleFallback")) {
    return resolved;
  }
  return AOSRouteFrame;
}

