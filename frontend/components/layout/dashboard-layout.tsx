"use client";

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/spinner";
import { AOS_MODE_STORAGE_KEY } from "@/lib/aos-navigation";

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

// Viewport alone decides mobile unless the user flipped the manual
// desktop/iOS override pill (persisted in localStorage).
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const update = () => {
      let modeOverride: string | null = null;
      try {
        modeOverride = localStorage.getItem(AOS_MODE_STORAGE_KEY);
      } catch {
        // Ignore storage access issues
      }
      if (modeOverride === "mobile") {
        setIsMobile(true);
        return;
      }
      if (modeOverride === "desktop") {
        setIsMobile(false);
        return;
      }
      setIsMobile(mediaQuery.matches);
    };

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
