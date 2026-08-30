/**
 * Super admin layout — server-side auth + role guard.
 *
 * Middleware keeps unauthenticated/non-superadmin visitors out, but JWTs can't
 * be signature-verified at the edge, so this layout re-checks the session
 * against the backend (/auth/me verifies the HttpOnly access_token cookie and
 * returns the user; role must be "superadmin" — the same check the backend's
 * @superadmin_required decorator enforces on every super-admin API route).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("access_token")?.value;
  let isSuperadmin = false;

  if (token) {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Cookie: `access_token=${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        isSuperadmin = json?.data?.role === "superadmin";
      }
    } catch {
      isSuperadmin = false;
    }
  }

  if (!isSuperadmin) {
    redirect("/login");
  }

  return <>{children}</>;
}
