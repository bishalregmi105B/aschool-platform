/** On-demand ISR revalidation for the public school sites.
 *
 *  The public /school/[slug] pages fetch school data with
 *  `next: { revalidate: 300, tags: ["school-<slug>"] }`. Without on-demand
 *  revalidation a freshly published/edited builder config could take up to
 *  five minutes to appear on the public site (stale ISR data cache).
 *
 *  Called by the website-builder pages after publish/unpublish/config/
 *  section/template mutations. Authenticated dashboard sessions only.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ revalidated: false, error: "Unauthorized" }, { status: 401 });
  }

  let slug = "";
  try {
    const body = await req.json();
    slug = String(body?.slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
  } catch {
    // no body → revalidate all school pages
  }

  // Invalidate the data cache for this school's public fetches…
  if (slug) revalidateTag(`school-${slug}`);
  // …and the route cache for every /school/[slug]/* page (dynamic layout).
  revalidatePath("/school/[slug]", "layout");

  return NextResponse.json({ revalidated: true, slug, now: Date.now() });
}
