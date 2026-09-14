"use client";

/**
 * RoleRouteGuard — client-side defense-in-depth for role-scoped layouts.
 *
 * The edge middleware reads the (unverified) JWT role claim; this component
 * re-verifies against useAuth() after the client session hydrates (including
 * the refresh-cookie recovery flow) and redirects wrong-role users to their
 * own home. Admin-family roles (superadmin/school_admin) may inspect any
 * portal for support workflows.
 */
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { homeRouteForRole, isAdminLike } from "@/lib/role-routing";
import { Spinner } from "@/components/ui/spinner";

export function RoleRouteGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (isAdminLike(user.role)) return; // admins may inspect any portal
    if (!allowedRoles.includes(user.role)) {
      router.replace(homeRouteForRole(user.role));
    }
  }, [isLoading, user, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;
  if (!isAdminLike(user.role) && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
