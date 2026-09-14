/**
 * Role-based post-login routing.
 *
 * One source of truth for "where does this role call home" — login redirect,
 * already-authenticated visits to /login, and wrong-role layout fallbacks all
 * read this. Mirrors the backend role enum exactly (user.py): the AOS shell
 * previously compared against "admin", which never matches the backend's
 * "school_admin" — this module normalizes once so that class of bug can't
 * recur.
 */

export type BackendRole =
  | "superadmin"
  | "school_admin"
  | "accountant"
  | "teacher"
  | "staff"
  | "parent"
  | "student";

/** Roles allowed into the full admin AOS desktop. */
export const DESKTOP_ROLES: BackendRole[] = [
  "superadmin",
  "school_admin",
  "accountant",
  "teacher",
  "staff",
];

export function normalizeRole(role?: string | null): BackendRole | null {
  switch (role) {
    case "superadmin":
    case "school_admin":
    case "accountant":
    case "teacher":
    case "staff":
    case "parent":
    case "student":
      return role;
    // Legacy/defensive: some older shells defaulted to "admin".
    case "admin":
      return "school_admin";
    default:
      return null;
  }
}

/** True for roles whose home is the full AOS desktop. */
export function isDesktopRole(role?: string | null): boolean {
  return DESKTOP_ROLES.includes(normalizeRole(role) as BackendRole);
}

/** Administrative roles (see admin-like checks in Dock/Drawer/Spotlight). */
export function isAdminLike(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === "superadmin" || r === "school_admin";
}

export function isAccountantLike(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === "accountant" || isAdminLike(r);
}

/** Where this role lands after login. */
export function homeRouteForRole(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "superadmin":
      return "/super-admin";
    case "student":
      return "/student";
    case "parent":
      return "/parent";
    case "teacher":
      return "/teacher";
    default:
      // school_admin, accountant, staff (and unknown roles) → the desktop.
      return "/dashboard";
  }
}

/**
 * Resolve the post-login destination: honor ?next= (deep link) when it is a
 * safe relative path, else the role's home. Absolute/protocol-relative URLs
 * are rejected (open-redirect guard).
 */
export function postLoginDestination(role?: string | null, next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return homeRouteForRole(role);
}
