"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid, DataPanel,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { ErrorState } from "@/components/ui/empty-state";
import { SkeletonStat, SkeletonList } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface FeesSummary {
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  total_overdue: number;
  collection_rate: number;
  student_count: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  this_month_collected: number;
  recent_payments: Array<{
    id: string;
    student_name: string;
    fee_type: string;
    amount: number;
    paid_at: string;
    receipt_number: string;
  }>;
  by_class: Array<{
    class_name: string;
    collected: number;
    expected: number;
    rate: number;
  }>;
}

/**
 * Fees hub — archetype A5 (plan 32): header → KPI band → QuickLinks launcher
 * → ONE most-used DataPanel (recent payments). The full per-class collection
 * table lives on the reports page; the hub only launches tasks (34-8).
 */
export default function FeesPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fees-overview"],
    queryFn: async () => {
      const res = await api.get("/fees/summary");
      return res.data?.data as FeesSummary | null;
    },
    retry: 1,
  });

  const s = data;
  const collectionRate = s?.collection_rate ?? 0;

  const quickLinks = [
    { label: t("Collect Fee", "शुल्क उठाउनुहोस्"), href: "/dashboard/fees/collect", icon: "DollarSign" },
    { label: t("Invoices", "बीजक"), href: "/dashboard/fees/invoices", icon: "Receipt" },
    { label: t("Slip Approvals", "स्लिप स्वीकृति"), href: "/dashboard/fees/approvals", icon: "ClipboardCheck" },
    { label: t("Defaulters", "रकम बाँकी विद्यार्थी"), href: "/dashboard/fees/defaulters", icon: "AlertTriangle" },
    { label: t("AR Aging", "उधार उमेर"), href: "/dashboard/fees/aging", icon: "TrendingUp" },
    { label: t("Fee Structure", "शुल्क संरचना"), href: "/dashboard/fees/structure", icon: "CreditCard" },
    { label: t("Fee Types", "शुल्क प्रकार"), href: "/dashboard/fees/types", icon: "FileText" },
    { label: t("Scholarships", "छात्रवृत्ति"), href: "/dashboard/fees/scholarships", icon: "Banknote" },
    { label: t("Carry Forward", "रकम सार्ने"), href: "/dashboard/fees/carry-forward", icon: "ArrowRight" },
    { label: t("Day Closure", "दन्य बन्द"), href: "/dashboard/fees/day-closure", icon: "Calendar" },
    { label: t("Fee Reports", "शुल्क प्रतिवेदन"), href: "/dashboard/fees/reports", icon: "TrendingUp" },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        title={t("Fee Management", "शुल्क व्यवस्थापन")}
        subtitle={t(
          `${s?.student_count ?? 0} students · collection status for this session`,
          `${s?.student_count ?? 0} विद्यार्थी · यस सत्रको संकलन अवस्था`
        )}
        actions={
          <Button asChild>
            <Link href="/dashboard/fees/collect">
              <DollarSign className="h-4 w-4 mr-2" />
              {t("Collect Fee", "शुल्क उठाउनुहोस्")}
            </Link>
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        {isError ? (
          <div className="win11-card">
            <ErrorState
              title={t("Could not load the fee summary", "शुल्क सारांश लोड गर्न सकिएन")}
              onRetry={() => refetch()}
            />
          </div>
        ) : (
          <>
            {/* KPI band — money states first, real values only (no invented trends). */}
            <StatGrid className="mb-0" min={200}>
              {isLoading ? (
                <>
                  <SkeletonStat />
                  <SkeletonStat />
                  <SkeletonStat />
                  <SkeletonStat />
                </>
              ) : (
                <>
                  <KpiCard
                    label={t("Total Collected", "कुल संकलन")}
                    value={formatNepaliCurrency(s?.total_collected ?? 0)}
                    color="#107c10"
                    icon={<CheckCircle2 className="h-5 w-5" style={{ color: "#107c10" }} />}
                    footnote={t(
                      `${collectionRate.toFixed(0)}% of ${formatNepaliCurrency(s?.total_expected ?? 0)} expected`,
                      `अपेक्षित ${formatNepaliCurrency(s?.total_expected ?? 0)} मध्ये ${collectionRate.toFixed(0)}%`
                    )}
                  />
                  <KpiCard
                    label={t("Outstanding", "बाँकी रकम")}
                    value={formatNepaliCurrency(s?.total_outstanding ?? 0)}
                    color="#d83b01"
                    icon={<Users className="h-5 w-5" style={{ color: "#d83b01" }} />}
                    footnote={t(
                      `${s?.pending_count ?? 0} students pending`,
                      `${s?.pending_count ?? 0} विद्यार्थी बाँकी`
                    )}
                  />
                  <KpiCard
                    label={t("Overdue", "अर्ली/ढिला")}
                    value={formatNepaliCurrency(s?.total_overdue ?? 0)}
                    color="#c42b1c"
                    icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
                    footnote={t(
                      `${s?.overdue_count ?? 0} students overdue`,
                      `${s?.overdue_count ?? 0} विद्यार्थी ढिला`
                    )}
                  />
                  <KpiCard
                    label={t("This Month", "यो महिना")}
                    value={formatNepaliCurrency(s?.this_month_collected ?? 0)}
                    icon={<Receipt className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                    footnote={t(
                      `${s?.paid_count ?? 0} payments received`,
                      `${s?.paid_count ?? 0} भुक्तानी प्राप्त`
                    )}
                  />
                </>
              )}
            </StatGrid>

            {/* Overdue callout as a Fluent infobar with the single next action. */}
            {!isLoading && (s?.overdue_count ?? 0) > 0 && (
              <div className="win11-infobar error rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-[13px]">
                      {t(
                        `${s!.overdue_count} students owe ${formatNepaliCurrency(s!.total_overdue)} past their due date.`,
                        `${s!.overdue_count} विद्यार्थीको समय नाघेको ${formatNepaliCurrency(s!.total_overdue)} बाँकी छ।`
                      )}
                    </p>
                  </div>
                  <Link href="/dashboard/fees/defaulters">
                    <Button size="sm" variant="outline" className="gap-1">
                      {t("Follow up", "अनुगमन गर्नुहोस्")} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Launcher — one card per subpage (QuickLinks kit). */}
            <QuickLinks section="Money" links={quickLinks} />

            {/* ONE embeddable most-used panel: the cash desk's latest activity. */}
            <DataPanel
              title={t("Recent Payments", "भर्खरका भुक्तानी")}
              actions={
                <Link href="/dashboard/fees/invoices">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    {t("All invoices", "सबै बीजक")} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              }
              bodyClassName="p-0"
            >
              {isLoading ? (
                <div className="p-4">
                  <SkeletonList rows={4} />
                </div>
              ) : !s?.recent_payments?.length ? (
                <div className="py-8 text-center text-sm text-[color:var(--w11-text-secondary)]">
                  <Receipt className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--w11-text-tertiary)" }} />
                  <p>{t("No payments recorded yet", "अहिलेसम्म कुनै भुक्तानी छैन")}</p>
                  <p className="text-xs mt-1">
                    {t(
                      "Collect the first payment from the POS — शुल्क उठाउनुहोस्",
                      "POS बाट पहिलो भुक्तानी उठाउनुहोस्"
                    )}
                  </p>
                  <Link href="/dashboard/fees/collect" className="inline-block mt-3">
                    <Button size="sm" variant="outline">
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                      {t("Open Collect Fees", "शुल्क संकलन खोल्नुहोस्")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--w11-border-subtle)]">
                  {s.recent_payments.slice(0, 8).map((p) => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.student_name}</p>
                        <p className="text-xs text-[color:var(--w11-text-secondary)]">
                          {p.fee_type} • {displayBS(p.paid_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: "#107c10" }}
                        >
                          {formatNepaliCurrency(p.amount || 0)}
                        </p>
                        {p.receipt_number && (
                          <p className="text-[10px] text-[color:var(--w11-text-secondary)]">
                            #{p.receipt_number}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DataPanel>

            {/* Collection rate — one honest progress line, not a second table. */}
            {!isLoading && (s?.total_expected ?? 0) > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "var(--w11-text-secondary)" }}>
                    {t("Session collection rate", "सत्र संकलन दर")}
                  </span>
                  <span className="font-semibold tabular-nums">{collectionRate.toFixed(1)}%</span>
                </div>
                <div
                  className="w-full rounded-full h-2"
                  style={{ background: "var(--w11-control-hover)" }}
                  role="progressbar"
                  aria-valuenow={Math.round(collectionRate)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, collectionRate)}%`,
                      background:
                        collectionRate >= 80 ? "#107c10" : collectionRate >= 50 ? "#d83b01" : "#c42b1c",
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
