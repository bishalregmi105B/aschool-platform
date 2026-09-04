import { notFound } from "next/navigation";

// Every known student-portal route has a real page under app/student/<route>/.
// This catch-all therefore has nothing to serve — unknown slugs are an honest 404
// (the old "Coming soon" placeholder is retired in the portal pass, 2026-09-05).
export default function StudentPortalCatchAll() {
  notFound();
}
