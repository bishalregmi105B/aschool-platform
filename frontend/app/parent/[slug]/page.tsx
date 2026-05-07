import { notFound } from "next/navigation";
import { PortalSectionPage } from "@/components/portal/portal-section-page";
import { isKnownPortalRoute } from "@/lib/portal-route-meta";

export default function ParentPortalSectionPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!isKnownPortalRoute("parent", params.slug)) {
    notFound();
  }

  return <PortalSectionPage portal="parent" slug={params.slug} />;
}