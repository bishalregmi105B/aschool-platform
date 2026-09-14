"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel, StatusChip,
} from "@/components/aos/kit/page-kit";
import { ErrorState } from "@/components/ui/empty-state";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { useI18n } from "@/lib/i18n";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Clock, Hourglass, Timer } from "lucide-react";
import { todayBS } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";

interface AgingClassRow {
  class_name: string;
  unscheduled: number;
  current_or_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
}

interface AgingStudentRow {
  student_id: string;
  student_name: string;
  class_name: string | null;
  total: number;
  oldest_overdue_days: number | null;
}

interface AgingPayload {
  as_of_bs: string;
  by_class: AgingClassRow[];
  by_student: AgingStudentRow[];
  grand_total: number;
}

const money = (n: number | null | undefined) =>
  n ? formatNepaliCurrency(n) : <span className="text-[color:var(--w11-text-secondary)]">—</span>;

export default function FeeAgingPage() {
  return (
    <AppGate slug="fees">
      <AgingContent />
    </AppGate>
  );
}

function AgingContent() {
  const { t } = useI18n();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["as_of", "class"]);
  const asOfBS = urlFilters.as_of || todayBS();
  const classId = urlFilters.class || "";

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const r = await api.get("/academics/classes");
      return r.data?.data || [];
    },
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["fee-aging", asOfBS, classId],
    retry: 1,
    queryFn: async () => {
      const params = new URLSearchParams({ as_of_bs: asOfBS });
      if (classId) params.set("class_id", classId);
      const r = await api.get(`/fees/receivables/aging?${params.toString()}`);
      return r.data?.data as AgingPayload | null;
    },
  });

  const byClass = data?.by_class ?? [];
  const byStudent = (data?.by_student ?? []).slice(0, 25);
  const grandTotal = data?.grand_total ?? 0;

  const oldest30 = byStudent.filter((s) => (s.oldest_overdue_days ?? 0) > 30).length;

  const CLASS_COLUMNS: Column<AgingClassRow>[] = [
    {
      key: "class_name",
      label: t("Class", "कक्षा"),
      sortable: true,
      value: (r) => r.class_name,
      render: (r) => <span className="font-medium">{r.class_name}</span>,
    },
    {
      key: "unscheduled",
      label: t("Unscheduled", "तारिखविहिन"),
      align: "right",
      sortable: true,
      value: (r) => r.unscheduled,
      render: (r) => money(r.unscheduled),
    },
    {
      key: "current_or_30",
      label: "0–30 d",
      align: "right",
      sortable: true,
      value: (r) => r.current_or_30,
      render: (r) => money(r.current_or_30),
    },
    {
      key: "b31_60",
      label: "31–60 d",
      align: "right",
      sortable: true,
      value: (r) => r.b31_60,
      render: (r) => money(r.b31_60),
    },
    {
      key: "b61_90",
      label: "61–90 d",
      align: "right",
      sortable: true,
      value: (r) => r.b61_90,
      render: (r) => money(r.b61_90),
    },
    {
      key: "b90_plus",
      label: "90+ d",
      align: "right",
      sortable: true,
      value: (r) => r.b90_plus,
      render: (r) => (
        <span className={r.b90_plus > 0 ? "font-semibold" : ""} style={r.b90_plus > 0 ? { color: "#c42b1c" } : undefined}>
          {money(r.b90_plus)}
        </span>
      ),
    },
    {
      key: "total",
      label: t("Total", "कुल"),
      align: "right",
      sortable: true,
      value: (r) => r.total,
      render: (r) => <span className="font-bold">{formatNepaliCurrency(r.total || 0)}</span>,
    },
  ];

  const STUDENT_COLUMNS: Column<AgingStudentRow>[] = [
    {
      key: "student_name",
      label: "Student",
      sortable: true,
      value: (s) => s.student_name || "",
      render: (s) => <span className="font-medium">{s.student_name}</span>,
    },
    {
      key: "class_name",
      label: "Class",
      sortable: true,
      value: (s) => s.class_name ?? "",
      render: (s) => s.class_name || "—",
    },
    {
      key: "oldest_overdue_days",
      label: t("Oldest Overdue", "धेरो बाकि"),
      align: "center",
      sortable: true,
      value: (s) => s.oldest_overdue_days ?? -1,
      render: (s) =>
        s.oldest_overdue_days == null ? (
          <StatusChip status="pending" label={t("Unscheduled", "तारिख विहिन")} />
        ) : (
          <StatusChip
            status={s.oldest_overdue_days > 90 ? "overdue" : s.oldest_overdue_days > 60 ? "late" : s.oldest_overdue_days > 30 ? "due" : "pending"}
            label={`${s.oldest_overdue_days} ${t("d", "दिन")}`}
          />
        ),
    },
    {
      key: "total",
      label: t("Outstanding", "बाँकी"),
      align: "right",
      sortable: true,
      value: (s) => s.total,
      render: (s) => <span className="font-bold" style={{ color: "#c42b1c" }}>{formatNepaliCurrency(s.total || 0)}</span>,
    },
  ];

  if (isLoading)
    return (
      <AOSPage>
        <AOSPageHeader title={t("Accounts Receivable Aging", "बुक्की उम्र")} />
        <AOSPageBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="win11-card h-24 animate-pulse" style={{ margin: 0 }} />
              ))}
            </div>
            <div className="win11-card h-64 animate-pulse" style={{ margin: 0 }} />
          </div>
        </AOSPageBody>
      </AOSPage>
    );

  return (
    <AOSPage>
      <AOSPageHeader
        title={t("Accounts Receivable Aging", "बुक्की उम्र (AR Aging)")}
        subtitle={t("Outstanding balances bucketed by days past the BS due date", "मिति गुडरि दिन अनुसर बाँकी रकम")}
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? t("Refreshing…", "ताजा हुँदा…") : t("Refresh", "ताजा")}
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="space-y-1">
            <Label className="text-xs">{t("As of (BS)", "मिति (BS)")}</Label>
            <BSDateInput
              value={asOfBS}
              onChange={(v) => setUrlFilters({ as_of: v })}
              emit="bs"
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("Class", "कक्षा")}</Label>
            <AdvancedSelect
              value={classId}
              onChange={(v) => setUrlFilters({ class: v })}
              clearable
              placeholder={t("All Classes", "सबै कक्षा")}
              className="w-44"
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </FilterCommandBar>

        {isError ? (
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <ErrorState
            title={t("Failed to load the aging report.", "अर्लिँग रिपोर्ट लोड सकिएन।")}
            onRetry={() => refetch()}
          />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <StatGrid className="mb-0" min={200}>
              <KpiCard
                label={t("Total Receivable", "कुल बुक्की")}
                value={formatNepaliCurrency(grandTotal)}
                color="#c42b1c"
                icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
                footnote={`as of ${data?.as_of_bs || asOfBS} BS`}
              />
              <KpiCard
                label={t("Current / ≤30 days", "हाली / ≤30 दिन")}
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.current_or_30 || 0), 0))}
                color="#107c10"
                icon={<Timer className="h-5 w-5" style={{ color: "#107c10" }} />}
              />
              <KpiCard
                label={t("31–90 days", "31–90 दिन")}
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.b31_60 || 0) + (r.b61_90 || 0), 0))}
                color="#d83b01"
                icon={<Clock className="h-5 w-5" style={{ color: "#d83b01" }} />}
              />
              <KpiCard
                label={t("90+ days", "90+ दिन")}
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.b90_plus || 0), 0))}
                color="#c42b1c"
                icon={<Hourglass className="h-5 w-5" style={{ color: "#c42b1c" }} />}
              />
            </StatGrid>

            {/* By class */}
            <DataPanel title={t("Aging by Class", "कक्षा अनुसर उम्र")}>
              <DataTable<AgingClassRow>
                columns={CLASS_COLUMNS}
                rows={byClass}
                rowKey={(r) => r.class_name}
                loading={isFetching}
                exportFileName="fee-aging-by-class"
                dense
                empty={{
                  icon: AlertTriangle,
                  title: t("No outstanding balances", "बाँकी रकम छेन"),
                  body: t("Every pending bill falls inside the selected window, or there is nothing due.", "यहाँ बाँकी कुनै रकम छन।"),
                }}
              />
            </DataPanel>

            {/* By student (top list) */}
            <DataPanel
              title={
                <span className="flex items-center">
                  {t("Top Outstanding Students", "वशिष्ठ बाँकी विद्यार्थी")}
                  {oldest30 > 0 && (
                    <Badge variant="warning" className="ml-2">
                      {oldest30} {t("past 30 days", "30 दिन बिगरे")}
                    </Badge>
                  )}
                </span>
              }
            >
              <DataTable<AgingStudentRow>
                columns={STUDENT_COLUMNS}
                rows={byStudent}
                rowKey={(s) => s.student_id}
                loading={isFetching}
                searchable
                searchPlaceholder={t("Search students…", "खोज्नुहोस…")}
                exportFileName="fee-aging-by-student"
                dense
                empty={{
                  icon: AlertTriangle,
                  title: t("No student balances", "विद्यार्थी बाँकी छेन"),
                  body: t("Nothing is outstanding for the selected date and class.", "छानियेको मिति/कक्षामा बाँकी छन।"),
                }}
              />
              {(data?.by_student?.length ?? 0) > 25 && (
                <p className="mt-2 text-xs text-[color:var(--w11-text-secondary)]">
                  {t("Showing the 25 most overdue of", "धेरो 25 देखाएन — कुल")} {data!.by_student.length} {t("students with balances.", "विद्यार्थी।")}
                </p>
              )}
            </DataPanel>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
