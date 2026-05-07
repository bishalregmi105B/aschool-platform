import { notFound } from "next/navigation";
import { PortalSectionPage } from "@/components/portal/portal-section-page";
import { isKnownPortalRoute } from "@/lib/portal-route-meta";

export default function TeacherPortalSectionPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!isKnownPortalRoute("teacher", params.slug)) {
    notFound();
  }

  return <PortalSectionPage portal="teacher" slug={params.slug} />;
}