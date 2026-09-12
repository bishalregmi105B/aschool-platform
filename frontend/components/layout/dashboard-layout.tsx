"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
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
  const { isAOSMobile } = useViewMode();

  if (isAOSMobile) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MobileExperience />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <AOSDesktopShell />
    </Suspense>
  );
}
