"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
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
  allowances_total?: number;
  deductions: number;
  deductions_total?: number;
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

export default function PayrollPage() {
  return (
    <PluginGate slug="hr">
      <PayrollContent />
    </PluginGate>
  );
}

function PayrollContent() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [editing, setEditing] = useState<PayrollRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Bulk actions wait behind a confirm dialog — approving/paying dozens of
  // rows is not reversible, so the toolbar buttons stage the request here
  // and only the dialog's "Confirm" button dispatches it.
  const [pendingBulk, setPendingBulk] = useState<{
    action: "approve" | "mark_paid";
    count: number;
  } | null>(null);

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

  const draftSelected = payroll.filter(
    (p) => p.status === "draft" && selectedIds.includes(p.id),
  );
  const approvedSelected = payroll.filter(
    (p) => p.status === "approved" && selectedIds.includes(p.id),
  );

  const toggleAll = (checked: boolean) =>
    setSelectedIds(checked ? payroll.map((p) => p.id) : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((rowId) => rowId !== id),
    );

  const generate = useMutation({
    mutationFn: async () =>
      (await api.post("/hr/payroll/generate", { month })).data,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      const created = res?.data?.created ?? 0;
      toast.success(
        created > 0
          ? `Payroll generated for ${created} staff member${created === 1 ? "" : "s"}. Edit each row to set salary components.`
          : "All staff already have payroll records for this month.",
      );
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error || "Failed to generate payroll",
      ),
  });

  const bulkAction = useMutation({
    mutationFn: async ({
      action,
      ids,
    }: {
      action: "approve" | "mark_paid";
      ids: string[];
    }) =>
      (
        await api.post("/hr/payroll/bulk-action", {
          action,
          month,
          ids,
        })
      ).data,
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setSelectedIds([]);
      const updated = res?.data?.updated ?? 0;
      const skipped = res?.data?.skipped ?? 0;
      toast.success(
        `${vars.action === "approve" ? "Approved" : "Marked paid"} ${updated} payroll record${updated === 1 ? "" : "s"}` +
          (skipped > 0 ? ` — ${skipped} skipped (wrong status)` : ""),
      );
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error || "Bulk action failed"),
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Payroll Management" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>
                Failed to load payroll records. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isLoading) return <AOSModuleLoadingState label="Loading payroll…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Wallet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Payroll Management"
        subtitle={`Monthly salary processing and payslips · ${month}`}
        actions={
          <input
            type="month"
            className="win11-select border rounded-md px-3 py-2"
            style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)" }}
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelectedIds([]);
            }}
          />
        }
      />
      <AOSPageBody>
        <StatGrid min={180}>
          <KpiCard
            label="Total Staff"
            value={payroll.length || summary.total_staff || 0}
            icon={<DollarSign className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label="Gross Salary"
            value={`Rs. ${(
              summary.gross_total ||
              payroll.reduce(
                (s: number, p: any) => s + (p.gross_salary || 0),
                0,
              )
            ).toLocaleString()}`}
          />
          <KpiCard
            label="Deductions"
            value={`Rs. ${(
              summary.total_deductions ||
              payroll.reduce(
                (s: number, p: any) => s + (p.deductions || 0),
                0,
              )
            ).toLocaleString()}`}
            color="#c42b1c"
          />
          <KpiCard
            label="Net Pay"
            value={`Rs. ${(
              summary.net_total ||
              payroll.reduce(
                (s: number, p: any) => s + (p.net_salary || 0),
                0,
              )
            ).toLocaleString()}`}
            color="#107c10"
          />
        </StatGrid>

        <FilterCommandBar>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Spinner className="mr-2" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}{" "}
            Generate Payroll
          </Button>
          {draftSelected.length > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                setPendingBulk({ action: "approve", count: draftSelected.length })
              }
              disabled={bulkAction.isPending}
            >
              {bulkAction.isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" style={{ color: "#107c10" }} />
              )}
              Approve selected ({draftSelected.length})
            </Button>
          )}
          {approvedSelected.length > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                setPendingBulk({
                  action: "mark_paid",
                  count: approvedSelected.length,
                })
              }
              disabled={bulkAction.isPending}
            >
              {bulkAction.isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Wallet className="h-4 w-4 mr-2" style={{ color: "var(--w11-accent)" }} />
              )}
              Mark selected paid ({approvedSelected.length})
            </Button>
          )}
        </FilterCommandBar>

        <Dialog
          open={!!pendingBulk}
          onOpenChange={(open) => !open && setPendingBulk(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingBulk?.action === "approve"
                  ? "Approve payroll records"
                  : "Mark payroll records as paid"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              {pendingBulk?.action === "approve"
                ? `You are about to approve ${pendingBulk?.count} payroll record${pendingBulk?.count === 1 ? "" : "s"} for ${month}. Approved records unlock payment.`
                : `You are about to mark ${pendingBulk?.count} payroll record${pendingBulk?.count === 1 ? "" : "s"} for ${month} as paid. Only approved records are affected; this records the payment date.`}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingBulk(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!pendingBulk) return;
                  bulkAction.mutate({
                    action: pendingBulk.action,
                    ids:
                      pendingBulk.action === "approve"
                        ? draftSelected.map((p) => p.id)
                        : approvedSelected.map((p) => p.id),
                  });
                  setPendingBulk(null);
                }}
                disabled={bulkAction.isPending}
              >
                {bulkAction.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      payroll.length > 0 &&
                      payroll.every((p) => selectedIds.includes(p.id))
                    }
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all payroll rows"
                  />
                </TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead className="font-bold">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    No payroll data. Click Generate Payroll.
                  </TableCell>
                </TableRow>
              ) : (
                payroll.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={(checked) =>
                          toggleOne(p.id, checked === true)
                        }
                        aria-label={`Select ${p.staff_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.staff_name}
                    </TableCell>
                    <TableCell>
                      Rs. {(p.basic_salary || 0).toLocaleString()}
                    </TableCell>
                    <TableCell style={{ color: "#107c10" }}>
                      Rs. {(p.allowances || 0).toLocaleString()}
                    </TableCell>
                    <TableCell style={{ color: "#c42b1c" }}>
                      Rs. {(p.deductions || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-bold text-base">
                      Rs. {(p.net_salary || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={p.status || "draft"} className="capitalize" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* E123: component editor — set basic salary,
                            allowances and deductions before approving */}
                        {p.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit salary components"
                            onClick={() => setEditing(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Payslip PDF Download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Payslip"
                          onClick={async () => {
                            try {
                              const res = await api.get(
                                `/hr/payroll/${p.id}/payslip`,
                                { responseType: "blob" },
                              );
                              const url = URL.createObjectURL(
                                new Blob([res.data], {
                                  type: "application/pdf",
                                }),
                              );
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `payslip_${p.staff_name}_${month}.pdf`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error("Failed to download payslip");
                            }
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {/* Approve */}
                        {p.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Approve"
                            onClick={async () => {
                              try {
                                await api.post(`/hr/payroll/${p.id}/approve`);
                                queryClient.invalidateQueries({
                                  queryKey: ["payroll"],
                                });
                                toast.success("Payroll approved");
                              } catch {
                                toast.error("Failed to approve");
                              }
                            }}
                          >
                            <CheckCircle className="h-4 w-4" style={{ color: "#107c10" }} />
                          </Button>
                        )}
                        {/* Mark Paid */}
                        {p.status === "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Mark as Paid"
                            onClick={async () => {
                              try {
                                await api.post(`/hr/payroll/${p.id}/pay`, {
                                  payment_method: "bank",
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["payroll"],
                                });
                                toast.success("Marked as paid");
                              } catch {
                                toast.error("Failed to mark as paid");
                              }
                            }}
                          >
                            <Wallet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataPanel>

        {editing ? (
          <EditComponentsDialog
            payroll={editing}
            onClose={() => setEditing(null)}
          />
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
      toast.success(`Salary components saved for ${payroll.staff_name}`);
      onClose();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error || "Failed to save salary components",
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
            placeholder="Name (e.g. Transport)"
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
            placeholder="Amount"
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
        <Plus className="h-4 w-4 mr-1" /> Add row
      </Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Salary Components — {payroll.staff_name}
            {payroll.month ? ` (${payroll.month})` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Basic Salary (NPR)</Label>
            <Input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Allowances</Label>
            {renderRows(allowanceRows, setAllowanceRows)}
          </div>
          <div className="space-y-2">
            <Label>Deductions</Label>
            {renderRows(deductionRows, setDeductionRows)}
          </div>
          <div
            className="rounded-lg px-4 py-3 text-sm space-y-1"
            style={{ background: "var(--w11-control-hover)" }}
          >
            <div className="flex justify-between">
              <span style={{ color: "var(--w11-text-secondary)" }}>Gross Salary</span>
              <span className="font-medium">Rs. {gross.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--w11-text-secondary)" }}>Total Deductions</span>
              <span className="font-medium" style={{ color: "#c42b1c" }}>
                Rs. {deductionsTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Net Pay</span>
              <span className="font-bold" style={{ color: "#107c10" }}>
                Rs. {net.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            Save Components
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
