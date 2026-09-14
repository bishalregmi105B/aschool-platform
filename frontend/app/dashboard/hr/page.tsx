"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import {
  Users,
  DollarSign,
  Calendar,
  Star,
  ArrowRight,
  ClipboardList,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/empty-state";
import { SkeletonStat } from "@/components/ui/skeleton";
import { formatNepaliCurrency } from "@/lib/nepali-utils";

export default function HRPage() {
  return (
    <PluginGate slug="hr">
      <HRContent />
    </PluginGate>
  );
}

function HRContent() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["hr-stats"],
    queryFn: async () => {
      const r = await api.get("/hr/stats");
      return r.data?.data || {};
    },
    retry: 1,
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("HR & Payroll", "एचआर र पेरोल")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <ErrorState
              title={t("Failed to load HR dashboard.", "HR ड्यासबोर्ड लोड गर्न सकिएन।")}
              onRetry={() => refetch()}
            />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const s = data || {};

  // KPI values — straight from /hr/stats, never invented.
  const kpis = [
    {
      label: t("Total Staff", "कुल कर्मचारी"),
      value: s.total_staff ?? "—",
      icon: <Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />,
      color: "var(--w11-accent)",
    },
    {
      label: t("Monthly Payroll", "मासिक पेरोल"),
      value: s.monthly_payroll ? formatNepaliCurrency(s.monthly_payroll) : "—",
      icon: <DollarSign className="h-4 w-4" style={{ color: "#107c10" }} />,
      color: "#107c10",
    },
    {
      label: t("Pending Leaves", "बाँकी बिदा"),
      value: s.pending_leaves ?? "—",
      icon: (
        <Calendar
          className="h-4 w-4"
          style={{ color: (s.pending_leaves ?? 0) > 0 ? "#d83b01" : "var(--w11-text-tertiary)" }}
        />
      ),
      color: (s.pending_leaves ?? 0) > 0 ? "#d83b01" : "var(--w11-text-secondary)",
    },
    {
      label: t("Pending Payroll", "बाँकी पेरोल"),
      value: s.pending_payroll ?? "—",
      icon: (
        <ClipboardList
          className="h-4 w-4"
          style={{ color: (s.pending_payroll ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-tertiary)" }}
        />
      ),
      color: (s.pending_payroll ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-secondary)",
    },
  ];

  // Quick navigation links — displayed prominently
  const modules = [
    {
      title: t("Payroll", "पेरोल"),
      desc: t("Generate, approve and pay monthly salaries", "मासिक तलब बनाउने, स्वीकृत र भुक्तानी"),
      href: "/dashboard/hr/payroll",
      icon: DollarSign,
      badge:
        (s.pending_payroll ?? 0) > 0 ? `${s.pending_payroll} pending` : null,
      badgeTone: (s.pending_payroll ?? 0) > 0 ? "error" : "subtle",
      primary: true,
    },
    {
      title: t("Leave Management", "बिदा व्यवस्थापन"),
      desc: t("Review and approve staff leave requests", "कर्मचारी बिदा अनुरोध जाँच र स्वीकृति"),
      href: "/dashboard/hr/leaves",
      icon: Calendar,
      badge: (s.pending_leaves ?? 0) > 0 ? `${s.pending_leaves} ${t("pending", "बाँकी")}` : null,
      badgeTone: "warning",
      primary: false,
    },
    {
      title: t("Staff Attendance", "कर्मचारी हाजिर"),
      desc: t("Track daily staff presence and absences", "दैनिक उपस्थिति ट्र्याक"),
      href: "/dashboard/hr/staff-attendance",
      icon: ClipboardList,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: t("Expenses", "खर्चहरू"),
      desc: t("Manage school expense categories and records", "खर्च श्रेणी र रेकर्ड"),
      href: "/dashboard/hr/expenses",
      icon: DollarSign,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: t("Appraisal", "मूल्यांकन"),
      desc: t("Staff performance evaluation and feedback", "कार्यगुण मूल्यांकन र प्रतिक्रिया"),
      href: "/dashboard/hr/appraisal",
      icon: Star,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
    {
      title: t("Payroll Settings", "पेरोल सेटिङ"),
      desc: t("Configure allowances, deductions and tax rates", "भत्ता, कट्टा र कर दर"),
      href: "/dashboard/hr/payroll/settings",
      icon: Settings,
      badge: null,
      badgeTone: "subtle",
      primary: false,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("HR & Payroll", "एचआर र पेरोल")}
        subtitle={
          isLoading
            ? t("Manage staff salaries, leaves, attendance, and performance", "तलब, बिदा, हाजिर र मूल्यांकन")
            : `${s.total_staff ?? 0} ${t("staff", "कर्मचारी")} · ${s.pending_leaves ?? 0} ${t("pending leaves", "बाँकी बिदा")} · ${s.pending_payroll ?? 0} ${t("pending payroll", "बाँकी पेरोल")}`
        }
        actions={
          <Link href="/dashboard/hr/payroll">
            <Button>
              <DollarSign className="h-4 w-4 mr-2" /> {t("Open Payroll", "पेरोल खोल्नुहोस्")}
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        {/* KPI cards */}
        <StatGrid min={180}>
          {isLoading
            ? [1, 2, 3, 4].map((i) => <SkeletonStat key={i} />)
            : kpis.map((k) => (
                <KpiCard
                  key={k.label as string}
                  label={k.label}
                  value={k.value}
                  color={k.color}
                  icon={k.icon}
                />
              ))}
        </StatGrid>

        {/* Alerts for pending items */}
        {((s.pending_leaves ?? 0) > 0 || (s.pending_payroll ?? 0) > 0) && (
          <div className="space-y-2 mb-4">
            {(s.pending_leaves ?? 0) > 0 && (
              <div
                className="win11-infobar warning flex items-center justify-between gap-3"
                role="status"
              >
                <p className="text-sm font-medium">
                  {s.pending_leaves} {t("leave request(s) waiting for approval", "बिदा अनुरोध स्वीकृतिको पर्खाइमा")}
                </p>
                <Link href="/dashboard/hr/leaves">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                    {t("Review", "हेर्नु")} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
            {(s.pending_payroll ?? 0) > 0 && (
              <div
                className="win11-infobar error flex items-center justify-between gap-3"
                role="status"
              >
                <p className="text-sm font-medium">
                  {s.pending_payroll} {t("payroll records need attention", "पेरोल रेकर्ड जाँच पर्ख")}
                </p>
                <Link href="/dashboard/hr/payroll">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                    {t("Process", "प्रशोधन")} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Module navigation grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="block h-full">
              <div
                className={`win11-card h-full transition-all hover:-translate-y-0.5 ${m.primary ? "border-[var(--w11-accent)]" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: m.primary
                        ? "var(--w11-accent-light)"
                        : "var(--w11-control-hover)",
                    }}
                  >
                    <m.icon
                      className="h-5 w-5"
                      style={{
                        color: m.primary
                          ? "var(--w11-accent)"
                          : "var(--w11-text-secondary)",
                      }}
                    />
                  </div>
                  {m.badge && (
                    <span className={`win11-chip ${m.badgeTone} text-xs`}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "var(--w11-text-primary)" }}
                >
                  {m.title}
                </h3>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  {m.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
