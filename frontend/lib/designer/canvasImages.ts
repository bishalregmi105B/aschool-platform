"use client";

/**
 * canvasImages — bulletproof image loading for fabric canvas JSON.
 *
 * fabric v6 `loadFromJSON` rejects as a WHOLE when any embedded image fails
 * to load (404, CORS, offline) — one broken student photo blanked entire
 * exports. This module pre-fetches every http(s) image src, converts it to a
 * data-URI (data URIs never taint the canvas and never reject), and falls
 * back to an initials avatar for photo slots that can't be resolved.
 */

const AVATAR_W = 136;
const AVATAR_H = 180;

export function initialsAvatarUri(name: string): string {
  const initial = (name || "S").trim().charAt(0).toUpperCase() || "S";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${AVATAR_W}' height='${AVATAR_H}'>` +
    `<rect width='100%' height='100%' fill='#dbeafe'/>` +
    `<text x='50%' y='54%' font-family='Arial' font-size='64' font-weight='bold' ` +
    `fill='#1e40af' text-anchor='middle' dominant-baseline='middle'>${initial}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
}

/** Resolve a src to an absolute URL (relative /uploads → API origin). */
function absolutize(src: string): string {
  if (src.startsWith("/")) return `${apiBase() || window.location.origin}${src}`;
  return src;
}

/**
 * Public form of `absolutize` for UI code (same pattern as CanvasEditor's
 * applyDataFields): relative "/uploads/..." paths must hit the API origin,
 * not the frontend one. Other URLs pass through untouched.
 */
export function absolutizeImageUrl(src: string): string {
  return absolutize(src);
}

async function fetchAsDataUrl(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, mode: "cors" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size === 0) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const fetchCache = new Map<string, Promise<string | null>>();

function cachedFetch(url: string): Promise<string | null> {
  let p = fetchCache.get(url);
  if (!p) {
    p = fetchAsDataUrl(url);
    fetchCache.set(url, p);
    // evict failures so a later retry can succeed (network flake)
    p.then((r) => { if (r === null) setTimeout(() => fetchCache.delete(url), 15000); });
  }
  return p;
}

// ── interactive image insertion (addImage / drag-drop / paste) ────────────
//
// The preload path above returns null on failure (one broken photo must not
// blank a template load). The interactive path below is different: the user
// explicitly asked for THIS image, so it throws a meaningful error instead
// of failing silently, and it goes to greater lengths to actually load:
//
//  - Same-origin first: next.config.js rewrites `/uploads/:path*` and
//    `/api/:path*` to the backend, so fetching those paths against the
//    FRONTEND origin needs no CORS at all (R2/API origins may not send any).
//  - `credentials: "include"` mirrors lib/api.ts (session tokens are
//    HttpOnly cookies via withCredentials — there is no JWT header) so
//    school-scoped upload URLs authenticate.

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("could not read image data"));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageToDataUrl(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      mode: "cors",
      credentials: "include", // replicate axios withCredentials (cookie session)
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    if (blob.size === 0) throw new Error("empty response body");
    if (blob.type && !blob.type.startsWith("image/")) {
      throw new Error(`not an image (${blob.type})`);
    }
    return await blobToDataUrl(blob);
  } catch (err) {
    const raw = err instanceof Error ? err : new Error(String(err));
    let reason: string;
    if (raw.name === "AbortError") reason = `timed out after ${(timeoutMs / 1000).toFixed(0)}s`;
    else if (raw.name === "TypeError") reason = "network or CORS error";
    else reason = raw.message || "unknown error";
    throw new Error(`${reason} (${new URL(url, window.location.origin).host})`);
  } finally {
    clearTimeout(timer);
  }
}

/** All URLs worth trying for one image source (same-origin rewrite first). */
function imageSrcCandidates(url: string): string[] {
  const out: string[] = [];
  const push = (u: string) => {
    try {
      const abs = new URL(u, window.location.origin).href;
      if (!out.includes(abs)) out.push(abs);
    } catch { /* unparsable — skip */ }
  };
  if (url.startsWith("/")) {
    // 1) same-origin → Next.js rewrite forwards to the backend (no CORS)
    // 2) direct API origin (in case the rewrite isn't available)
    push(`${window.location.origin}${url}`);
    push(`${apiBase()}${url}`);
  } else {
    push(url);
    // a URL built against the API origin also exists behind the same path on
    // the frontend origin (rewrite) — retry there if the direct one fails
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin !== window.location.origin && parsed.pathname.startsWith("/uploads/")) {
        push(`${parsed.pathname}${parsed.search}`);
      }
    } catch { /* not a parseable URL — nothing else to try */ }
  }
  return out;
}

const resolveCache = new Map<string, Promise<string>>();

/**
 * Resolve any image source (http(s) URL, relative /uploads path, or data:
 * URI) into a guaranteed-loadable data URI for interactive canvas insertion.
 * data: URLs (including SVG data URLs) pass straight through. Throws an
 * Error with a meaningful message on failure — callers should surface it
 * (toast), never swallow it.
 */
export function resolveImageSrc(url: string, timeoutMs = 10000): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  const cached = resolveCache.get(url);
  if (cached) return cached;
  const task = (async () => {
    let lastError = "unknown error";
    for (const candidate of imageSrcCandidates(url)) {
      try {
        return await fetchImageToDataUrl(candidate, timeoutMs);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(lastError);
  })();
  resolveCache.set(url, task);
  // evict failures so a later attempt can retry (network flake, login, ...)
  task.catch(() => { setTimeout(() => resolveCache.delete(url), 15000); });
  return task;
}

export interface PreloadOptions {
  /** student/record name for the initials avatar fallback */
  fallbackName?: string;
  /** also resolve empty/token photo slots to the avatar (default true) */
  avatarForMissing?: boolean;
}

/**
 * Walk a canvas JSON and replace every image src with a guaranteed-loadable
 * data-URI. Returns the same JSON structure, safe for fabric loadFromJSON.
 */
export async function preloadCanvasImages(
  json: Record<string, any>,
  options: PreloadOptions = {},
): Promise<Record<string, any>> {
  const clone = JSON.parse(JSON.stringify(json ?? {}));
  const { fallbackName = "", avatarForMissing = true } = options;

  // collect image objects first so we can batch unique URLs
  const images: any[] = [];
  const walk = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (String(obj.type || "").toLowerCase() === "image") images.push(obj);
    Object.values(obj).forEach(walk);
  };
  walk(clone);

  await Promise.all(images.map(async (obj) => {
    const data = obj.data ?? {};
    const token: string = data.token || (typeof obj.src === "string" && obj.src.includes("{") ? obj.src : "");
    const isPhoto = /photo/i.test(token || "");

    let src: string = typeof obj.src === "string" ? obj.src : "";
    if (token.includes("{")) src = ""; // unresolved template token

    if (src.startsWith("data:")) {
      obj.src = src;
      return;
    }

    if (src) {
      const abs = absolutize(src);
      const asData = await cachedFetch(abs);
      if (asData) { obj.src = asData; return; }
      // unresolvable URL → avatar for photos, empty slot otherwise
      obj.src = isPhoto && avatarForMissing ? initialsAvatarUri(fallbackName || data.recordName || "S") : "";
      obj.srcOrigin = null;
      obj.crossOrigin = null;
      return;
    }

    // no src — QR objects re-render client-side elsewhere; photos get avatar
    if (isPhoto && avatarForMissing) {
      obj.src = initialsAvatarUri(fallbackName || data.recordName || "S");
    } else {
      obj.src = "";
      obj.srcOrigin = null;
      obj.crossOrigin = null;
    }
  }));

  return clone;
}
