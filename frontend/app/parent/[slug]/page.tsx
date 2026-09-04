import { notFound } from "next/navigation";

// Every known parent-portal route has a real page under app/parent/<route>/.
// This catch-all therefore has nothing to serve — unknown slugs are an honest 404
// (the old "Coming soon" placeholder is retired in the portal pass, 2026-09-05).
export default function ParentPortalCatchAll() {
  notFound();
}
