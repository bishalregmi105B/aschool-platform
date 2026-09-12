"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DetailSheet } from "@/components/ui/sheet";
import { PageLoader } from "@/components/ui/spinner";
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

function statusVariant(status: string) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "partial":
      return "warning" as const;
    case "waived":
      return "secondary" as const;
    default:
      return "destructive" as const;
  }
}

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
          <p className="text-xs text-muted-foreground">{i.class_name || "—"}</p>
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
          <p className="text-xs text-muted-foreground">
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
      render: (i) => <Badge variant={statusVariant(i.status)}>{i.status}</Badge>,
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
        <span className="text-green-700">{formatNepaliCurrency(i.paid_amount || 0)}</span>
      ),
    },
    {
      key: "due_amount",
      label: "Due",
      align: "right",
      sortable: true,
      value: (i) => i.due_amount,
      render: (i) => (
        <span className={i.due_amount > 0 ? "font-bold text-red-600" : "text-muted-foreground"}>
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee Invoices</h1>
        <p className="text-muted-foreground">
          Per-student bill documents grouped from fee collections
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Invoices
            <div className="ml-auto flex flex-wrap gap-1">
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
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total", value: detail.total_amount, cls: "" },
                { label: "Paid", value: detail.paid_amount, cls: "text-green-700" },
                { label: "Due", value: detail.due_amount, cls: "text-red-600" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-lg font-bold ${s.cls}`}>
                      {formatNepaliCurrency(s.value || 0)}
                    </p>
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border">
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
                          <p className="text-xs text-muted-foreground">
                            Discount {formatNepaliCurrency(line.discount_amount)}
                          </p>
                        )}
                        {Number(line.late_fine_amount) > 0 && (
                          <p className="text-xs text-red-600">
                            Late fine {formatNepaliCurrency(line.late_fine_amount)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {line.month_bs
                          ? line.month_bs
                          : line.due_date
                            ? displayBS(line.due_date)
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNepaliCurrency(line.net_amount || 0)}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatNepaliCurrency(line.paid_amount || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={line.due_amount > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}>
                          {formatNepaliCurrency(line.due_amount || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(line.status)}>{line.status}</Badge>
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
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!detail.lines?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
