/**
 * Widget binding resolution — the `$…` token language, and nothing more.
 *
 * A plugin's `widgets.yaml` describes data declaratively: `$today` for the date,
 * `$context.student_id` for whatever the host page knows, `$.summary.today_pct`
 * for a path into the fetched payload. This module resolves those tokens.
 *
 * Deliberately NOT a template language: no arithmetic, no conditionals, no
 * function calls. If a widget needs computation, the server computes it, or the
 * widget declares `renderer: component` and gets real code. That constraint is
 * what keeps the spec dialect from turning into a private programming language
 * nobody can debug.
 */

export type WidgetContext = Record<string, string | number | null | undefined>;

export interface BindingScope {
  /** Host-supplied values, e.g. the student profile page's student_id. */
  context?: WidgetContext;
  /** Next.js route params. */
  route?: WidgetContext;
  /** The widget's own per-school config. */
  config?: Record<string, unknown>;
  /** The fetched payload, for `$.path` tokens. */
  payload?: unknown;
  schoolId?: string | null;
  schoolSlug?: string | null;
  userId?: string | null;
  role?: string | null;
}

/** `YYYY-MM-DD` in the school's timezone (Asia/Kathmandu across the stack). */
function today(): string {
  const now = new Date();
  const offsetMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ktm = new Date(offsetMs + 5.75 * 3600 * 1000);
  return ktm.toISOString().slice(0, 10);
}

/**
 * Walk a dot/bracket path: `a.b[0].c`. Returns undefined on any miss rather
 * than throwing — a widget pointing at a field the API stopped returning should
 * render its empty state, not crash the dashboard.
 */
export function getPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let current: unknown = source;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Resolve one token. Non-token values pass through unchanged, so a spec can mix
 * literals and bindings (`label: "Present"`, `value: "$.present"`).
 */
export function resolveToken(token: unknown, scope: BindingScope): unknown {
  if (typeof token !== "string" || !token.startsWith("$")) return token;

  if (token === "$today") return today();
  if (token === "$now") return new Date().toISOString();
  if (token === "$school_id") return scope.schoolId ?? null;
  if (token === "$school_slug") return scope.schoolSlug ?? null;
  if (token === "$user_id") return scope.userId ?? null;
  if (token === "$role") return scope.role ?? null;

  if (token.startsWith("$context.")) {
    return scope.context?.[token.slice(9)] ?? null;
  }
  if (token.startsWith("$route.")) {
    return scope.route?.[token.slice(7)] ?? null;
  }
  if (token.startsWith("$config.")) {
    return scope.config?.[token.slice(8)] ?? null;
  }
  // `$.path` and `$[0].path` read the fetched payload.
  if (token.startsWith("$.") || token.startsWith("$[")) {
    const path = token.startsWith("$.") ? token.slice(2) : token.slice(1);
    return getPath(scope.payload, path);
  }

  // An unrecognized token resolves to null instead of leaking "$whatever" into
  // the UI as if it were a value.
  return null;
}

/** Interpolate tokens inside a string, e.g. `/students/$.student_id`. */
export function interpolate(template: string, scope: BindingScope): string {
  if (!template.includes("$")) return template;
  return template.replace(
    /\$(?:\.[\w.[\]]+|context\.\w+|route\.\w+|config\.\w+|today|now|school_id|school_slug|user_id|role)/g,
    (match) => {
      const value = resolveToken(match, scope);
      return value === null || value === undefined ? "" : String(value);
    }
  );
}

/** Resolve every token in a params object, dropping the unresolved ones. */
export function resolveParams(
  params: Record<string, unknown> | undefined,
  scope: BindingScope
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [key, raw] of Object.entries(params)) {
    const value = resolveToken(raw, scope);
    if (value === null || value === undefined || value === "") continue;
    out[key] = String(value);
  }
  return out;
}

/**
 * Build the request path for a widget's `data.endpoint`, substituting inline
 * tokens (`/attendance/student/$context.student_id/summary`).
 */
export function resolveEndpoint(
  endpoint: string,
  scope: BindingScope
): string | null {
  const resolved = interpolate(endpoint, scope);
  // A path with an unfilled segment (`//` or a trailing `/`) means a required
  // context value was missing; fetching it would 404 or, worse, hit a list
  // route. Returning null makes the widget show its empty state.
  if (/\/\//.test(resolved) || resolved.endsWith("/")) return null;
  return resolved;
}

// ── Value formatting (the `format:` key in a widget spec) ──────────────────

export type WidgetFormat =
  | "number"
  | "percent"
  | "npr"
  | "date"
  | "bs_date"
  | "datetime"
  | "relative"
  | "status_pill"
  | "text";

export function formatValue(
  value: unknown,
  format: WidgetFormat | undefined,
  language?: string
): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (format) {
    case "number":
      return Number(value).toLocaleString(language === "ne" ? "ne-NP" : "en-IN");
    case "percent": {
      const n = Number(value);
      return Number.isFinite(n) ? `${n.toFixed(n % 1 === 0 ? 0 : 1)}%` : "—";
    }
    case "npr": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "—";
      return `रु ${n.toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    }
    case "date":
      return new Date(String(value)).toLocaleDateString("en-CA");
    case "datetime":
      return new Date(String(value)).toLocaleString("en-CA");
    case "relative": {
      const then = new Date(String(value)).getTime();
      if (Number.isNaN(then)) return "—";
      const diffMin = Math.round((Date.now() - then) / 60_000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
      return `${Math.round(diffMin / 1440)}d ago`;
    }
    default:
      return String(value);
  }
}
