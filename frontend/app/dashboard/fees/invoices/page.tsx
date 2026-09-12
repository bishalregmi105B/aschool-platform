"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DetailSheet } from "@/components/ui/sheet";
import {
  AOSPage, AOSPageHeader, AOSPageBody, FilterCommandBar,
  DataPanel, StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Loader2, Receipt } from "lucide-react";
import { displayBS, formatNepaliDate } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface InvoiceLine {
  id: string;
  fee_type: string;
  base_amount: number;
  late_fine_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  month_bs: string | null;
  due_date: string | null;
  receipt_number: string | null;
  receipt_id: string | null;
  receipt_url: string | null;
}

interface Invoice {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  title: string;
  academic_year: string | null;
  period_key: string | null;
  due_date_bs: string | null;
  status: "pending" | "partial" | "paid" | "waived";
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  line_count: number;
  created_at: string | null;
  lines?: InvoiceLine[];
}

interface InvoiceListPayload {
  invoices: Invoice[];
  meta: { total: number; page: number; per_page: number; pages: number; has_next: boolean; has_prev: boolean };
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
] as const;

export default function FeeInvoicesPage() {
  return (
    <PluginGate slug="fees">
      <InvoicesContent />
    </PluginGate>
  );
}

function InvoicesContent() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fee-invoices", status, page],
    retry: 1,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (status) params.set("status", status);
      const r = await api.get(`/fees/invoices?${params.toString()}`);
      return r.data?.data as InvoiceListPayload | null;
    },
  });

  // Detail sheet fetches the invoice with its lines.
  const { data: detail, isLoading: detailLoading } = useQuery({
    enabled: Boolean(activeId),
    queryKey: ["fee-invoice", activeId],
    retry: 1,
    queryFn: async () => {
      const r = await api.get(`/fees/invoices/${activeId}`);
      return (r.data?.data?.invoice as Invoice) ?? null;
    },
  });

  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const meta = data?.meta;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.student_name?.toLowerCase().includes(q) ||
        i.title?.toLowerCase().includes(q) ||
        i.class_name?.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const downloadReceipt = async (line: InvoiceLine) => {
    if (!line.receipt_id) return;
    setDownloadingId(line.id);
    try {
      const response = await api.get(`/fees/receipts/${line.receipt_id}/pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt_${line.receipt_number || line.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download receipt");
    } finally {
      setDownloadingId(null);
    }
  };

  const COLUMNS: Column<Invoice>[] = [
    {
      key: "student_name",
      label: "Student",
      sortable: true,
      value: (i) => i.student_name || "",
      render: (i) => (
        <div>
          <p className="font-medium">{i.student_name}</p>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">{i.class_name || "—"}</p>
        </div>
      ),
    },
    {
      key: "title",
      label: "Invoice",
      sortable: true,
      value: (i) => i.title || "",
      render: (i) => (
        <div>
          <p>{i.title}</p>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">
            {i.academic_year || "—"}
            {i.period_key ? ` • ${i.period_key}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "due_date_bs",
      label: "Due Date (BS)",
      sortable: true,
      value: (i) => i.due_date_bs ?? "",
      render: (i) => (i.due_date_bs ? formatNepaliDate(i.due_date_bs) : "—"),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (i) => i.status,
      render: (i) => <StatusChip status={i.status} />,
    },
    {
      key: "total_amount",
      label: "Total",
      align: "right",
      sortable: true,
      value: (i) => i.total_amount,
      render: (i) => formatNepaliCurrency(i.total_amount || 0),
    },
    {
      key: "paid_amount",
      label: "Paid",
      align: "right",
      sortable: true,
      value: (i) => i.paid_amount,
      render: (i) => (
        <span style={{ color: "#107c10" }}>{formatNepaliCurrency(i.paid_amount || 0)}</span>
      ),
    },
    {
      key: "due_amount",
      label: "Due",
      align: "right",
      sortable: true,
      value: (i) => i.due_amount,
      render: (i) => (
        <span
          className={i.due_amount > 0 ? "font-bold" : "text-[color:var(--w11-text-secondary)]"}
          style={i.due_amount > 0 ? { color: "#c42b1c" } : undefined}
        >
          {formatNepaliCurrency(i.due_amount || 0)}
        </span>
      ),
    },
    {
      key: "line_count",
      label: "Lines",
      align: "center",
      value: (i) => i.line_count ?? 0,
    },
  ];

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading invoices…" /></AOSPage>;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Fee Invoices"
        subtitle={`Per-student bill documents grouped from fee collections${meta ? ` · ${meta.total} invoices` : ""}`}
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={status === f.value ? "default" : "outline"}
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </FilterCommandBar>

        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Invoices
            </span>
          }
        >
          <DataTable<Invoice>
            columns={COLUMNS}
            rows={filtered}
            rowKey={(i) => i.id}
            loading={isLoading}
            error={isError ? "Failed to load invoices." : null}
            onRetry={() => refetch()}
            pagination={
              meta
                ? {
                    total: meta.total,
                    page: meta.page,
                    per_page: meta.per_page,
                    pages: meta.pages,
                    has_next: meta.has_next,
                    has_prev: meta.has_prev,
                  }
                : undefined
            }
            onPageChange={setPage}
            searchable
            searchValue={search}
            onSearchChange={(v) => setSearch(v)}
            searchPlaceholder="Search students…"
            onRowClick={(i) => setActiveId(i.id)}
            activeRowKey={activeId}
            exportFileName="fee-invoices"
            empty={{
              icon: Receipt,
              title: "No invoices found",
              body: "Invoices are created automatically when fee structures are applied to students.",
            }}
          />
        </DataPanel>

        <DetailSheet
          open={Boolean(activeId)}
          onOpenChange={(open) => !open && setActiveId(null)}
          title={detail?.student_name || "Invoice"}
          subtitle={
            detail
              ? `${detail.title} • ${detail.academic_year || ""}${
                detail.due_date_bs ? ` • Due ${formatNepaliDate(detail.due_date_bs)}` : ""
              }`
              : undefined
          }
          size="lg"
        >
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: detail.total_amount, color: "var(--w11-text-primary)" },
                  { label: "Paid", value: detail.paid_amount, color: "#107c10" },
                  { label: "Due", value: detail.due_amount, color: "#c42b1c" },
                ].map((s) => (
                  <div key={s.label} className="win11-card pt-4 pb-3 px-4">
                    <p className="text-xs text-[color:var(--w11-text-secondary)]">{s.label}</p>
                    <p className="text-lg font-bold" style={{ color: s.color }}>
                      {formatNepaliCurrency(s.value || 0)}
                    </p>
                  </div>
                ))}
                <div className="win11-card pt-4 pb-3 px-4">
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">Status</p>
                  <div className="mt-1">
                    <StatusChip status={detail.status} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--w11-border-subtle)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee Item</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.lines ?? []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium">{line.fee_type}</p>
                          {Number(line.discount_amount) > 0 && (
                            <p className="text-xs text-[color:var(--w11-text-secondary)]">
                              Discount {formatNepaliCurrency(line.discount_amount)}
                            </p>
                          )}
                          {Number(line.late_fine_amount) > 0 && (
                            <p className="text-xs" style={{ color: "#c42b1c" }}>
                              Late fine {formatNepaliCurrency(line.late_fine_amount)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[color:var(--w11-text-secondary)]">
                          {line.month_bs
                            ? line.month_bs
                            : line.due_date
                              ? displayBS(line.due_date)
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNepaliCurrency(line.net_amount || 0)}
                        </TableCell>
                        <TableCell className="text-right" style={{ color: "#107c10" }}>
                          {formatNepaliCurrency(line.paid_amount || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={line.due_amount > 0 ? "font-semibold" : "text-[color:var(--w11-text-secondary)]"}
                            style={line.due_amount > 0 ? { color: "#c42b1c" } : undefined}
                          >
                            {formatNepaliCurrency(line.due_amount || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={line.status} />
                        </TableCell>
                        <TableCell>
                          {line.receipt_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              disabled={downloadingId === line.id}
                              onClick={() => downloadReceipt(line)}
                            >
                              {downloadingId === line.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              {line.receipt_number || "PDF"}
                            </Button>
                          ) : (
                            <span className="text-xs text-[color:var(--w11-text-secondary)]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!detail.lines?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-[color:var(--w11-text-secondary)]">
                          No fee lines on this invoice.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DetailSheet>
      </AOSPageBody>
    </AOSPage>
  );
}
