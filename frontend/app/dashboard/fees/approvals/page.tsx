"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, FilterCommandBar,
  DataPanel, StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  XCircle,
} from "lucide-react";
import { getFile } from "@/lib/services/files.service";
import { formatNepaliDate } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { useI18n } from "@/lib/i18n";

interface OfflineSubmission {
  id: string;
  student_id: string;
  student_name: string;
  amount: number;
  method: "bank" | "cheque";
  bank_name: string | null;
  reference_no: string | null;
  paid_on_bs: string | null;
  slip_file_id: string | null;
  collection_ids: string[];
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  receipt_ids: string[];
  created_at: string | null;
}

interface SubmissionListPayload {
  submissions: OfflineSubmission[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

const STATUS_FILTERS: Array<{ value: string; label: string; ne: string }> = [
  { value: "pending", label: "Pending", ne: "बाँकी" },
  { value: "approved", label: "Approved", ne: "स्वीकृत" },
  { value: "rejected", label: "Rejected", ne: "अस्वीकृत" },
];

/** Opens the uploaded slip (ManagedFile) in a new tab via its stored URL. */
function SlipLink({ fileId }: { fileId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const file = await getFile(fileId);
      if (file?.url) {
        window.open(file.url, "_blank", "noopener");
      } else {
        toast.error(t("Slip file is unavailable", "स्लिप फाइल उपलब्ध छेन"));
      }
    } catch {
      toast.error(t("Could not open slip file", "स्लिप खोल्न सकिएन"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={loading} onClick={open}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
      {t("Slip", "स्लिप")}
    </Button>
  );
}

export default function FeeApprovalsPage() {
  return (
    <PluginGate slug="fees">
      <ApprovalsContent />
    </PluginGate>
  );
}

function ApprovalsContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { values: urlFilters, setValues: setUrlFilters } = useUrlFilters(["status", "page"]);
  const status = urlFilters.status || "pending";
  const page = Number(urlFilters.page) || 1;
  const setStatus = (v: string) => setUrlFilters({ status: v === "pending" ? "" : v });
  const setPage = (n: number) => setUrlFilters({ page: n === 1 ? "" : String(n) });
  const [reviewTarget, setReviewTarget] = useState<{ sub: OfflineSubmission; mode: "approve" | "reject" } | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fee-offline-submissions", status, page],
    retry: 1,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (status) params.set("status", status);
      const r = await api.get(`/fees/offline-submissions?${params.toString()}`);
      return r.data?.data as SubmissionListPayload | null;
    },
  });

  const review = useMutation({
    mutationFn: async ({ sub, mode, reviewNotes }: { sub: OfflineSubmission; mode: "approve" | "reject"; reviewNotes: string }) => {
      const body: Record<string, string> = {};
      if (reviewNotes.trim()) body.review_notes = reviewNotes.trim();
      const r = await api.post(`/fees/offline-submissions/${sub.id}/${mode}`, body);
      return r.data?.data;
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fee-offline-submissions"] });
      setReviewTarget(null);
      setNotes("");
      if (vars.mode === "approve") {
        const allocated = Number(res?.allocated_amount || 0);
        toast.success(
          `Slip approved — ${formatNepaliCurrency(allocated)} allocated, ${res?.receipt_ids?.length || 0} receipt(s) issued.`,
        );
      } else {
        toast.success("Submission rejected");
      }
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.error || error?.message || "Review action failed"),
  });

  const submissions = data?.submissions ?? [];
  const meta = data?.meta;
  const pendingCount = status === "pending" ? meta?.total ?? 0 : undefined;

  const COLUMNS: Column<OfflineSubmission>[] = [
    {
      key: "student_name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (s) => s.student_name || "",
      render: (s) => <span className="font-medium">{s.student_name}</span>,
    },
    {
      key: "amount",
      label: t("Amount", "रकम"),
      align: "right",
      sortable: true,
      value: (s) => s.amount,
      render: (s) => <span className="font-bold">{formatNepaliCurrency(s.amount || 0)}</span>,
    },
    {
      key: "method",
      label: t("Method", "माध्यम"),
      sortable: true,
      value: (s) => s.method,
      render: (s) => (
        <Badge variant="outline">
          {s.method === "bank" ? t("Bank Transfer", "बैँक रासि") : t("Cheque", "चेक")}
        </Badge>
      ),
    },
    {
      key: "details",
      label: t("Details", "विवरण"),
      value: (s) => `${s.bank_name ?? ""} ${s.reference_no ?? ""}`,
      render: (s) => (
        <div className="text-sm">
          {s.bank_name && <p>{s.bank_name}</p>}
          {s.reference_no && <p className="text-xs text-[color:var(--w11-text-secondary)]">Ref: {s.reference_no}</p>}
          {!s.bank_name && !s.reference_no && <span className="text-[color:var(--w11-text-secondary)]">—</span>}
        </div>
      ),
    },
    {
      key: "paid_on_bs",
      label: t("Paid On (BS)", "भुक्तमिति"),
      sortable: true,
      value: (s) => s.paid_on_bs ?? "",
      render: (s) => (s.paid_on_bs ? formatNepaliDate(s.paid_on_bs) : "—"),
    },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (s) => s.status,
      render: (s) => <StatusChip status={s.status} />,
    },
    {
      key: "notes",
      label: t("Review Notes", "टिप्पणी"),
      hidden: true,
      value: (s) => s.review_notes ?? "",
      render: (s) => <span className="text-xs text-[color:var(--w11-text-secondary)]">{s.review_notes || "—"}</span>,
    },
    {
      key: "slip",
      label: t("Slip", "स्लिप"),
      noExport: true,
      render: (s) =>
        s.slip_file_id ? (
          <SlipLink fileId={s.slip_file_id} />
        ) : (
          <span className="text-xs text-[color:var(--w11-text-secondary)]">{t("No file", "फाइल छेन")}</span>
        ),
    },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (s) =>
        s.status === "pending" ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setNotes("");
                setReviewTarget({ sub: s, mode: "approve" });
              }}
            >
              <CheckCircle2 className="h-3 w-3" /> {t("Approve", "स्वीकार")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setNotes("");
                setReviewTarget({ sub: s, mode: "reject" });
              }}
            >
              <XCircle className="h-3 w-3" /> {t("Reject", "अस्वीकार")}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-[color:var(--w11-text-secondary)]">
            {s.status === "approved" ? `${s.receipt_ids?.length || 0} ${t("receipt(s)", "रसिद(मा)")}` : "—"}
          </span>
        ),
    },
  ];

  if (isLoading) return <AOSPage><AOSModuleLoadingState label="Loading submissions…" /></AOSPage>;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<FileCheck2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Slip Approvals", "स्लिप स्वीकृति")}
        subtitle={
          pendingCount !== undefined && pendingCount > 0
            ? t(`${pendingCount} awaiting review`, `${pendingCount} स्वीकृति को कर्ने`)
            : t("Review offline bank-transfer and cheque submissions before money is applied", "नगद/बैँक स्लिप समीक्षा गैरेपछन्चनपूर्व जाँच गर्नुहोस")
        }
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
                {t(f.label, f.ne)}
              </Button>
            ))}
          </div>
        </FilterCommandBar>

        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" /> {t("Submission Queue", "बेनश")}&#32;
              {pendingCount !== undefined && pendingCount > 0 && (
                <Badge variant="warning">{pendingCount} {t("awaiting review", "कर्ने")}</Badge>
              )}
            </span>
          }
        >
          <DataTable<OfflineSubmission>
            columns={COLUMNS}
            rows={submissions}
            rowKey={(s) => s.id}
            loading={isLoading}
            error={isError ? t("Failed to load submissions.", "बेनलोड सकिएन।") : null}
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
            exportFileName="fee-offline-submissions"
            dense
            empty={{
              icon: FileCheck2,
              title: status === "pending" ? t("Nothing awaiting review", "कुनै कर्ने छेन") : t("No submissions", "बेन छेन"),
              body: t("Offline slips submitted by parents and students will appear here.", "अभिभावकले प्रेरेक स्लिप यहाँ देखिएन।"),
            }}
          />
        </DataPanel>

        <Dialog
          open={Boolean(reviewTarget)}
          onOpenChange={(open) => !open && setReviewTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewTarget?.mode === "approve" ? t("Approve Submission", "बेन स्वीकार गर्नु") : t("Reject Submission", "बेन अस्वीकार गर्नु")}
              </DialogTitle>
            </DialogHeader>
            {reviewTarget && (
              <div className="space-y-4">
                <div
                  className="rounded-lg border border-[var(--w11-border-subtle)] px-3 py-2 text-sm"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  <p className="font-medium">{reviewTarget.sub.student_name}</p>
                  <p className="text-[color:var(--w11-text-secondary)]">
                    {formatNepaliCurrency(reviewTarget.sub.amount || 0)} •{" "}
                    {reviewTarget.sub.method === "bank" ? t("Bank Transfer", "बैँक रासि") : t("Cheque", "चेक")}
                    {reviewTarget.sub.paid_on_bs
                      ? ` • Paid ${formatNepaliDate(reviewTarget.sub.paid_on_bs)}`
                      : ""}
                    {reviewTarget.sub.reference_no ? ` • Ref ${reviewTarget.sub.reference_no}` : ""}
                  </p>
                </div>
                {reviewTarget.mode === "approve" && (
                  <p className="text-sm text-[color:var(--w11-text-secondary)]">
                    {t("Approving records the payment through the standard collection flow — receipts are issued and the referenced bills are settled FIFO.", "स्वीकार गर्दा मजबुट लगान्छर, रसिद बन्चार र बिजक FIFO मिट्छन।")}
                  </p>
                )}
                <div className="space-y-2">
                  <Label>{t("Review Notes (optional)", "टिप्पणी (वैकल्पिक)")}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      reviewTarget.mode === "approve"
                        ? t("e.g. Verified against bank statement", "जस्ताई: बैँक स्टेटमेन्टबाट मिल्य")
                        : t("e.g. Reference number not found in bank statement", "जस्ताई: रेफरन्स नंबर बैँक स्टेटमेन्टमा बेटिएन")
                    }
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={review.isPending}>
                {t("Cancel", "रद्द")}
              </Button>
              {reviewTarget?.mode === "approve" ? (
                <Button
                  onClick={() => review.mutate({ sub: reviewTarget.sub, mode: "approve", reviewNotes: notes })}
                  disabled={review.isPending}
                >
                  {review.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {t("Approve & Record Payment", "स्वीकार गरी भुक्तान लगाउन")}
                </Button>
              ) : (
                reviewTarget && (
                  <Button
                    variant="destructive"
                    onClick={() => review.mutate({ sub: reviewTarget.sub, mode: "reject", reviewNotes: notes })}
                    disabled={review.isPending}
                  >
                    {review.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    {t("Reject Submission", "अस्वीकार")}
                  </Button>
                )
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
