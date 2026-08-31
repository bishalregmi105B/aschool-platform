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
