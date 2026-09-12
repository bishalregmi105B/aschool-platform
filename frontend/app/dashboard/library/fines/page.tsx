"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Banknote } from "lucide-react";

interface Fine {
  id: string;
  issue_id: string | null;
  book_title: string | null;
  student_id: string;
  student_name: string;
  reason: string;
  amount: number;
  status: string;
  paid_amount: number;
  paid_via: string | null;
}

export default function FinesPage() {
  return <PluginGate slug="library"><FinesContent /></PluginGate>;
}

function FinesContent() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("unpaid");
  const [payFine, setPayFine] = useState<Fine | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library-fines", status],
    queryFn: async () => {
      const r = await api.get("/library/fines", { params: { status } });
      return r.data?.data as { fines: Fine[]; totals: Record<string, number> };
    },
    retry: 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["library-fines"] });

  const pay = useMutation({
    mutationFn: async () =>
      (await api.post(`/library/fines/${payFine!.id}/pay`, {
        amount: Number(payAmount) || undefined, method: payMethod,
      })).data,
    onSuccess: () => {
      invalidate();
      setPayFine(null);
      toast.success("Fine payment recorded");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Payment failed"),
  });

  const waive = useMutation({
    mutationFn: async (fine: Fine) =>
      (await api.post(`/library/fines/${fine.id}/waive`, {
        reason: window.prompt(`Waiver reason for ${fine.student_name}'s Rs ${fine.amount} fine?`) || "",
      })).data,
    onSuccess: () => { invalidate(); toast.success("Fine waived"); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Waiver failed"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading fines…" />;
  const fines = data?.fines || [];
  const totals = data?.totals || {};

  const COLUMNS: Column<Fine>[] = [
    { key: "student", label: "Student", sortable: true, value: (f) => f.student_name, render: (f) => (
      <span className="font-medium">{f.student_name || "—"}</span>
    ) },
    { key: "book", label: "Book", sortable: true, value: (f) => f.book_title ?? "", render: (f) => f.book_title || "—" },
    { key: "reason", label: "Reason", sortable: true, value: (f) => f.reason, render: (f) => (
      <span className={`win11-chip ${f.reason === "lost" ? "error" : "subtle"}`}>{f.reason}</span>
    ) },
    { key: "amount", label: "Amount", align: "right", sortable: true, value: (f) => f.amount,
      render: (f) => <span className="font-medium">Rs {f.amount.toFixed(2)}</span> },
    { key: "status", label: "Status", sortable: true, value: (f) => f.status, render: (f) => (
      <StatusChip
        status={f.status === "unpaid" ? "overdue" : f.status}
        label={f.status}
      />
    ) },
    { key: "actions", label: "Actions", noExport: true, render: (f) => (
      f.status === "unpaid" || f.status === "partial" ? (
        <div className="flex gap-1">
          <Button size="sm" onClick={(e) => {
            e.stopPropagation();
            setPayFine(f);
            setPayAmount(String(f.amount - f.paid_amount));
          }}><Banknote className="h-3 w-3 mr-1" /> Pay</Button>
          <Button size="sm" variant="outline" disabled={waive.isPending}
            onClick={(e) => { e.stopPropagation(); waive.mutate(f); }}>Waive</Button>
        </div>
      ) : null
    ) },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Banknote className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Fines"
        subtitle={`Library fines ledger — ${fines.length} ${status} ${fines.length === 1 ? "record" : "records"}${totals[status] ? ` · Rs ${Number(totals[status]).toFixed(0)}` : ""}`}
      />
      <AOSPageBody>
        <FilterCommandBar>
          {["unpaid", "partial", "paid", "waived"].map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s} {totals[s] ? `· Rs ${Number(totals[s]).toFixed(0)}` : ""}
            </Button>
          ))}
        </FilterCommandBar>

        {isError ? (
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load fines.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable<Fine>
              columns={COLUMNS}
              rows={fines}
              rowKey={(f) => f.id}
              searchable
              searchPlaceholder="Search student or book…"
              exportFileName="library-fines"
            />
          </DataPanel>
        )}

        <Dialog open={!!payFine} onOpenChange={(o) => !o && setPayFine(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Collect fine</DialogTitle></DialogHeader>
            {payFine && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  {payFine.student_name} — {payFine.book_title} ({payFine.reason})
                </p>
                <div className="space-y-1.5">
                  <Label>Amount (Rs)</Label>
                  <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <select
                    className="w-full rounded-md border border-[var(--w11-control-border)] px-3 py-2 text-sm"
                    style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-primary)" }}
                    value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="fonepay">FonePay</option>
                    <option value="voucher">Voucher</option>
                  </select>
                </div>
                <Button className="w-full" disabled={pay.isPending} onClick={() => pay.mutate()}>
                  Record payment
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
