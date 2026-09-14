"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column, type BulkAction } from "@/components/ui/data-table";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid, DataPanel,
} from "@/components/aos/kit/page-kit";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  ArrowRightLeft,
  History,
  Loader2,
  PlayCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { useI18n } from "@/lib/i18n";

interface CarryStudent {
  student_id: string;
  student_name: string;
  class_name: string | null;
  balance: number;
  balance_type: "due" | "credit";
  signed_balance: number;
}

interface CarryPreview {
  from_year_bs: string;
  students: CarryStudent[];
  total_due: number;
  total_credit: number;
}

interface CarryLogRow {
  id: string;
  student_id: string;
  action: string;
  balance: number;
  balance_type: string;
  from_year_bs: string;
  to_year_bs: string;
  detail: string | null;
  created_at: string | null;
}

interface CarryLogPayload {
  log: CarryLogRow[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

const YEARS = Array.from({ length: 16 }, (_, i) => 2075 + i);

export default function CarryForwardPage() {
  return (
    <PluginGate slug="fees">
      <CarryForwardContent />
    </PluginGate>
  );
}

function CarryForwardContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["tab"]);
  const tab = urlFilters.tab || "wizard";
  const setTab = (v: string) => setUrlFilters({ tab: v === "wizard" ? "" : v });

  // Wizard state
  const [fromYear, setFromYear] = useState("2082");
  const [toYear, setToYear] = useState("2083");
  const [classId, setClassId] = useState("");
  const [preview, setPreview] = useState<CarryPreview | null>(null);
  const [applyTarget, setApplyTarget] = useState<CarryStudent[] | null>(null);
  const [dueDateBS, setDueDateBS] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const r = await api.get("/academics/classes");
      return r.data?.data || [];
    },
  });

  const runPreview = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ from_year_bs: fromYear });
      if (classId) params.set("class_id", classId);
      const r = await api.get(`/fees/carry-forward/preview?${params.toString()}`);
      return r.data?.data as CarryPreview;
    },
    onSuccess: (d) => {
      setPreview(d);
      if (!d.students?.length) {
        toast.info(`No non-zero balances found for ${fromYear} BS.`);
      }
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Preview failed"),
  });

  const apply = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const body: Record<string, unknown> = {
        from_year_bs: fromYear,
        to_year_bs: toYear,
        student_ids: studentIds,
      };
      if (dueDateBS) body.due_date_bs = dueDateBS;
      const r = await api.post("/fees/carry-forward/apply", body);
      return r.data?.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["carry-forward-log"] });
      queryClient.invalidateQueries({ queryKey: ["fee-aging"] });
      setApplyTarget(null);
      setPreview(null);
      toast.success(
        `Carry-forward complete: ${res?.applied ?? 0} applied, ${res?.skipped ?? 0} skipped, ${res?.bills_created ?? 0} bill(s) created.`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Carry-forward failed"),
  });

  const [logPage, setLogPage] = useState(1);

  const logQuery = useQuery({
    enabled: tab === "log",
    queryKey: ["carry-forward-log", logPage],
    retry: 1,
    queryFn: async () => {
      const r = await api.get(`/fees/carry-forward/log?page=${logPage}&per_page=20`);
      return r.data?.data as CarryLogPayload | null;
    },
  });

  const CARRY_COLUMNS: Column<CarryStudent>[] = [
    {
      key: "student_name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (s) => s.student_name || "",
      render: (s) => (
        <div>
          <p className="font-medium">{s.student_name}</p>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">{s.class_name || "—"}</p>
        </div>
      ),
    },
    {
      key: "balance_type",
      label: t("Type", "प्रकार"),
      sortable: true,
      value: (s) => s.balance_type,
      render: (s) => (
        <Badge variant={s.balance_type === "due" ? "destructive" : "success"}>
          {s.balance_type === "due" ? t("Due", "बाँकी") : t("Credit", "क्रेडिट")}
        </Badge>
      ),
    },
    {
      key: "signed_balance",
      label: t("Signed Balance", "रकम (चिनो)"),
      align: "right",
      sortable: true,
      value: (s) => s.signed_balance,
      render: (s) => (
        <span style={{ color: s.signed_balance > 0 ? "#c42b1c" : "#107c10" }}>
          {formatNepaliCurrency(s.signed_balance || 0)}
        </span>
      ),
    },
    {
      key: "balance",
      label: t("Amount", "रकम"),
      align: "right",
      sortable: true,
      value: (s) => s.balance,
      render: (s) => <span className="font-bold">{formatNepaliCurrency(s.balance || 0)}</span>,
    },
  ];

  const bulkActions: BulkAction<CarryStudent>[] = [
    {
      key: "apply",
      label: t("Apply Carry-Forward", "रकम सारि लागू"),
      tone: "default",
      onClick: (rows) => setApplyTarget(rows),
    },
  ];

  const LOG_COLUMNS: Column<CarryLogRow>[] = [
    {
      key: "student_id",
      label: "Student ID",
      value: (r) => r.student_id,
      render: (r) => <span className="font-mono text-xs">{r.student_id.slice(0, 8)}…</span>,
    },
    {
      key: "action",
      label: "Action",
      sortable: true,
      value: (r) => r.action,
      render: (r) => <Badge variant="outline">{r.action}</Badge>,
    },
    {
      key: "balance",
      label: "Amount",
      align: "right",
      sortable: true,
      value: (r) => r.balance,
      render: (r) => (
        <span style={{ color: r.balance_type === "due" ? "#c42b1c" : "#107c10" }}>
          {formatNepaliCurrency(r.balance || 0)}
        </span>
      ),
    },
    {
      key: "years",
      label: "From → To",
      value: (r) => `${r.from_year_bs} → ${r.to_year_bs}`,
      render: (r) => (
        <span className="text-sm">
          {r.from_year_bs} → {r.to_year_bs}
        </span>
      ),
    },
    {
      key: "detail",
      label: "Detail",
      value: (r) => r.detail ?? "",
      render: (r) => <span className="text-xs text-[color:var(--w11-text-secondary)]">{r.detail || "—"}</span>,
    },
    {
      key: "created_at",
      label: "Recorded",
      sortable: true,
      value: (r) => r.created_at ?? "",
      render: (r) => (r.created_at ? displayBS(r.created_at) : "—"),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ArrowRightLeft className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Carry Forward", "रकम सारि लागू")}
        subtitle={t("Roll last year's due/credit balances into the new academic year", "पगेको वर्षको बाँकी/क्रेडिट नयो शैक्षिक वर्षमा सार्नु")}
      />
      <AOSPageBody>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="wizard" className="gap-1">
              <ArrowRightLeft className="h-3.5 w-3.5" /> {t("Carry Forward", "सारि")}
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-1">
              <History className="h-3.5 w-3.5" /> {t("Log", "लग")}&#32;
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wizard" className="space-y-4 mt-4">
            {/* Step 1: pick years */}
            <DataPanel title={t("1. Pick Academic Years (BS)", "1. शैक्षिक वर्ष छान्नु (BS)")}>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t("From Year (BS)", "गरेको वर्ष")}</Label>
                  <AdvancedSelect
                    value={fromYear}
                    onChange={(v) => {
                      setFromYear(v);
                      setPreview(null);
                    }}
                    options={YEARS.map((y) => ({ value: String(y), label: `${y}` }))}
                    className="w-36"
                  />
                </div>
                <ArrowRightLeft className="h-4 w-4 mb-2 text-[color:var(--w11-text-secondary)]" />
                <div className="space-y-1">
                  <Label className="text-xs">{t("To Year (BS)", "नयो वर्ष")}</Label>
                  <AdvancedSelect
                    value={toYear}
                    onChange={(v) => setToYear(v)}
                    options={YEARS.map((y) => ({ value: String(y), label: `${y}` }))}
                    className="w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("Class (optional)", "कक्षा (वैकल्पिक)")}</Label>
                  <AdvancedSelect
                    value={classId}
                    onChange={(v) => {
                      setClassId(v);
                      setPreview(null);
                    }}
                    clearable
                    placeholder={t("All Classes", "सबै कक्षा")}
                    className="w-44"
                    options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
                  />
                </div>
                <Button
                  onClick={() => runPreview.mutate()}
                  disabled={runPreview.isPending || !fromYear || !toYear}
                >
                  {runPreview.isPending ? (
                    <Spinner className="mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {t("Load Preview", "क्षणहेरी हेर्नु")}
                </Button>
                {fromYear === toYear && (
                  <p className="text-xs mb-1" style={{ color: "#c42b1c" }}>
                    {t("From and to years must differ.", "दुवै वर्ष फर्क हुनुपर्छ")}
                  </p>
                )}
              </div>
            </DataPanel>

            {/* Step 2: preview + selection */}
            {preview && (
              <>
                <StatGrid className="mb-0" min={200}>
                  <KpiCard
                    label={t("Total Due to Carry", "सार्ने कुल बाँकी")}
                    value={formatNepaliCurrency(preview.total_due || 0)}
                    color="#c42b1c"
                  />
                  <KpiCard
                    label={t("Total Credit to Carry", "सार्ने कुल क्रेडिट")}
                    value={formatNepaliCurrency(preview.total_credit || 0)}
                    color="#107c10"
                  />
                  <KpiCard label={t("Students with Balances", "रकम बाँकी विद्यार्थी")} value={preview.students.length} />
                </StatGrid>

                <DataPanel
                  title={
                    <span className="flex items-center gap-2">
                      {t("2. Select Students", "2. विद्यार्थी छान्नु")}
                      <span className="text-xs font-normal text-[color:var(--w11-text-secondary)]">
                        {t("Balances for", "रकम")} {preview.from_year_bs} BS
                      </span>
                    </span>
                  }
                >
                  <DataTable<CarryStudent>
                    columns={CARRY_COLUMNS}
                    rows={preview.students}
                    rowKey={(s) => s.student_id}
                    loading={runPreview.isPending}
                    selectable
                    bulkActions={bulkActions}
                    exportFileName="carry-forward-preview"
                    dense
                    empty={{
                      icon: TrendingUp,
                      title: t("No balances to carry", "सार्ने रकम छेन"),
                      body: `${preview.from_year_bs} BS {t("ma kunai baunki chhaina", "मा कुनै रकम बाँकी छेन")}`,
                    }}
                  />
                </DataPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="log" className="mt-4">
            <DataPanel title={t("Carry-Forward History", "रकम सारि यश")}>
              <DataTable<CarryLogRow>
                columns={LOG_COLUMNS}
                rows={logQuery.data?.log ?? []}
                rowKey={(r) => r.id}
                loading={logQuery.isLoading}
                error={logQuery.isError ? t("Failed to load carry-forward log.", "लग लोड सकिएन।") : undefined}
                onRetry={() => logQuery.refetch()}
                pagination={
                  logQuery.data?.meta
                    ? {
                        total: logQuery.data.meta.total,
                        page: logQuery.data.meta.page,
                        per_page: logQuery.data.meta.per_page,
                        pages: logQuery.data.meta.pages,
                        has_next: logQuery.data.meta.has_next,
                        has_prev: logQuery.data.meta.has_prev,
                      }
                    : undefined
                }
                onPageChange={setLogPage}
                exportFileName="carry-forward-log"
                dense
                empty={{
                  icon: History,
                  title: t("No carry-forward entries yet", "अहिले कुनै प्रविष्ट छेन"),
                  body: t("Applied carry-forwards will be logged here.", "लागू एक्षयहरू यहाँ लग्नेछ।"),
                }}
              />
            </DataPanel>
          </TabsContent>
        </Tabs>

        {/* Apply confirmation dialog */}
        <Dialog
          open={Boolean(applyTarget)}
          onOpenChange={(open) => !open && setApplyTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Apply Carry-Forward", "रकम सारि लागू")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--w11-text-secondary)]">
                {t(`Roll ${applyTarget?.length ?? 0} selected balance(s) from ${fromYear} to ${toYear} BS. Due balances become pending bills in the new year; credits become self-settling lines. Already-applied students are skipped.`, `छानिएका ${applyTarget?.length ?? 0} विद्यार्थीका रकम ${fromYear} बाट ${toYear} BS मा सर्नेछन्। बाँकी रकम नयाँ वर्षको बिजक बन्छ; क्रेडिट आफैँ मिल्ने लाइन बन्छ। पहिले लागू भएका छोडिन्छन्।`)}
              </p>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1" style={{ color: "#c42b1c" }}>
                  <TrendingDown className="h-4 w-4" />
                  Due:{" "}
                  {formatNepaliCurrency(
                    applyTarget?.reduce((s, r) => s + (r.balance_type === "due" ? r.balance : 0), 0) || 0,
                  )}
                </span>
                <span className="flex items-center gap-1" style={{ color: "#107c10" }}>
                  <TrendingUp className="h-4 w-4" />
                  Credit:{" "}
                  {formatNepaliCurrency(
                    applyTarget?.reduce((s, r) => s + (r.balance_type === "credit" ? r.balance : 0), 0) || 0,
                  )}
                </span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("Due Date for the new bill (BS, optional)", "नयौको बिजकको मिति (वैकल्पिक)")}</Label>
                <BSDateInput value={dueDateBS} onChange={(v) => setDueDateBS(v)} emit="bs" className="w-56" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyTarget(null)} disabled={apply.isPending}>
                {t("Cancel", "रद्द")}
              </Button>
              <Button
                onClick={() => apply.mutate((applyTarget || []).map((s) => s.student_id))}
                disabled={apply.isPending || !applyTarget?.length || fromYear === toYear}
              >
                {apply.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                )}
                {t("Apply to", "लागू")} {applyTarget?.length ?? 0} {t("student(s)", "विद्यार्थी")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
