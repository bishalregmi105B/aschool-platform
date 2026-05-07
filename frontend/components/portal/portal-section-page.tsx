import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getPortalHomeHref,
  getPortalRouteMeta,
  type PortalName,
} from "@/lib/portal-route-meta";

export function PortalSectionPage({
  portal,
  slug,
}: {
  portal: PortalName;
  slug: string;
}) {
  const meta = getPortalRouteMeta(portal, slug);
  const homeHref = getPortalHomeHref(portal);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{meta.title}</h1>
        <p className="text-muted-foreground">{meta.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section Ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{meta.guidance}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={homeHref}>Back To Portal Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}