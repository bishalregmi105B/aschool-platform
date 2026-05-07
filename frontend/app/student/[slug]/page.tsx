import { notFound } from "next/navigation";
import { PortalSectionPage } from "@/components/portal/portal-section-page";
import { isKnownPortalRoute } from "@/lib/portal-route-meta";

export default function StudentPortalSectionPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!isKnownPortalRoute("student", params.slug)) {
    notFound();
  }

  return <PortalSectionPage portal="student" slug={params.slug} />;
}