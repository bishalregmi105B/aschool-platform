"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid, DataPanel,
} from "@/components/aos/kit/page-kit";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
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

export default function FeesPage() {
  return <FeeOverviewContent />;
}

function FeeOverviewContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fees-overview"],
    queryFn: async () => {
      const res = await api.get("/fees/summary");
      return res.data?.data as FeesSummary | null;
    },
    retry: 1,
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          title="Fee Management"
          subtitle="Overview of fee collection status for your school"
        />
        <AOSPageBody>
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">
              Failed to load the fee summary. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const s = data;
  const collectionRate = s?.collection_rate ?? 0;

  // Quick actions for the most common tasks. The first is the primary verb
  // (accent-filled Fluent card); the rest are plain win11-cards, with the
  // defaulters shortcut tinted with the error palette.
  const quickActions: Array<{
    label: string;
    desc: string;
    href: string;
    icon: typeof DollarSign;
    primary?: boolean;
    danger?: boolean;
  }> = [
    {
      label: "Collect Fee",
      desc: "Record student payment",
      href: "/dashboard/fees/collect",
      icon: DollarSign,
      primary: true,
    },
    {
      label: "Invoices",
      desc: "Per-student bill documents",
      href: "/dashboard/fees/invoices",
      icon: Receipt,
    },
    {
      label: "Slip Approvals",
      desc: "Offline bank/cheque review",
      href: "/dashboard/fees/approvals",
      icon: CheckCircle2,
    },
    {
      label: "View Defaulters",
      desc: "Students with overdue fees",
      href: "/dashboard/fees/defaulters",
      icon: AlertTriangle,
      danger: true,
    },
    {
      label: "Fee Structure",
      desc: "Manage fee types & amounts",
      href: "/dashboard/fees/structure",
      icon: CreditCard,
    },
    {
      label: "AR Aging",
      desc: "Receivables by age bucket",
      href: "/dashboard/fees/aging",
      icon: TrendingUp,
    },
    {
      label: "Carry Forward",
      desc: "Roll year-end balances",
      href: "/dashboard/fees/carry-forward",
      icon: ArrowRight,
    },
    {
      label: "Day Closure",
      desc: "Day book & till lock",
      href: "/dashboard/fees/day-closure",
      icon: Calendar,
    },
    {
      label: "Fee Reports",
      desc: "Collection analytics",
      href: "/dashboard/fees/reports",
      icon: TrendingUp,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        title="Fee Management"
        subtitle={`Overview of fee collection status for your school · ${s?.student_count ?? 0} students`}
        actions={
          <Button asChild>
            <Link href="/dashboard/fees/collect">
              <DollarSign className="h-4 w-4 mr-2" /> Collect Fee
            </Link>
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        {/* Quick Actions — most important at top for easy access */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link key={a.label} href={a.href}>
              <button
                className="w-full h-full text-left rounded-xl p-4 flex items-start gap-3 transition-shadow hover:shadow-md win11-card"
                style={
                  a.primary
                    ? { background: "var(--w11-accent)", borderColor: "var(--w11-accent)", color: "var(--w11-accent-text)" }
                    : a.danger
                      ? { background: "rgba(196,43,28,.08)", borderColor: "rgba(196,43,28,.3)" }
                      : undefined
                }
              >
                <a.icon
                  className="h-5 w-5 shrink-0 mt-0.5"
                  style={a.primary ? undefined : { color: a.danger ? "#c42b1c" : "var(--w11-accent)" }}
                />
                <div>
                  <p className="font-semibold text-sm leading-tight">{a.label}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: a.primary ? "var(--w11-accent-text)" : "var(--w11-text-secondary)" }}
                  >
                    {a.desc}
                  </p>
                </div>
              </button>
            </Link>
          ))}
        </div>

        {/* KPI Cards */}
        <StatGrid className="mb-0" min={200}>
          <KpiCard
            label="Total Collected"
            // E205: exact NPR with Nepali 2-2-3 digit grouping — no "12K" abbr.
            value={isLoading ? "—" : formatNepaliCurrency(s?.total_collected ?? 0)}
            color="#107c10"
            icon={<CheckCircle2 className="h-5 w-5" style={{ color: "#107c10" }} />}
            footnote={`${collectionRate.toFixed(0)}% collection rate`}
            className={isLoading ? "animate-pulse" : ""}
          />
          <KpiCard
            label="Outstanding"
            value={isLoading ? "—" : formatNepaliCurrency(s?.total_outstanding ?? 0)}
            color="#d83b01"
            icon={<AlertTriangle className="h-5 w-5" style={{ color: "#d83b01" }} />}
            footnote={`${s?.pending_count ?? 0} students pending`}
            className={isLoading ? "animate-pulse" : ""}
          />
          <KpiCard
            label="Overdue"
            value={isLoading ? "—" : formatNepaliCurrency(s?.total_overdue ?? 0)}
            color="#c42b1c"
            icon={<Calendar className="h-5 w-5" style={{ color: "#c42b1c" }} />}
            footnote={`${s?.overdue_count ?? 0} students overdue`}
            className={isLoading ? "animate-pulse" : ""}
          />
          <KpiCard
            label="This Month"
            value={isLoading ? "—" : formatNepaliCurrency(s?.this_month_collected ?? 0)}
            icon={<Receipt className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
            footnote={`${s?.paid_count ?? 0} payments received`}
            className={isLoading ? "animate-pulse" : ""}
          />
        </StatGrid>

        {/* Collection Progress Bar */}
        {!isLoading && (
          <DataPanel title="Overall Collection Progress">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Collected vs expected</span>
              <span className="text-sm font-bold text-[color:var(--w11-accent)]">
                {collectionRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full rounded-full h-3" style={{ background: "var(--w11-control-hover)" }}>
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, collectionRate)}%`, background: "var(--w11-accent)" }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-[color:var(--w11-text-secondary)]">
              <span>Collected: {formatNepaliCurrency(s?.total_collected ?? 0)}</span>
              <span>Expected: {formatNepaliCurrency(s?.total_expected ?? 0)}</span>
            </div>
          </DataPanel>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Payments */}
          <DataPanel
            title="Recent Payments"
            actions={
              <Link href="/dashboard/fees/collect">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
            bodyClassName="p-0"
          >
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg animate-pulse"
                    style={{ background: "var(--w11-control-hover)" }}
                  />
                ))}
              </div>
            ) : !s?.recent_payments?.length ? (
              <div className="py-8 text-center text-[color:var(--w11-text-secondary)] text-sm">
                <Receipt className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--w11-text-tertiary)" }} />
                No payments recorded yet
              </div>
            ) : (
              <div className="divide-y divide-[var(--w11-border-subtle)]">
                {s.recent_payments.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.student_name}</p>
                      <p className="text-xs text-[color:var(--w11-text-secondary)]">
                        {p.fee_type} •{" "}
                        {displayBS(p.paid_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "#107c10" }}>
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

          {/* Collection by Class */}
          <DataPanel title="Collection by Class">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 rounded animate-pulse" style={{ background: "var(--w11-control-hover)" }} />
                ))}
              </div>
            ) : !s?.by_class?.length ? (
              <p className="text-center text-[color:var(--w11-text-secondary)] text-sm py-4">
                No class data available
              </p>
            ) : (
              s.by_class.slice(0, 8).map((c) => {
                const rate =
                  c.rate ?? Math.round((c.collected / (c.expected || 1)) * 100);
                return (
                  <div key={c.class_name} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{c.class_name}</span>
                      <span className="text-[color:var(--w11-text-secondary)]">
                        {formatNepaliCurrency(c.collected)} /{" "}
                        {formatNepaliCurrency(c.expected)}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--w11-control-hover)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, rate)}%`,
                          background: rate >= 80 ? "#107c10" : rate >= 50 ? "#d83b01" : "#c42b1c",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </DataPanel>
        </div>

        {/* Alert for overdue */}
        {!isLoading && (s?.overdue_count ?? 0) > 0 && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(196,43,28,.08)", border: "1px solid rgba(196,43,28,.3)" }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#c42b1c" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#c42b1c" }}>
                  {s!.overdue_count} students have overdue fees
                </p>
                <p className="text-xs" style={{ color: "#c42b1c" }}>
                  Total overdue: {formatNepaliCurrency(s!.total_overdue)}
                </p>
              </div>
            </div>
            <Link href="/dashboard/fees/defaulters">
              <Button size="sm" variant="destructive" className="gap-1">
                View <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
