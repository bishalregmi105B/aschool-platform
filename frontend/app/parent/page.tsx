"use client";

/**
 * Parent → Home (A9/44.2).
 *
 * The old page was a fixed 6-tile KPI grid where "Bus Status: Live" was a
 * hardcoded lie and there was no way to act on a specific child. Now:
 * a child switcher (persisted) drives a Today card for the selected child —
 * attendance chip, dues with a Pay/Fees link, and deep links that carry
 * ?student_id so every child-scoped page opens on the right child.
 *
 * Research notes: multi-child parent apps (Mighty's mirror) succeed when the
 * switcher is the FIRST control and every sub-page inherits its selection;
 * the today-card pattern (greeting + one focal status + ≤4 actions) is the
 * M1/A7 grammar the plan standardised on.
 */

import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import {
  Bus,
  CalendarCheck,
  CreditCard,
  Heart,
  MessageCircle,
  Bell,
  Users,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { StatusChip, DataPanel } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { ChildSwitcher, useSelectedChild } from "@/components/portal/child-switcher";
import { Avatar } from "@/components/ui/avatar";

export default function ParentDashboard() {
  const { user } = useAuth();
  const { dash, children, selected, childParam } = useSelectedChild();

  if (dash.isLoading) return <SkeletonList rows={6} />;
  if (dash.isError) return <ErrorState title="Couldn't load your dashboard" onRetry={() => dash.refetch()} />;

  const notices = (dash.data?.recent_notices as { id: string; title: string; date?: string }[]) || [];
  const q = childParam ? `?${childParam}` : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {user?.full_name ? `Hello, ${user.full_name.split(" ")[0]}` : "Parent Portal"}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {children.length} linked child{children.length === 1 ? "" : "ren"} ·{" "}
          {displayBS(new Date().toISOString().slice(0, 10))}
        </p>
      </div>

      <ChildSwitcher />

      {children.length === 0 ? (
        <EmptyState
          icon={Users}
          variant="dependency"
          title="No students linked to this account yet"
          body="When the school admits your child it links your phone number here. Contact the office if you think a child is missing."
        />
      ) : selected ? (
        <>
          {/* Today card for the selected child */}
          <div
            className="win11-card rounded-xl border p-4"
            style={{ borderColor: "var(--w11-border-default)" }}
          >
            <div className="flex items-start gap-3">
              <Avatar name={selected.name} src={selected.photo_url} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--w11-text-primary)" }}>
                    {selected.name}
                  </h2>
                  <span className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                    {selected.class_name || "—"}
                    {selected.roll_no ? ` · Roll ${selected.roll_no}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  Today:{" "}
                  {selected.today_status ? (
                    <StatusChip
                      status={selected.today_status === "present" ? "present" : selected.today_status === "absent" ? "absent" : "pending"}
                      label={selected.today_status.replace("_", " ")}
                    />
                  ) : (
                    <span>Not marked yet</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <TodayTile
                href={`/parent/attendance${q}`}
                icon={CalendarCheck}
                label="Attendance"
                value={`${selected.attendance_pct ?? 0}%`}
                hint={`${selected.attendance_pct ?? 0}% days present`}
                flag={(selected.attendance_pct ?? 100) < 75 ? "low" : undefined}
              />
              <TodayTile
                href={`/parent/fees${q}`}
                icon={CreditCard}
                label="Fees due"
                value={`Rs. ${(selected.fees_due || 0).toLocaleString()}`}
                hint={selected.fees_due ? "Tap to view invoices" : "All settled"}
                flag={selected.fees_due ? "due" : undefined}
              />
              <TodayTile href={`/parent/results${q}`} icon={GraduationCap} label="Results" value="View" hint="Published exams" />
              <TodayTile href={`/parent/bus`} icon={Bus} label="School bus" value="Track" hint="Live location" />
              <TodayTile href={`/parent/health${q}`} icon={Heart} label="Health" value="View" hint="Records & visits" />
              <TodayTile href={`/parent/conferences`} icon={ClipboardList} label="Conferences" value="Book" hint="PT meet slots" />
            </div>
          </div>

          {/* Notices */}
          <DataPanel
            title={
              <span className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4" /> Recent Notices
              </span>
            }
            actions={
              <Link href="/parent/notices" className="text-xs font-medium text-[var(--w11-accent)] hover:underline">
                All →
              </Link>
            }
          >
            {notices.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                No notices for parents yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id} className="border-b py-2 last:border-0" style={{ borderColor: "var(--w11-border-subtle)" }}>
                    <p className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>{n.title}</p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{n.date || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>

          <DataPanel title={<span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Quick actions</span>}>
            <div className="flex flex-wrap gap-2">
              <Link href="/parent/chat" className="win11-btn rounded-lg border px-4 py-2.5 text-sm font-medium min-h-[44px] inline-flex items-center">
                Message a teacher
              </Link>
              <Link href="/parent/wellbeing" className="win11-btn rounded-lg border px-4 py-2.5 text-sm font-medium min-h-[44px] inline-flex items-center">
                Wellbeing check-ins
              </Link>
            </div>
          </DataPanel>
        </>
      ) : null}
    </div>
  );
}

function TodayTile({
  href,
  icon: Icon,
  label,
  value,
  hint,
  flag,
}: {
  href: string;
  icon: typeof Bus;
  label: string;
  value: string;
  hint?: string;
  flag?: "low" | "due";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 min-h-[64px] hover:bg-[var(--w11-control-hover)] transition-colors"
      style={{ borderColor: "var(--w11-border-default)" }}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ background: "var(--w11-subtle,rgba(0,0,0,.05))" }}
      >
        <Icon className="h-4 w-4" style={{ color: flag === "due" ? "#c42b1c" : flag === "low" ? "#eaa300" : "var(--w11-accent)" }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold" style={{ color: "var(--w11-text-primary)" }}>{value}</span>
        <span className="block text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>{label}{hint ? ` · ${hint}` : ""}</span>
      </span>
    </Link>
  );
}
