/** Fire-and-forget on-demand revalidation of the public school site.
 *
 *  Call from website-builder mutation onSuccess handlers so publish/unpublish,
 *  config, theme, SEO and section edits are visible on /school/[slug]
 *  immediately instead of after the 5-minute ISR window.
 */
export async function revalidateSchoolSite(slug?: string): Promise<void> {
  try {
    await fetch("/revalidate-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slug || "" }),
    });
  } catch {
    // Non-fatal: the public site still refreshes via its ISR window.
  }
}
