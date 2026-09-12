"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle } from "lucide-react";

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
  filemanager: "files",
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
  health: "health-records",
  "health-record": "health-records",
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

function createFallbackComponent(slug: string): React.ComponentType<any> {
  function FallbackWrapper(props: any) {
    const effectiveSlug = props?.window?.id || props?.pluginId || slug;
    return <AOSModuleFallback slug={effectiveSlug} />;
  }
  FallbackWrapper.displayName = `AOSModuleFallback_${slug || "unknown"}`;
  return FallbackWrapper;
}

/**
 * Resolve any module slug or alias to its dynamic React component
 */
export function resolveModuleComponent(slug: string): React.ComponentType<any> {
  if (!slug) {
    return createFallbackComponent("unknown");
  }

  // 1. Direct registry hit
  if (AOS_MODULE_COMPONENTS[slug]) {
    return AOS_MODULE_COMPONENTS[slug];
  }

  // 2. Known alias hit
  const aliased = MODULE_ALIASES[slug] || MODULE_ALIASES[slug.toLowerCase()];
  if (aliased && AOS_MODULE_COMPONENTS[aliased]) {
    return AOS_MODULE_COMPONENTS[aliased];
  }

  // 3. Dashed normalization (e.g. "bulk_uploads" -> "bulk-uploads")
  const dashed = slug.toLowerCase().replace(/_/g, "-");
  if (AOS_MODULE_COMPONENTS[dashed]) {
    return AOS_MODULE_COMPONENTS[dashed];
  }

  // 4. Plugin runner pattern (e.g. "plugin-physics-ai", "plugin-attendance")
  if (slug.startsWith("plugin-")) {
    return AOS_MODULE_COMPONENTS["plugin-runner"];
  }

  // 5. Fallback safe placeholder
  return createFallbackComponent(slug);
}

