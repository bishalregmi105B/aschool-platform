/**
 * Plugin slug aliases — one client-side copy, hydrated from the backend.
 *
 * The alias table used to be transcribed by hand in three places
 * (`lib/plugins.tsx`, `lib/api.ts`, and the backend's
 * `app/plugins/decorators.py`), and the copies drifted every time two plugins
 * merged. The backend now serves the effective map at `GET /plugins/aliases`
 * (manifest `aliases:` ∪ the hardcoded table); this module caches it and keeps
 * the literals below only as an offline/SSR fallback so a failed fetch degrades
 * to yesterday's behaviour instead of ungating everything.
 *
 * Expansion is SINGLE-HOP, matching `_acceptable_plugin_slugs` in the backend:
 * a slug, its direct alias target, and any legacy slug pointing directly at it.
 * Chains are deliberately not followed, so an alias can never unlock a third
 * plugin's routes.
 */

/** Offline fallback. Mirrors app/plugins/decorators.py PLUGIN_SLUG_ALIASES. */
export const FALLBACK_PLUGIN_ALIASES: Record<string, string> = {
  communications: "sms_notifications",
  hr: "hr_payroll",
  transport: "gps_tracking",
  visitors: "visitor_management",
  library: "library_management",
  digital_content: "elibrary",
  portfolio: "student_portfolio",
  // AI Suite bundle: one install satisfies every ai_* / benchmarking /
  // advanced_analytics gate. Aliases are kept, not removed, so legacy installs
  // of the individual plugins keep passing their own gates.
  ai_grading: "ai_suite",
  ai_tutor: "ai_suite",
  ai_tools: "ai_suite",
  ai_adaptive_learning: "ai_suite",
  ai_insights: "ai_suite",
  benchmarking: "ai_suite",
  advanced_analytics: "ai_suite",
};

/** Offline fallback display labels; the backend sends manifest `name` values. */
export const FALLBACK_PLUGIN_LABELS: Record<string, string> = {
  design_studio: "Docs & Designer",
  attendance: "Attendance",
  fees: "Fees",
  exams: "Exams",
  lms: "Learning Management",
  library_management: "Library Management",
  gps_tracking: "Transport",
  hr_payroll: "HR & Payroll",
  sms_notifications: "Communications",
  whatsapp_bot: "WhatsApp Bot",
  ai_suite: "AI Suite",
  ai_teacher: "AI Teacher",
  elibrary: "E-Library & Digital Content",
  website_builder: "Website Builder",
  gamification: "Gamification",
  alumni: "Alumni",
  visitor_management: "Visitor Management",
  file_management: "Files",
  iemis_importer: "IEMIS Importer",
  admission: "Admission CRM",
  assignments: "Assignments & Homework",
  basic_reports: "Basic Reports",
  biometric: "Biometric Integration",
  compliance: "Government Compliance",
  conferences: "PT Conference Scheduler",
  disaster_management: "Disaster Management",
  dismissal: "Student Dismissal/Pickup",
  emergency: "Emergency Alerts",
  health_records: "Health Records",
  incident_management: "Full Incident Management",
  incidents: "Incident Reporting",
  inventory: "Inventory & Assets",
  multi_branch: "Multi-Branch Chain",
  notices: "Notices & Circulars",
  student_portfolio: "Student Portfolio",
  timetable: "Timetable Management",
  wellbeing: "Student Wellbeing",
  white_label: "White-Label Branding",
};

export interface PluginAliasPayload {
  aliases: Record<string, string>;
  labels: Record<string, string>;
  labels_nepali?: Record<string, string | null>;
}

let aliasMap: Record<string, string> = { ...FALLBACK_PLUGIN_ALIASES };
let labelMap: Record<string, string> = { ...FALLBACK_PLUGIN_LABELS };
let labelMapNepali: Record<string, string> = {};
let hydrated = false;

/** Replace the cached maps with the server's. Called once by PluginProvider. */
export function hydratePluginAliases(payload: PluginAliasPayload): void {
  if (payload?.aliases && Object.keys(payload.aliases).length) {
    aliasMap = { ...FALLBACK_PLUGIN_ALIASES, ...payload.aliases };
  }
  if (payload?.labels && Object.keys(payload.labels).length) {
    labelMap = { ...FALLBACK_PLUGIN_LABELS, ...payload.labels };
  }
  if (payload?.labels_nepali) {
    labelMapNepali = Object.fromEntries(
      Object.entries(payload.labels_nepali).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  }
  hydrated = true;
}

export function pluginAliasesHydrated(): boolean {
  return hydrated;
}

/** Canonical slug for a (possibly legacy) slug. */
export function normalizePluginSlug(slug: string): string {
  return aliasMap[slug] ?? slug;
}

/** The slug plus its single-hop equivalents — mirrors the backend gate. */
export function getAcceptablePluginSlugs(slug: string): Set<string> {
  const requested = String(slug || "").trim();
  const accepted = new Set<string>();
  if (!requested) return accepted;

  accepted.add(requested);
  const mapped = aliasMap[requested];
  if (mapped) accepted.add(mapped);
  for (const [from, to] of Object.entries(aliasMap)) {
    if (to === requested) accepted.add(from);
  }
  return accepted;
}

/** Human label for a slug, preferring Nepali when the user reads Nepali. */
export function getPluginDisplayName(slug: string, language?: string): string {
  const canonical = normalizePluginSlug(slug);
  if (language === "ne") {
    const nepali = labelMapNepali[canonical] || labelMapNepali[slug];
    if (nepali) return nepali;
  }
  return labelMap[canonical] || labelMap[slug] || slug.replace(/_/g, " ");
}
