"use client";

// Registry launch alias: AOSRouteTable maps `attendance__mark` here. Plan 34
// says delete it — AOSRouteTable still imports this file, so wave A keeps it
// but routes through the shell's in-process navigation (opens/focuses the
// Attendance window + real URL) instead of forcing a full Next navigation.
// FLAG: registry can drop `attendance__mark` (and the academics stub keys)
// once subroute deep-links resolve to `?tab=` targets natively.
import { useEffect } from "react";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

export default function MarkAttendanceRedirect() {
  const navigate = useAOSRouterNavigate();
  const { t } = useI18n();

  useEffect(() => {
    navigate("/dashboard/attendance");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-full text-[color:var(--w11-text-secondary)]">
      <div className="text-center">
        <div className="win11-spinner mx-auto mb-3" />
        <p className="text-sm">{t("Opening Attendance…", "उपस्थिति खोल्दै…")}</p>
      </div>
    </div>
  );
}
