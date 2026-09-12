import { redirect } from "next/navigation";

interface LegacyAOSAppsRedirectProps {
  params: { slug?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
}

function appendSearchParams(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined> | undefined
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (typeof value === "string") {
      query.append(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function LegacyAOSAppsRedirect({
  params,
  searchParams,
}: LegacyAOSAppsRedirectProps) {
  const suffix = params.slug?.join("/") || "";
  const targetPath = suffix ? `/dashboard/${suffix}` : "/dashboard";
  redirect(appendSearchParams(targetPath, searchParams));
}
