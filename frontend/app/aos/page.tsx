"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/spinner";

export default function AOSPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return <PageLoader />;
}
