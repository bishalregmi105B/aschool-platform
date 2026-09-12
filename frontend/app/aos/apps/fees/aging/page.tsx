"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
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
  n ? formatNepaliCurrency(n) : <span className="text-muted-foreground">—</span>;

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
        <span className={r.b90_plus > 0 ? "font-semibold text-red-600" : ""}>
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
      render: (s) => <span className="font-bold text-red-600">{formatNepaliCurrency(s.total || 0)}</span>,
    },
  ];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accounts Receivable Aging</h1>
          <p className="text-muted-foreground">
            Outstanding balances bucketed by days past the BS due date
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load the aging report. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Total Receivable
                    </p>
                    <p className="text-xl font-bold mt-1">
                      {formatNepaliCurrency(grandTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      as of {data?.as_of_bs || asOfBS} BS
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            {[
              {
                label: "Current / ≤30 days",
                value: byClass.reduce((s, r) => s + (r.current_or_30 || 0), 0),
                icon: Timer,
                cls: "text-green-600",
                bg: "bg-green-50",
              },
              {
                label: "31–90 days",
                value: byClass.reduce((s, r) => s + (r.b31_60 || 0) + (r.b61_90 || 0), 0),
                icon: Clock,
                cls: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                label: "90+ days",
                value: byClass.reduce((s, r) => s + (r.b90_plus || 0), 0),
                icon: Hourglass,
                cls: "text-red-600",
                bg: "bg-red-50",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <p className={`text-xl font-bold mt-1 ${stat.cls}`}>
                        {formatNepaliCurrency(stat.value)}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`h-4 w-4 ${stat.cls}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* By class */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aging by Class</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* By student (top list) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Top Outstanding Students
                {oldest30 > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {oldest30} past 30 days
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the 25 most overdue of {data!.by_student.length} students with balances.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
