"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import {
  fetchFeeReports,
  getFeeReportRange,
  type FeeReportPeriod,
} from "@/lib/services/dashboard/fees.service";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  Receipt,
  Users,
} from "lucide-react";

export default function FeeReportsPage() {
  return (
    <PluginGate slug="fees">
      <ReportsContent />
    </PluginGate>
  );
}

function ReportsContent() {
  const [period, setPeriod] = useState<FeeReportPeriod>("monthly");
  const [exportingCsv, setExportingCsv] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fee-reports", period],
    queryFn: () => fetchFeeReports(period),
  });

  const exportCollectionsCsv = async () => {
    setExportingCsv(true);
    try {
      // Narrow the CSV to the selected period (backend accepts inclusive ISO
      // from/to on GET /fees/collections/export).
      const range = getFeeReportRange(period);
      const res = await api.get("/fees/collections/export", {
        params: range,
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "text/csv" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `fee_collections_${range.start_date}_to_${range.end_date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("CSV export unavailable");
    } finally {
      setExportingCsv(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Unable to load fee report data.
        </CardContent>
      </Card>
    );
  }

  const overview = data.overview;
  const stats = [
    {
      label: "Total Expected",
      value: overview.totalExpected,
      icon: DollarSign,
      color: "text-blue-600",
    },
    {
      label: "Total Collected",
      value: overview.totalCollected,
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      label: "Outstanding",
      value: overview.totalOutstanding,
      icon: TrendingDown,
      color: "text-red-600",
    },
    {
      label: "Collection Rate",
      value: `${overview.collectionRate}%`,
      icon: PieChart,
      color: "text-purple-600",
    },
  ];

  const byClass = data.byClass;
  const recentPayments = data.recentPayments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Reports</h1>
          <p className="text-muted-foreground">
            Financial overview and collection analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-md px-3 py-2"
            value={period}
            onChange={(e) => setPeriod(e.target.value as FeeReportPeriod)}
          >
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="yearly">This Year</option>
          </select>
          <Button
            variant="outline"
            disabled={exportingCsv}
            onClick={exportCollectionsCsv}
          >
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const range = getFeeReportRange(period);
                const res = await api.get("/reports/fees/collection/pdf", {
                  params: range,
                  responseType: "blob",
                });
                const url = URL.createObjectURL(res.data as Blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "fee_collection_report.pdf";
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast.error("PDF export unavailable");
              }
            }}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>
                    {typeof s.value === "number"
                      ? `Rs. ${s.value.toLocaleString()}`
                      : s.value}
                  </p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Selected Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </span>
                <span className="font-medium">
                  {data.period.start} to {data.period.end}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Collected In Period
                </span>
                <span className="font-medium text-green-700">
                  {data.hasPeriodAnalytics &&
                  data.selectedPeriodCollected !== null
                    ? `Rs. ${data.selectedPeriodCollected.toLocaleString()}`
                    : "Unavailable"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Payments Recorded
                </span>
                <span className="font-medium">
                  {data.hasPeriodAnalytics &&
                  data.selectedPeriodPaymentsCount !== null
                    ? data.selectedPeriodPaymentsCount
                    : "Unavailable"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Students
                </span>
                <span className="font-medium">{data.totalStudents}</span>
              </div>
              {!data.hasPeriodAnalytics && (
                <p className="text-xs text-muted-foreground">
                  Detailed date-range analytics are unavailable for this school
                  configuration. Overall fee totals below are still live.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection by Class</CardTitle>
          </CardHeader>
          <CardContent>
            {byClass.length > 0 ? (
              <div className="space-y-3">
                {byClass.map((c, i) => (
                  <div key={`${c.class_name}-${i}`}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{c.class_name}</span>
                      <span>{c.rate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, c.rate)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No data available</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-4 border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{payment.student_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.fee_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-700">
                      Rs. {payment.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.receipt_number}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No recent payments available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
