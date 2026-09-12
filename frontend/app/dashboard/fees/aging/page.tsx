"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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
    <PluginGate slug="fees">
      <AgingContent />
    </PluginGate>
  );
}

function AgingContent() {
  const [asOfBS, setAsOfBS] = useState<string>(todayBS());
  const [classId, setClassId] = useState("");

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
      label: "Class",
      sortable: true,
      value: (r) => r.class_name,
      render: (r) => <span className="font-medium">{r.class_name}</span>,
    },
    {
      key: "unscheduled",
      label: "Unscheduled",
      align: "right",
      sortable: true,
      value: (r) => r.unscheduled,
      render: (r) => money(r.unscheduled),
    },
    {
      key: "current_or_30",
      label: "0–30 days",
      align: "right",
      sortable: true,
      value: (r) => r.current_or_30,
      render: (r) => money(r.current_or_30),
    },
    {
      key: "b31_60",
      label: "31–60 days",
      align: "right",
      sortable: true,
      value: (r) => r.b31_60,
      render: (r) => money(r.b31_60),
    },
    {
      key: "b61_90",
      label: "61–90 days",
      align: "right",
      sortable: true,
      value: (r) => r.b61_90,
      render: (r) => money(r.b61_90),
    },
    {
      key: "b90_plus",
      label: "90+ days",
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
      label: "Total",
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
      label: "Oldest Overdue",
      align: "center",
      sortable: true,
      value: (s) => s.oldest_overdue_days ?? -1,
      render: (s) =>
        s.oldest_overdue_days == null ? (
          <Badge variant="secondary">Unscheduled</Badge>
        ) : (
          <Badge variant={s.oldest_overdue_days > 90 ? "destructive" : s.oldest_overdue_days > 30 ? "warning" : "outline"}>
            {s.oldest_overdue_days} days
          </Badge>
        ),
    },
    {
      key: "total",
      label: "Outstanding",
      align: "right",
      sortable: true,
      value: (s) => s.total,
      render: (s) => <span className="font-bold" style={{ color: "#c42b1c" }}>{formatNepaliCurrency(s.total || 0)}</span>,
    },
  ];

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading aging report…" /></AOSPage>;

  return (
    <AOSPage>
      <AOSPageHeader
        title="Accounts Receivable Aging"
        subtitle="Outstanding balances bucketed by days past the BS due date"
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="space-y-1">
            <Label className="text-xs">As of (BS)</Label>
            <BSDateInput
              value={asOfBS}
              onChange={(v) => setAsOfBS(v)}
              emit="bs"
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Class</Label>
            <AdvancedSelect
              value={classId}
              onChange={(v) => setClassId(v)}
              clearable
              placeholder="All Classes"
              className="w-44"
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </FilterCommandBar>

        {isError ? (
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">Failed to load the aging report. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <StatGrid className="mb-0" min={200}>
              <KpiCard
                label="Total Receivable"
                value={formatNepaliCurrency(grandTotal)}
                color="#c42b1c"
                icon={<AlertTriangle className="h-5 w-5" style={{ color: "#c42b1c" }} />}
                footnote={`as of ${data?.as_of_bs || asOfBS} BS`}
              />
              <KpiCard
                label="Current / ≤30 days"
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.current_or_30 || 0), 0))}
                color="#107c10"
                icon={<Timer className="h-5 w-5" style={{ color: "#107c10" }} />}
              />
              <KpiCard
                label="31–90 days"
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.b31_60 || 0) + (r.b61_90 || 0), 0))}
                color="#d83b01"
                icon={<Clock className="h-5 w-5" style={{ color: "#d83b01" }} />}
              />
              <KpiCard
                label="90+ days"
                value={formatNepaliCurrency(byClass.reduce((s, r) => s + (r.b90_plus || 0), 0))}
                color="#c42b1c"
                icon={<Hourglass className="h-5 w-5" style={{ color: "#c42b1c" }} />}
              />
            </StatGrid>

            {/* By class */}
            <DataPanel title="Aging by Class">
              <DataTable<AgingClassRow>
                columns={CLASS_COLUMNS}
                rows={byClass}
                rowKey={(r) => r.class_name}
                loading={isFetching}
                exportFileName="fee-aging-by-class"
                dense
                empty={{
                  icon: AlertTriangle,
                  title: "No outstanding balances",
                  body: "Every pending bill falls inside the selected window, or there is nothing due.",
                }}
              />
            </DataPanel>

            {/* By student (top list) */}
            <DataPanel
              title={
                <span className="flex items-center">
                  Top Outstanding Students
                  {oldest30 > 0 && (
                    <Badge variant="warning" className="ml-2">
                      {oldest30} past 30 days
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
                searchPlaceholder="Search students…"
                exportFileName="fee-aging-by-student"
                dense
                empty={{
                  icon: AlertTriangle,
                  title: "No student balances",
                  body: "Nothing is outstanding for the selected date and class.",
                }}
              />
              {(data?.by_student?.length ?? 0) > 25 && (
                <p className="mt-2 text-xs text-[color:var(--w11-text-secondary)]">
                  Showing the 25 most overdue of {data!.by_student.length} students with balances.
                </p>
              )}
            </DataPanel>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
