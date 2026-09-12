"use client";

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  if (isMobile) {
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
