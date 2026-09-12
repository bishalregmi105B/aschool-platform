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
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <div className="text-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Redirecting to Attendance...</p>
      </div>
    </div>
  );
}
