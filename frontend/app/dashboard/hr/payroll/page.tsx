"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { useI18n } from "@/lib/i18n";
import {
  CheckCircle,
  DollarSign,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";

interface PayrollRow {
  id: string;
  staff_name: string;
  month?: string;
  basic_salary: number | null;
  allowances: number;
  deductions: number;
  allowance_items?: Record<string, number>;
  deduction_items?: Record<string, number>;
  gross_salary: number;
  net_salary: number;
  status: string;
}

interface ComponentRow {
  name: string;
  amount: string;
}

function componentsToRows(items: Record<string, number> | undefined): ComponentRow[] {
  return Object.entries(items || {}).map(([name, amount]) => ({
    name,
    amount: String(amount ?? ""),
  }));
}

function rowsToComponents(rows: ComponentRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    const name = r.name.trim();
    const amount = Number.parseFloat(r.amount);
    if (name && Number.isFinite(amount) && amount !== 0) {
      out[name] = amount;
    }
  });
  return out;
}

/**
 * Payroll — the draft→approved→paid lifecycle the backend enforces
 * (`_STATUS_TRANSITIONS` in hr_payroll.py). Only legal actions are rendered:
 * edit/approve on drafts, pay on approved, payslip always. Bulk actions go
 * through useConfirm (no native dialogs), and a StatusTimeline shows where
 * the month's run currently sits.
 */
export default function PayrollPage() {
  return (
    <PluginGate slug="hr">
      <PayrollContent />
    </PluginGate>
  );
}

function PayrollContent() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["month"]);
  const month =
    urlFilters.month || new Date().toISOString().slice(0, 7);
  const [editing, setEditing] = useState<PayrollRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["payroll", month],
    queryFn: async () => {
      const r = await api.get("/hr/payroll", { params: { month } });
      return r.data;
    },
    retry: 1,
  });

  const payroll: PayrollRow[] = data?.data || [];
  const summary = data?.summary || {};

  const generate = useMutation({
    mutationFn: async () =>
      (await api.post("/hr/payroll/generate", { month })).data,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      const created = res?.data?.created ?? 0;
      toast.success(
        created > 0
          ? t(
              `Payroll generated for ${created} staff. Edit each row to set salary components.`,
              `${created} कर्मचारीको पेरोल बन्यो। रकम मिलाउन पङ्क्ति सम्पादन गर्नुहोस्।`
            )
          : t(
              "All staff already have payroll records for this month.",
              "यस महिनाका सबै कर्मचारीको पेरोल रेकर्ड पहिले नै छ।"
            ),
      );
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error || t("Failed to generate payroll", "पेरोल बनाउन सकिएन"),
      ),
  });

  const runAction = async (
    action: "approve" | "mark_paid",
    ids: string[]
  ) => {
    if (!ids.length) return;
    const ok = await confirm({
      title:
        action === "approve"
          ? t(`Approve ${ids.length} payroll record(s)?`, `${ids.length} पेरोल स्वीकृति गर्ने?`)
          : t(`Mark ${ids.length} payroll record(s) as paid?`, `${ids.length} पेरोल भुक्तानी चिन्ह लगाउने?`),
      body:
        action === "approve"
          ? t(
              `Approving ${ids.length} record(s) for ${month} unlocks payment for them.`,
              `${month} का ${ids.length} रेकर्ड स्वीकृत भएपछि तिनीहरूको भुक्तानी खोल्न मिल्नेछ।`
            )
          : t(
              `This records the payment date for ${ids.length} approved record(s) of ${month}. Only approved records are affected.`,
              `${month} का ${ids.length} स्वीकृत रेकर्डको भुक्तानी मिति लग हुनेछ।`
            ),
      confirmLabel:
        action === "approve" ? t("Approve", "स्वीकृति") : t("Mark paid", "भुक्तानी चिन्ह"),
      tone: action === "mark_paid" ? "danger" : "default",
    });
    if (!ok) return;
    try {
      const res = await api.post("/hr/payroll/bulk-action", { action, month, ids });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      const updated = res.data?.data?.updated ?? 0;
      const skipped = res.data?.data?.skipped ?? 0;
      toast.success(
        `${updated} ${action === "approve" ? t("approved", "स्वीकृत") : t("marked paid", "भुक्तानी चिन्ह")}` +
          (skipped > 0 ? ` — ${skipped} ${t("skipped (wrong status)", "छुटे (गलत अवस्था)")}` : ""),
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t("Action failed", "कार्य असफल"));
    }
  };

  const payOne = async (p: PayrollRow) => {
    try {
      await api.post(`/hr/payroll/${p.id}/pay`, { payment_method: "bank" });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(t(`${p.staff_name} marked as paid`, `${p.staff_name} भुक्तानी भएको चिन्ह`));
    } catch {
      toast.error(t("Failed to mark as paid", "भुक्तानी चिन्न सकिएन"));
    }
  };

  const approveOne = async (p: PayrollRow) => {
    try {
      await api.post(`/hr/payroll/${p.id}/approve`);
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(t(`${p.staff_name} approved`, `${p.staff_name} स्वीकृत`));
    } catch {
      toast.error(t("Failed to approve", "स्वीकृत गर्न सकिएन"));
    }
  };

  const downloadPayslip = async (p: PayrollRow) => {
    try {
      const res = await api.get(`/hr/payroll/${p.id}/payslip`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip_${p.staff_name}_${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("Failed to download payslip", "पे-स्लिप डाउनलोड सकिएन"));
    }
  };

  // Run progress (draft→approved→paid) for the StatusTimeline.
  const draftCount = payroll.filter((p) => p.status === "draft").length;
  const approvedCount = payroll.filter((p) => p.status === "approved").length;
  const paidCount = payroll.filter((p) => p.status === "paid").length;
  const runStage =
    payroll.length === 0
      ? 0
      : draftCount > 0
      ? 1
      : approvedCount > 0
      ? 2
      : 3;

  const COLUMNS: Column<PayrollRow>[] = [
    {
      key: "staff_name",
      label: t("Staff", "कर्मचारी"),
      sortable: true,
      value: (p) => p.staff_name,
      render: (p) => <span className="font-medium">{p.staff_name}</span>,
    },
    {
      key: "basic_salary",
      label: t("Basic", "आधार"),
      align: "right",
      sortable: true,
      value: (p) => p.basic_salary || 0,
      render: (p) => <span className="tabular-nums">Rs. {(p.basic_salary || 0).toLocaleString()}</span>,
    },
    {
      key: "allowances",
      label: t("Allowances", "भत्ता"),
      align: "right",
      sortable: true,
      value: (p) => p.allowances || 0,
      render: (p) => (
        <span className="tabular-nums" style={{ color: "#107c10" }}>
          Rs. {(p.allowances || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "deductions",
      label: t("Deductions", "कट्टा"),
      align: "right",
      sortable: true,
      value: (p) => p.deductions || 0,
      render: (p) => (
        <span className="tabular-nums" style={{ color: "#c42b1c" }}>
          Rs. {(p.deductions || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "net_salary",
      label: t("Net Salary", "खुद तलब"),
      align: "right",
      sortable: true,
      value: (p) => p.net_salary || 0,
      render: (p) => (
        <span className="font-bold tabular-nums">Rs. {(p.net_salary || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (p) => p.status,
      render: (p) => <StatusChip status={p.status || "draft"} className="capitalize" />,
    },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      align: "right",
      noExport: true,
      render: (p) => (
        <div className="flex justify-end gap-1">
          {p.status !== "paid" && (
            <Button
              variant="ghost"
              size="sm"
              title={t("Edit salary components", "तलब विवरण सम्पादन")}
              onClick={() => setEditing(p)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            title={t("Download payslip", "पे-स्लिप डाउनलोड")}
            onClick={() => downloadPayslip(p)}
          >
            <FileText className="h-4 w-4" />
          </Button>
          {/* Only legal transitions render as actions (backend-enforced). */}
          {p.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              title={t("Approve", "स्वीकृति")}
              onClick={() => approveOne(p)}
            >
              <CheckCircle className="h-4 w-4" style={{ color: "#107c10" }} />
            </Button>
          )}
          {p.status === "approved" && (
            <Button
              variant="ghost"
              size="sm"
              title={t("Mark as paid", "भुक्तानी चिन्ह")}
              onClick={() => payOne(p)}
            >
              <Wallet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Payroll Management", "पेरोल व्यवस्थापन")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <ErrorState
              title={t("Failed to load payroll records.", "पेरोल रेकर्ड लोड गर्न सकिएन।")}
              onRetry={() => refetch()}
            />
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Wallet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Payroll Management", "पेरोल व्यवस्थापन")}
        subtitle={t(`Monthly salary processing and payslips`, "मासिक तलब प्रशोधन र पे-स्लिप") + ` · ${month}`}
        actions={
          <input
            type="month"
            className="win11-select border rounded-md px-3 py-2"
            style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)" }}
            value={month}
            onChange={(e) => setUrlFilters({ month: e.target.value })}
          />
        }
      />
      <AOSPageBody>
        <StatGrid min={180}>
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="win11-card h-24 animate-pulse" style={{ margin: 0 }} />
              ))}
            </>
          ) : (
            <>
              <KpiCard
                label={t("Total Staff", "कुल कर्मचारी")}
                value={payroll.length || summary.total_staff || 0}
                icon={<DollarSign className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
              />
              <KpiCard
                label={t("Gross Salary", "कुल तलब")}
                value={`Rs. ${(
                  summary.gross_total || payroll.reduce((s: number, p) => s + (p.gross_salary || 0), 0)
                ).toLocaleString()}`}
              />
              <KpiCard
                label={t("Deductions", "कट्टा")}
                value={`Rs. ${(
                  summary.total_deductions || payroll.reduce((s: number, p) => s + (p.deductions || 0), 0)
                ).toLocaleString()}`}
                color="#c42b1c"
              />
              <KpiCard
                label={t("Net Pay", "खुद भुक्तानी")}
                value={`Rs. ${(
                  summary.net_total || payroll.reduce((s: number, p) => s + (p.net_salary || 0), 0)
                ).toLocaleString()}`}
                color="#107c10"
              />
            </>
          )}
        </StatGrid>

        {/* The month's run as a single progression — where is payroll now? */}
        <DataPanel title={t("Run Progress", "प्रगति")} className="mb-4">
          <StatusTimeline
            orientation="horizontal"
            currentIndex={runStage}
            steps={[
              { label: t("Generated", "बनाइएको"), detail: `${payroll.length} ${t("records", "रेकर्ड")}` },
              { label: t("Draft — review", "मस्यौदा"), detail: `${draftCount} ${t("pending", "बाँकी")}` },
              { label: t("Approved", "स्वीकृत"), detail: `${approvedCount} ${t("to pay", "तिर्न")}` },
              { label: t("Paid", "भुक्तानी"), detail: `${paidCount} ${t("settled", "तिरेको")}` },
            ]}
          />
        </DataPanel>

        <FilterCommandBar>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Spinner className="mr-2" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}{" "}
            {t("Generate Payroll", "पेरोल बनाउनुहोस्")}
          </Button>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable<PayrollRow>
            columns={COLUMNS}
            rows={payroll}
            rowKey={(p) => p.id}
            loading={isLoading}
            selectable
            bulkActions={[
              {
                key: "approve",
                label: t("Approve drafts", "मस्यौदा स्वीकृति"),
                onClick: (rows) =>
                  runAction(
                    "approve",
                    rows.filter((r) => r.status === "draft").map((r) => r.id)
                  ),
              },
              {
                key: "mark_paid",
                label: t("Mark paid", "भुक्तानी चिन्ह"),
                tone: "danger",
                onClick: (rows) =>
                  runAction(
                    "mark_paid",
                    rows.filter((r) => r.status === "approved").map((r) => r.id)
                  ),
              },
            ]}
            searchable
            searchPlaceholder={t("Search staff…", "कर्मचारी खोज्नुहोस्…")}
            exportFileName={`payroll-${month}`}
            dense
            empty={{
              icon: Wallet,
              title: t("No payroll records for this month.", "यस महिनाको पेरोल रेकर्ड छैन।"),
              body: t("Click Generate Payroll to draft every staff member.", "पेरोल बनाउनुहोस् थिच्नुहोस्।"),
              action: { label: t("Generate Payroll", "पेरोल बनाउनुहोस्"), onClick: () => generate.mutate() },
            }}
          />
        </DataPanel>

        {editing ? (
          <EditComponentsDialog payroll={editing} onClose={() => setEditing(null)} />
        ) : null}
      </AOSPageBody>
    </AOSPage>
  );
}

function EditComponentsDialog({
  payroll,
  onClose,
}: {
  payroll: PayrollRow;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [basicSalary, setBasicSalary] = useState(
    () => String(payroll.basic_salary ?? ""),
  );
  const [allowanceRows, setAllowanceRows] = useState<ComponentRow[]>(() =>
    componentsToRows(payroll.allowance_items),
  );
  const [deductionRows, setDeductionRows] = useState<ComponentRow[]>(() =>
    componentsToRows(payroll.deduction_items),
  );

  const num = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const sumRows = (rows: ComponentRow[]) =>
    rows.reduce((sum, r) => sum + num(r.amount), 0);

  const basic = num(basicSalary);
  const allowancesTotal = sumRows(allowanceRows);
  const deductionsTotal = sumRows(deductionRows);
  const gross = basic + allowancesTotal;
  const net = gross - deductionsTotal;

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        basic_salary: basic,
        allowances: rowsToComponents(allowanceRows),
        deductions: rowsToComponents(deductionRows),
      };
      return (await api.put(`/hr/payroll/${payroll.id}`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(t(`Salary components saved for ${payroll.staff_name}`, "तलब विवरण सुरक्षित भयो"));
      onClose();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error || t("Failed to save salary components", "सुरक्षित गर्न सकिएन"),
      ),
  });

  const renderRows = (
    rows: ComponentRow[],
    setRows: (rows: ComponentRow[]) => void,
  ) => (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder={t("Name (e.g. Transport)", "नाम (जस्तै: यातायात)")}
            value={row.name}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...row, name: e.target.value };
              setRows(next);
            }}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder={t("Amount", "रकम")}
            value={row.amount}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...row, amount: e.target.value };
              setRows(next);
            }}
            className="w-28"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRows([...rows, { name: "", amount: "" }])}
      >
        <Plus className="h-4 w-4 mr-1" /> {t("Add row", "पङ्क्ति थप्नुहोस्")}
      </Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("Salary Components", "तलब विवरण")} — {payroll.staff_name}
            {payroll.month ? ` (${payroll.month})` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Basic Salary (NPR)", "आधार तलब (रु.)")}</Label>
            <Input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Allowances", "भत्ता")}</Label>
            {renderRows(allowanceRows, setAllowanceRows)}
          </div>
          <div className="space-y-2">
            <Label>{t("Deductions", "कट्टा")}</Label>
            {renderRows(deductionRows, setDeductionRows)}
          </div>
          <div
            className="rounded-lg px-4 py-3 text-sm space-y-1"
            style={{ background: "var(--w11-control-hover)" }}
          >
            <div className="flex justify-between">
              <span style={{ color: "var(--w11-text-secondary)" }}>{t("Gross Salary", "कुल तलब")}</span>
              <span className="font-medium tabular-nums">Rs. {gross.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--w11-text-secondary)" }}>{t("Total Deductions", "कुल कट्टा")}</span>
              <span className="font-medium tabular-nums" style={{ color: "#c42b1c" }}>
                Rs. {deductionsTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{t("Net Pay", "खुद भुक्तानी")}</span>
              <span className="font-bold tabular-nums" style={{ color: "#107c10" }}>
                Rs. {net.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel", "रद्द")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            {t("Save Components", "सुरक्षित गर्नुहोस्")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
