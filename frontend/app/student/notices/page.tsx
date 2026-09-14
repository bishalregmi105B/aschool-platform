"use client";

/**
 * Student → Notices (NEW, R4b).
 *
 * Full notice feed for students (the dashboard payload only carries 10).
 * GET /notices is installed-app data; this page filters client-side to
 * student-relevant audience while the backend targeting matures
 * (target_class_ids persistence is a flagged backend task).
 */

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import { Bell, Pin } from "lucide-react";

type Notice = {
  id: string;
  title: string;
  title_nepali?: string | null;
  content?: string | null;
  content_nepali?: string | null;
  notice_type?: string | null;
  is_pinned?: boolean;
  published_at?: string | null;
  target_audience?: string[] | null;
};

export default function StudentNoticesPage() {
  const { t, lang } = useI18n();
  const notices = useQuery({
    queryKey: ["student-notices"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notice[] | { items?: Notice[] }>>("/notices", {
        params: { per_page: 50 },
      });
      const data = res.data.data;
      return Array.isArray(data) ? data : data?.items ?? [];
    },
    retry: 1,
  });

  if (notices.isLoading) return <PageLoader />;
  if (notices.isError)
    return (
      <ErrorState
        title={t("Couldn't load notices", "सूचना लोड गर्न सकिएन")}
        onRetry={() => notices.refetch()}
      />
    );

  // Student-relevant: audience includes student (or is open/all).
  const mine = (notices.data || []).filter(
    (n) =>
      !n.target_audience ||
      n.target_audience.length === 0 ||
      n.target_audience.includes("student") ||
      n.target_audience.includes("all"),
  );
  const pinned = mine.filter((n) => n.is_pinned);
  const rest = mine.filter((n) => !n.is_pinned);

  if (mine.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={t("No notices yet", "अझै सूचना छैन")}
        body={t(
          "School announcements for you will appear here.",
          "तपाईंका लागि विद्यालयका सूचनाहरू यहाँ देखिनेछन्।",
        )}
      />
    );
  }

  const NoticeCard = ({ n }: { n: Notice }) => (
    <article
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--w11-border-default)" }}
    >
      <div className="flex items-start gap-2">
        {n.is_pinned && (
          <Pin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w11-accent)]" aria-label={t("Pinned", "पिन गरिएको")} />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold" style={{ color: "var(--w11-text-primary)" }}>
            {(lang === "ne" && n.title_nepali) || n.title}
          </h3>
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {n.published_at ? displayBS(n.published_at.slice(0, 10)) : "—"}
            {n.notice_type ? ` · ${n.notice_type}` : ""}
          </p>
          {(n.content || n.content_nepali) && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--w11-text-secondary)" }}>
              {(lang === "ne" && n.content_nepali) || n.content}
            </p>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("Notices", "सूचनाहरू")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("School announcements for you.", "तपाईंका लागि विद्यालयका सूचनाहरू।")}
        </p>
      </div>

      {pinned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Pinned", "पिन गरिएका")}
          </h2>
          {pinned.map((n) => <NoticeCard key={n.id} n={n} />)}
        </section>
      )}

      <section className="space-y-2">
        {pinned.length > 0 && (
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
            {t("All notices", "सबै सूचना")}
          </h2>
        )}
        {rest.map((n) => <NoticeCard key={n.id} n={n} />)}
      </section>
    </div>
  );
}
