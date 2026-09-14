"use client";

/**
 * Parent → Homework Monitor (NEW, R4d).
 *
 * GET /parent/assignments?student_id= → {pending: [...], submitted: [...]}
 * with {student_id, student_name, marks, feedback, status}. The "what's due,
 * what's late, what's graded" view per selected child — the parent's
 * homework supervisory role (distinct from the student's do-the-work role).
 */

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { KpiCard, StatGrid, StatusChip } from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import { useSelectedChild, ChildSwitcher } from "@/components/portal/child-switcher";
import { BookOpen } from "lucide-react";

type AssignmentRow = {
  id: string;
  title: string;
  subject_name?: string | null;
  due_date?: string | null;
  submitted_at?: string | null;
  is_late?: boolean;
  marks?: number | null;
  feedback?: string | null;
  status?: string | null;
};

type Payload = { pending?: AssignmentRow[]; submitted?: AssignmentRow[] };

export default function ParentHomeworkPage() {
  const { t } = useI18n();
  const { selected, childParam } = useSelectedChild();

  const hw = useQuery({
    queryKey: ["parent-assignments", selected?.id],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      const res = await api.get<ApiResponse<Payload>>("/parent/assignments", {
        params: { student_id: selected?.id },
      });
      return res.data.data;
    },
    retry: 1,
  });

  if (hw.isLoading) return <PageLoader />;
  if (hw.isError)
    return (
      <ErrorState
        title={t("Couldn't load homework", "गृहकार्य लोड गर्न सकिएन")}
        onRetry={() => hw.refetch()}
      />
    );

  const pending = hw.data?.pending || [];
  const submitted = hw.data?.submitted || [];
  const graded = submitted.filter((s) => s.status === "graded");
  const late = pending.filter((p) => p.is_late);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("Homework", "गृहकार्य")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("What's due and what's been graded.", "के बाँकी छ, के ग्रेड भयो।")}
        </p>
      </div>

      <ChildSwitcher />

      <StatGrid min={150}>
        <KpiCard label={t("Pending", "बाँकी")} value={pending.length} icon={<BookOpen className="h-4 w-4" />} />
        <KpiCard label={t("Overdue", "म्याद नाघेको")} value={late.length} color={late.length ? "#d83b01" : undefined} />
        <KpiCard label={t("Submitted", "बुझाइएको")} value={submitted.length} />
        <KpiCard label={t("Graded", "ग्रेड भएको")} value={graded.length} />
      </StatGrid>

      {pending.length === 0 && submitted.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("No homework", "गृहकार्य छैन")}
          body={t("Nothing assigned to your child right now.", "तपाईंको सन्तानलाई अहिले गृहकार्य दिइएको छैन।")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
                {t("To do", "गर्नुपर्ने")} · {pending.length}
              </h2>
              {pending.map((a) => {
                const overdue = a.due_date && a.due_date < today;
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border p-3.5"
                    style={{ borderColor: overdue ? "#d83b0166" : "var(--w11-border-default)" }}
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {a.title}
                      </p>
                      <StatusChip status={overdue ? "absent" : "pending"} label={overdue ? t("Overdue", "म्याद नाघेको") : t("Pending", "बाँकी")} />
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                      {[a.subject_name, a.due_date ? `${t("due", "बुझाउने")} ${displayBS(a.due_date)}` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                );
              })}
            </section>
          )}

          {submitted.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Submitted", "बुझाइएको")} · {submitted.length}
              </h2>
              {submitted.map((a) => (
                <div key={a.id} className="rounded-xl border p-3.5" style={{ borderColor: "var(--w11-border-default)" }}>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                      {a.title}
                    </p>
                    <StatusChip
                      status={a.status === "graded" ? "present" : "late"}
                      label={a.status === "graded" ? (t("Graded", "ग्रेड भयो")) : (t("Awaiting grading", "ग्रेड हुँदै"))}
                    />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {a.submitted_at ? displayBS(a.submitted_at.slice(0, 10)) : "—"}
                    {a.marks !== null && a.marks !== undefined ? ` · ${a.marks} ${t("marks", "अंक")}` : ""}
                  </p>
                  {a.feedback && (
                    <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs italic" style={{ background: "var(--w11-subtle, rgba(0,0,0,0.05))", color: "var(--w11-text-secondary)" }}>
                      “{a.feedback}”
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
