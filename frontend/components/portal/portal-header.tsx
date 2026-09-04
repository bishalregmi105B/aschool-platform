import Link from "next/link";

export type PortalName = "parent" | "student" | "teacher";

/** Shared portal page header: title + back-to-portal-home link. */
export function PortalHeader({ portal, title }: { portal: PortalName; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Link
        href={`/${portal}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Portal home
      </Link>
    </div>
  );
}

/** Compact stat tile used across portal pages. */
export function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm px-6 py-6 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
