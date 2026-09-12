"use client";

// This page has been merged into /dashboard/attendance
// Redirect users seamlessly to the combined page
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarkAttendanceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/attendance");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full text-[color:var(--w11-text-secondary)]">
      <div className="text-center">
        <div className="win11-spinner mx-auto mb-3" />
        <p className="text-sm">Redirecting to Attendance...</p>
      </div>
    </div>
  );
}
