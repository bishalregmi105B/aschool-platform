import { redirect } from "next/navigation";

/**
 * FC-C01: consolidated away — /dashboard/website-builder is the single
 * website surface (status + editor + pages + themes + SEO + domain). This
 * settings page was a third overlapping entry point that drifted out of
 * sync with the builder.
 */
export default function WebsiteDesignRedirect() {
  redirect("/dashboard/website-builder");
}
