"use client";

/**
 * Student → My Fees (NEW, R4b).
 *
 * GET /student/fees → {overview: {total_fees, paid, due}, invoices:
 * [{id, title, fee_type, month, amount, status}]}. Read-only for students
 * (payment is the parent's flow) — clear dues + receipt history.
 */

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { KpiCard, StatGrid } from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Receipt } from "lucide-react";
import { StatusChip } from "@/components/aos/kit/page-kit";

type FeesPayload = {
  overview?: { total_fees?: number; paid?: number; due?: number };
  invoices?: {
    id: string;
    title: string;
    fee_type?: string | null;
    month?: string | null;
    amount: number;
    status: string;
  }[];
};

const npr = (n?: number) =>
  n === undefined || n === null ? "—" : `Rs. ${Number(n).toLocaleString("en-IN")}`;

export default function StudentFeesPage() {
  const { t } = useI18n();
  const fees = useQuery({
    queryKey: ["student-fees"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FeesPayload>>("/student/fees");
      return res.data.data;
    },
    retry: 1,
  });

  if (fees.isLoading) return <PageLoader />;
  if (fees.isError)
    return (
      <ErrorState
        title={t("Couldn't load your fees", "तपाईंको शुल्क लोड गर्न सकिएन")}
        onRetry={() => fees.refetch()}
      />
    );

  const overview = fees.data?.overview || {};
  const invoices = fees.data?.invoices || [];

  if (!invoices.length && !overview.total_fees) {
    return (
      <EmptyState
        icon={Wallet}
        title={t("No fees assigned yet", "अझै शुल्क तोकिएको छैन")}
        body={t(
          "When your school publishes fee structures, your invoices appear here.",
          "विद्यालयले शुल्क संरचना प्रकाशित गरेपछि यहाँ देखिन्छ।",
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("My Fees", "मेरो शुल्क")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("What's due and what's been paid.", "कति बाँकी छ, कति तिरियो।")}
        </p>
      </div>

      <StatGrid min={150}>
        <KpiCard label={t("Total", "कुल")} value={npr(overview.total_fees)} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label={t("Paid", "तिरिएको")} value={npr(overview.paid)} />
        <KpiCard
          label={t("Due", "बाँकी")}
          value={npr(overview.due)}
          color={(overview.due ?? 0) > 0 ? "#d83b01" : undefined}
        />
      </StatGrid>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--w11-text-secondary)" }}>
          {t("Invoices", "बिलहरू")}
        </h2>
        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {t("No invoices yet.", "अझै बिल छैन।")}
          </p>
        ) : (
          invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex items-center gap-3 pt-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: "var(--w11-subtle, rgba(0,0,0,0.05))", color: "var(--w11-text-secondary)" }}
                >
                  <Receipt className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                    {inv.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {[inv.fee_type, inv.month].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: "var(--w11-text-primary)" }}>
                  {npr(inv.amount)}
                </span>
                <StatusChip
                  status={
                    inv.status === "paid" ? "present" : inv.status === "partial" ? "late" : "absent"
                  }
                  label={inv.status}
                />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {(overview.due ?? 0) > 0 && (
        <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
          {t(
            "Payments are made by your parent/guardian from their portal.",
            "भुक्तानी तपाईंको अभिभावकले आफ्नो पोर्टलबाट गर्नुहुन्छ।",
          )}
        </p>
      )}
    </div>
  );
}
