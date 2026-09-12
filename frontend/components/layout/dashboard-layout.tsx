"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useViewMode } from "@/lib/view-mode-context";
import { PageLoader } from "@/components/ui/spinner";

const AOSDesktopShell = dynamic(
  () => import("@/components/aos/AOSDesktopShell"),
  {
    loading: () => <PageLoader />,
    ssr: false,
  }
);

const MobileExperience = dynamic(
  () => import("@/components/aos/MobileExperience"),
  {
    loading: () => <PageLoader />,
    ssr: false,
  }
);

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAOSDesktop, isAOSMobile } = useViewMode();

  if (isAOSDesktop) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AOSDesktopShell />
      </Suspense>
    );
  }

  if (isAOSMobile) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MobileExperience />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 p-4 compact-content">{children}</main>
      </div>
    </div>
  );
}
