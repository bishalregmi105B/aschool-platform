import { normalizeAOSModuleId, type AOSApp } from "@/lib/aos-app-adapter";
import type { PluginSidebarItem } from "@/lib/plugins";

/**
 * Desktop folder model — user-organizable app groups (macOS-style) persisted
 * per-user via aos_settings.desktop_folders.
 */
export interface AOSDesktopFolder {
  id: string;
  name: string;
  appIds: string[];
}

/** A folder resolved against the live app list (apps that exist & are authorized). */
export type ResolvedAOSDesktopFolder = AOSDesktopFolder & { apps: AOSApp[] };

export const FOLDER_NAME_MAX_LENGTH = 40;

/** "Safety & Compliance" -> "safety-compliance" (always non-empty). */
export function slugifyFolderName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "folder";
}

/**
 * Section lookup by normalized AOS module id, built from the plugin sidebar
 * manifest. First occurrence wins (subitems can normalize to their parent).
 */
function buildSectionByModuleId(
  sidebarItems: PluginSidebarItem[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of sidebarItems) {
    const moduleId = normalizeAOSModuleId(item.slug, item.route);
    if (!moduleId || map.has(moduleId)) continue;
    const section = (item.section || "").trim();
    if (section) map.set(moduleId, section);
  }
  return map;
}

/**
 * Default folder organization, derived from plugin manifest sections.
 *
 * - Apps are grouped by their sidebar item section (falling back to the
 *   app's own category when it carries a real section, e.g. drawer-only apps).
 * - Sections with 2+ apps become folders named after the section
 *   ("Academics", "Money", "Learning", ...) with stable `folder-<slug>` ids.
 * - Apps in sections with fewer than 2 apps — or with no section — stay loose.
 */
export function getDefaultFolders(
  apps: AOSApp[],
  sidebarItems: PluginSidebarItem[] = []
): AOSDesktopFolder[] {
  const sectionByModuleId = buildSectionByModuleId(sidebarItems);

  const bySection = new Map<string, string[]>();
  const seenApps = new Set<string>();
  for (const app of apps) {
    if (seenApps.has(app.id)) continue;
    seenApps.add(app.id);

    const section = sectionByModuleId.has(app.id)
      ? sectionByModuleId.get(app.id)!
      : app.category && app.category !== "General" && app.category !== "System"
        ? app.category
        : null;
    if (!section) continue;

    const ids = bySection.get(section) ?? [];
    if (!ids.includes(app.id)) ids.push(app.id);
    bySection.set(section, ids);
  }

  return Array.from(bySection.entries())
    .filter(([, appIds]) => appIds.length >= 2)
    .map(([section, appIds]) => ({
      id: `folder-${slugifyFolderName(section)}`,
      name: section,
      appIds,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve folders against the live app list:
 * - folders keep only apps that still exist & are authorized (stale ids dropped);
 * - an app appears in a folder OR loose, never both — folder membership wins
 *   (when two folders claim the same app, the first folder in the list wins);
 * - folders with no resolvable apps are hidden (they return once apps do).
 */
export function resolveDesktopLayout(
  apps: AOSApp[],
  folders: AOSDesktopFolder[]
): { folders: ResolvedAOSDesktopFolder[]; looseApps: AOSApp[] } {
  const appById = new Map<string, AOSApp>();
  for (const app of apps) {
    if (!appById.has(app.id)) appById.set(app.id, app);
  }

  const claimed = new Set<string>();
  const resolvedFolders: ResolvedAOSDesktopFolder[] = [];
  for (const folder of folders) {
    const folderApps: AOSApp[] = [];
    const folderAppIds: string[] = [];
    for (const appId of folder.appIds) {
      const app = appById.get(appId);
      if (!app || claimed.has(appId)) continue;
      claimed.add(appId);
      folderAppIds.push(appId);
      folderApps.push(app);
    }
    if (folderApps.length === 0) continue;
    resolvedFolders.push({ ...folder, appIds: folderAppIds, apps: folderApps });
  }

  const looseApps: AOSApp[] = [];
  const seenLoose = new Set<string>();
  for (const app of apps) {
    if (claimed.has(app.id) || seenLoose.has(app.id)) continue;
    seenLoose.add(app.id);
    looseApps.push(app);
  }

  return { folders: resolvedFolders, looseApps };
}

/**
 * Sanitize a persisted (or incoming) desktop_folders payload. Invalid entries
 * are dropped; names are trimmed/capped; ids and appIds deduped.
 */
export function parseDesktopFolders(raw: unknown): AOSDesktopFolder[] {
  if (!Array.isArray(raw)) return [];

  const folders: AOSDesktopFolder[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, appIds } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof name !== "string" || !name.trim()) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const ids: string[] = [];
    if (Array.isArray(appIds)) {
      for (const appId of appIds) {
        if (typeof appId === "string" && appId && !ids.includes(appId)) {
          ids.push(appId);
        }
      }
    }
    folders.push({
      id,
      name: name.trim().slice(0, FOLDER_NAME_MAX_LENGTH),
      appIds: ids,
    });
  }
  return folders;
}

/** Returns an error message for an invalid folder name, or null when valid. */
export function validateFolderName(
  name: string,
  folders: AOSDesktopFolder[],
  excludeFolderId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a folder name.";
  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) {
    return `Folder names must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const duplicate = folders.some(
    (f) =>
      f.id !== excludeFolderId &&
      f.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return "A folder with this name already exists.";
  return null;
}

/** "New Folder", "New Folder 2", "New Folder 3", ... */
export function generateUniqueFolderName(
  folders: AOSDesktopFolder[]
): string {
  const existing = new Set(folders.map((f) => f.name.trim().toLowerCase()));
  const base = "New Folder";
  if (!existing.has(base.toLowerCase())) return base;
  let n = 2;
  while (existing.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** folder-<slug(name)> with a numeric suffix on id collisions. */
export function createFolderId(
  name: string,
  folders: AOSDesktopFolder[]
): string {
  const base = `folder-${slugifyFolderName(name)}`;
  const existing = new Set(folders.map((f) => f.id));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ── Desktop layout (icon positions + widget arrangement) ───────────────────
//
// Persisted per-user via aos_settings.desktop_layout as:
//   {
//     iconPositions: { [appIdOrFolderId]: { col, row } },
//     widgetLayout:  { [widgetKey]: { size: "s"|"m"|"l", order: number } }
//   }

/** Grid cell a desktop icon/folder tile snaps to. */
export interface AOSDesktopIconPosition {
  col: number;
  row: number;
}

/** A widget's arrangement in the desktop column / board grid. */
export interface AOSWidgetLayoutEntry {
  size: "s" | "m" | "l";
  order: number;
}

/**
 * The persisted desktop layout. Declared as a type alias (not an interface)
 * so it stays assignable to Record<string, unknown> — the settings API and
 * the shell pass it around as a free-form record.
 */
export type AOSDesktopLayout = {
  iconPositions: Record<string, AOSDesktopIconPosition>;
  widgetLayout: Record<string, AOSWidgetLayoutEntry>;
};

export const EMPTY_DESKTOP_LAYOUT: AOSDesktopLayout = {
  iconPositions: {},
  widgetLayout: {},
};

const WIDGET_SIZES = new Set<string>(["s", "m", "l"]);

/**
 * Sanitize a persisted (or incoming) desktop_layout payload. Unknown keys and
 * malformed entries are dropped so a corrupt payload can never break layout
 * math; unknown top-level fields pass through untouched (forward compat).
 */
export function parseDesktopLayout(raw: unknown): AOSDesktopLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { iconPositions: {}, widgetLayout: {} };
  }
  const source = raw as Record<string, unknown>;

  const iconPositions: Record<string, AOSDesktopIconPosition> = {};
  if (source.iconPositions && typeof source.iconPositions === "object") {
    for (const [id, value] of Object.entries(source.iconPositions as Record<string, unknown>)) {
      if (!id || !value || typeof value !== "object") continue;
      const { col, row } = value as Record<string, unknown>;
      const c = Number(col);
      const r = Number(row);
      if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c > 500 || r > 500) {
        continue;
      }
      iconPositions[id] = { col: c, row: r };
    }
  }

  const widgetLayout: Record<string, AOSWidgetLayoutEntry> = {};
  if (source.widgetLayout && typeof source.widgetLayout === "object") {
    for (const [key, value] of Object.entries(source.widgetLayout as Record<string, unknown>)) {
      if (!key || !value || typeof value !== "object") continue;
      const { size, order } = value as Record<string, unknown>;
      const o = Number(order);
      widgetLayout[key] = {
        size:
          typeof size === "string" && WIDGET_SIZES.has(size)
            ? (size as AOSWidgetLayoutEntry["size"])
            : "s",
        order: Number.isInteger(o) && o >= 0 ? o : 0,
      };
    }
  }

  return { iconPositions, widgetLayout };
}
