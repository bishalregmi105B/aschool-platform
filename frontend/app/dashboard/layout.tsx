"use client";

import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageLoader } from "@/components/ui/spinner";
import { AOS_EMBED_QUERY_KEY } from "@/lib/aos-navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEmbeddedContext, setIsEmbeddedContext] = useState(false);

  useEffect(() => {
    let embedded = searchParams.get(AOS_EMBED_QUERY_KEY) === "1";
    try {
      if (window.self !== window.top) {
        embedded = true;
      }
    } catch {
      embedded = true;
    }
    setIsEmbeddedContext(embedded);
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return null;
  if (isEmbeddedContext) return <>{children}</>;

  return <DashboardLayout>{children}</DashboardLayout>;
}
