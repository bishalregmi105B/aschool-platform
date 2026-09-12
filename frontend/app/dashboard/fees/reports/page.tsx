"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchFeeReports,
  getFeeReportRange,
  type FeeReportPeriod,
} from "@/lib/services/dashboard/fees.service";
import { formatBSMonth } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  Receipt,
  Users,
  Gavel,
  Settings2,
  Zap,
  HandCoins,
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
  const [reportTab, setReportTab] = useState("collection");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fee-reports", period],
    queryFn: () => fetchFeeReports(period),
    enabled: reportTab === "collection",
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

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading fee reports…" /></AOSPage>;

  return (
    <AOSPage>
      <Tabs value={reportTab} onValueChange={setReportTab} className="flex flex-col h-full">
        <AOSPageHeader
          title="Fee Reports"
          subtitle="Financial overview, fines and waivers analytics"
          actions={
            <TabsList>
              <TabsTrigger value="collection">Collection</TabsTrigger>
              <TabsTrigger value="fines">Fines</TabsTrigger>
              <TabsTrigger value="waivers">Waivers</TabsTrigger>
            </TabsList>
          }
        />
        <AOSPageBody className="space-y-4">
          <TabsContent value="collection" className="mt-0 space-y-4">
            {isError || !data ? (
              <DataPanel>
                <p className="text-sm text-[color:var(--w11-text-secondary)]">
                  Unable to load fee report data.
                </p>
              </DataPanel>
            ) : (
              <>
                <FilterCommandBar>
                  <div className="ml-auto flex items-center gap-2">
                    <AdvancedSelect
                      className="w-40"
                      value={period}
                      onChange={(v) => setPeriod(v as FeeReportPeriod)}
                      options={[
                        { value: "monthly", label: "This Month" },
                        { value: "quarterly", label: "This Quarter" },
                        { value: "yearly", label: "This Year" },
                      ]}
                    />
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
                </FilterCommandBar>

                <CollectionStats data={data} />
                <CollectionDetails data={data} />
              </>
            )}
          </TabsContent>

          <TabsContent value="fines" className="mt-0">
            <FinesContent />
          </TabsContent>

          <TabsContent value="waivers" className="mt-0">
            <WaiversContent />
          </TabsContent>
        </AOSPageBody>
      </Tabs>
    </AOSPage>
  );
}

// ── Collection tab ──────────────────────────────────────────────────────────

type FeeReportsData = NonNullable<Awaited<ReturnType<typeof fetchFeeReports>>>;

function CollectionStats({ data }: { data: FeeReportsData }) {
  const overview = data.overview;
  const stats = [
    {
      label: "Total Expected",
      value: overview.totalExpected,
      icon: DollarSign,
      color: "var(--w11-accent)",
    },
    {
      label: "Total Collected",
      value: overview.totalCollected,
      icon: TrendingUp,
      color: "#107c10",
    },
    {
      label: "Outstanding",
      value: overview.totalOutstanding,
      icon: TrendingDown,
      color: "#c42b1c",
    },
    {
      label: "Collection Rate",
      value: `${overview.collectionRate}%`,
      icon: PieChart,
      color: "var(--w11-accent)",
    },
  ];

  return (
    <StatGrid className="mb-0" min={180}>
      {stats.map((s, i) => (
        <KpiCard
          key={i}
          label={s.label}
          value={
            typeof s.value === "number"
              ? `Rs. ${s.value.toLocaleString()}`
              : s.value
          }
          color={s.color}
          icon={<s.icon className="h-5 w-5" style={{ color: s.color, opacity: 0.6 }} />}
        />
      ))}
    </StatGrid>
  );
}

function CollectionDetails({ data }: { data: FeeReportsData }) {
  const byClass = data.byClass;
  const recentPayments = data.recentPayments;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataPanel title="Selected Period">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--w11-text-secondary)] flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </span>
              <span className="font-medium">
                {data.period.start} to {data.period.end}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--w11-text-secondary)] flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Collected In Period
              </span>
              <span className="font-medium" style={{ color: "#107c10" }}>
                {data.hasPeriodAnalytics &&
                data.selectedPeriodCollected !== null
                  ? `Rs. ${data.selectedPeriodCollected.toLocaleString()}`
                  : "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--w11-text-secondary)] flex items-center gap-2">
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
              <span className="text-[color:var(--w11-text-secondary)] flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Students
              </span>
              <span className="font-medium">{data.totalStudents}</span>
            </div>
            {!data.hasPeriodAnalytics && (
              <p className="text-xs text-[color:var(--w11-text-secondary)]">
                Detailed date-range analytics are unavailable for this school
                configuration. Overall fee totals below are still live.
              </p>
            )}
          </div>
        </DataPanel>

        <DataPanel title="Collection by Class">
          {byClass.length > 0 ? (
            <div className="space-y-3">
              {byClass.map((c, i) => (
                <div key={`${c.class_name}-${i}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.class_name}</span>
                    <span>{c.rate}%</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: "var(--w11-control-hover)" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.min(100, c.rate)}%`, background: "#107c10" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-[color:var(--w11-text-secondary)] py-8">No data available</p>}
        </DataPanel>
      </div>

      <DataPanel title="Recent Payments">
        {recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-4 border-b border-[var(--w11-border-subtle)] last:border-b-0 pb-3 last:pb-0"
              >
                <div>
                  <p className="font-medium">{payment.student_name}</p>
                  <p className="text-sm text-[color:var(--w11-text-secondary)]">
                    {payment.fee_type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium" style={{ color: "#107c10" }}>
                    Rs. {payment.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">
                    {payment.receipt_number}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[color:var(--w11-text-secondary)] py-8">
            No recent payments available
          </p>
        )}
      </DataPanel>
    </>
  );
}

// ── Fines tab ───────────────────────────────────────────────────────────────

interface FinePolicy {
  mode: "none" | "fixed_once" | "daily_percent";
  value: number;
  grace_days: number;
  max_amount?: number | null;
}

interface FinesReport {
  by_class: Array<{ class_name: string; fine_total: number }>;
  by_month: Array<{ month_bs: string; fine_total: number }>;
  grand_total: number;
}

function FinesContent() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fee-fines-report"],
    retry: 1,
    queryFn: async () => {
      const r = await api.get("/fees/reports/fines");
      return r.data?.data as FinesReport | null;
    },
  });

  const { data: policy } = useQuery({
    queryKey: ["fee-fines-policy"],
    retry: 1,
    queryFn: async () => {
      const r = await api.get("/fees/fines/settings");
      return (r.data?.data?.policy as FinePolicy) ?? null;
    },
  });

  const accrue = useMutation({
    mutationFn: async () => (await api.post("/fees/fines/accrue", {})).data?.data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["fee-fines-report"] });
      toast.success(
        `Fines accrued on ${res?.bills_fined ?? 0} bill(s) — total ${formatNepaliCurrency(res?.fine_total || 0)}.`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Fine accrual failed"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading fines report…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[color:var(--w11-text-secondary)]">
          <Gavel className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Late fines accrued, grouped by class and BS month
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Fine Policy
            {policy && (
              <Badge variant="secondary" className="ml-2">
                {policy.mode === "none"
                  ? "No fines"
                  : policy.mode === "fixed_once"
                    ? `Rs. ${policy.value} once`
                    : `${policy.value}% daily`}
              </Badge>
            )}
          </Button>
          <Button onClick={() => accrue.mutate()} disabled={accrue.isPending}>
            {accrue.isPending ? (
              <Spinner className="mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Accrue Fines Now
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-[#c42b1c]">Failed to load the fines report. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <StatGrid className="mb-0" min={200}>
            <KpiCard
              label="Grand Total Fines"
              value={formatNepaliCurrency(data?.grand_total || 0)}
              color="#c42b1c"
            />
          </StatGrid>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataPanel title="Fines by Class">
              {data?.by_class?.length ? (
                <div className="divide-y divide-[var(--w11-border-subtle)]">
                  {data.by_class.map((r) => (
                    <div key={r.class_name} className="py-2.5 flex items-center justify-between">
                      <span className="text-sm font-medium">{r.class_name}</span>
                      <span className="text-sm font-bold" style={{ color: "#c42b1c" }}>
                        {formatNepaliCurrency(r.fine_total || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                  No fines accrued yet.
                </p>
              )}
            </DataPanel>

            <DataPanel title="Fines by Month (BS)">
              {data?.by_month?.length ? (
                <div className="divide-y divide-[var(--w11-border-subtle)]">
                  {data.by_month.map((r) => (
                    <div key={r.month_bs} className="py-2.5 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatBSMonth(r.month_bs)}
                      </span>
                      <span className="text-sm font-bold" style={{ color: "#c42b1c" }}>
                        {formatNepaliCurrency(r.fine_total || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                  No fines accrued yet.
                </p>
              )}
            </DataPanel>
          </div>
        </>
      )}

      <FinePolicyDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

function FinePolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["fee-fines-policy"],
    retry: 1,
    queryFn: async () => {
      const r = await api.get("/fees/fines/settings");
      return (r.data?.data?.policy as FinePolicy) ?? null;
    },
  });

  const [mode, setMode] = useState<string>("none");
  const [value, setValue] = useState("0");
  const [graceDays, setGraceDays] = useState("0");
  const [maxAmount, setMaxAmount] = useState("");

  // Seed the form from the loaded policy (once per open).
  useEffect(() => {
    if (open && data) {
      setMode(data.mode);
      setValue(String(data.value ?? 0));
      setGraceDays(String(data.grace_days ?? 0));
      setMaxAmount(data.max_amount != null ? String(data.max_amount) : "");
    }
  }, [open, data]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        mode,
        value: parseFloat(value) || 0,
        grace_days: parseInt(graceDays, 10) || 0,
      };
      if (maxAmount && parseFloat(maxAmount) > 0) body.max_amount = parseFloat(maxAmount);
      const r = await api.put("/fees/fines/settings", body);
      return r.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-fines-policy"] });
      onOpenChange(false);
      toast.success("Fine policy saved.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Could not save fine policy"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fine Policy</DialogTitle>
        </DialogHeader>
        {isLoading && !data ? (
          <AOSModuleLoadingState />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mode</Label>
              <AdvancedSelect
                value={mode}
                onChange={(v) => setMode(v)}
                options={[
                  { value: "none", label: "No late fines" },
                  { value: "fixed_once", label: "Fixed amount (charged once)" },
                  { value: "daily_percent", label: "Daily percent of the due" },
                ]}
              />
            </div>
            {mode !== "none" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">
                    {mode === "fixed_once" ? "Amount (Rs.)" : "Percent (%)"}
                  </Label>
                  <Input type="number" min="0" step="0.01" value={value}
                    onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Grace Days</Label>
                  <Input type="number" min="0" value={graceDays}
                    onChange={(e) => setGraceDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Max Fine (Rs., optional)</Label>
                  <Input type="number" min="0" step="0.01" value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)} placeholder="No cap" />
                </div>
              </div>
            )}
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              Fines are applied to overdue bills when you press “Accrue Fines Now”
              (or on schedule, if configured). Bills already fully paid or waived
              are never fined.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Spinner className="mr-2" />} Save Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Waivers tab ─────────────────────────────────────────────────────────────

interface WaiversReport {
  by_class: Array<{ class_name: string; waiver_total: number }>;
  by_fee_type: Array<{ fee_type: string; waiver_total: number }>;
  grand_total: number;
}

function WaiversContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fee-waivers-report"],
    retry: 1,
    queryFn: async () => {
      const r = await api.get("/fees/reports/waivers");
      return r.data?.data as WaiversReport | null;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading waivers report…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[color:var(--w11-text-secondary)]">
        <HandCoins className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
        Every rupee waived (scholarships + credits) — the accountability view
      </div>

      {isError ? (
        <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-[#c42b1c]">Failed to load the waivers report. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <StatGrid className="mb-0" min={200}>
            <KpiCard
              label="Grand Total Waived"
              value={formatNepaliCurrency(data?.grand_total || 0)}
            />
          </StatGrid>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataPanel title="Waivers by Class">
              {data?.by_class?.length ? (
                <div className="divide-y divide-[var(--w11-border-subtle)]">
                  {data.by_class.map((r) => (
                    <div key={r.class_name} className="py-2.5 flex items-center justify-between">
                      <span className="text-sm font-medium">{r.class_name}</span>
                      <span className="text-sm font-bold">
                        {formatNepaliCurrency(r.waiver_total || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                  No waivers recorded yet.
                </p>
              )}
            </DataPanel>

            <DataPanel title="Waivers by Fee Type">
              {data?.by_fee_type?.length ? (
                <div className="divide-y divide-[var(--w11-border-subtle)]">
                  {data.by_fee_type.map((r) => (
                    <div key={r.fee_type} className="py-2.5 flex items-center justify-between">
                      <span className="text-sm font-medium">{r.fee_type}</span>
                      <span className="text-sm font-bold">
                        {formatNepaliCurrency(r.waiver_total || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                  No waivers recorded yet.
                </p>
              )}
            </DataPanel>
          </div>
        </>
      )}
    </div>
  );
}
