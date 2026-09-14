"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, FilterCommandBar,
  DataPanel, AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { FileText, Download, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { PrintStyles, PrintRegion, PrintTwinButton } from "../print-twin";

interface ReportCard {
  id: string;
  student_name: string;
  student_id: string;
  roll_number: number;
  total_percentage: number;
  overall_grade: string;
  overall_gpa: number;
  rank_in_class: number;
  ai_remarks: string;
  pdf_url: string;
  generated_at: string;
}

const REPORT_CARD_COLUMNS: Column<ReportCard>[] = [
  { key: "rank_in_class", label: "Rank", sortable: true, value: (rc) => rc.rank_in_class, render: (rc) => <>#{rc.rank_in_class}</> },
  {
    key: "student_name",
    label: "Student",
    sortable: true,
    value: (rc) => rc.student_name,
    render: (rc) => (
      <div>
        <span className="font-medium">{rc.student_name}</span>
        <br />
        <span className="text-xs text-[color:var(--w11-text-secondary)]">Roll: {rc.roll_number}</span>
      </div>
    ),
  },
  { key: "total_percentage", label: "Percentage", align: "right", sortable: true, value: (rc) => rc.total_percentage ?? 0, render: (rc) => <>{rc.total_percentage?.toFixed(1)}%</> },
  { key: "overall_grade", label: "Grade", sortable: true, value: (rc) => rc.overall_grade, render: (rc) => <Badge variant="outline">{rc.overall_grade}</Badge> },
  { key: "overall_gpa", label: "GPA", align: "right", sortable: true, value: (rc) => rc.overall_gpa ?? 0, render: (rc) => rc.overall_gpa?.toFixed(1) },
  { key: "ai_remarks", label: "AI Remarks", value: (rc) => rc.ai_remarks ?? "", render: (rc) => <span className="max-w-xs truncate text-sm text-[color:var(--w11-text-secondary)] block">{rc.ai_remarks || "—"}</span> },
  {
    key: "actions",
    label: "Actions",
    noExport: true,
    render: (rc) =>
      rc.pdf_url ? (
        <Button variant="ghost" size="sm" onClick={() => window.open(rc.pdf_url, "_blank")}>
          <Printer className="h-4 w-4" />
        </Button>
      ) : (
        <span className="text-xs text-[color:var(--w11-text-secondary)]">Pending</span>
      ),
  },
];

export default function ReportCardsPage() {
  return (
    <AppGate slug="exams">
      <ReportCardsContent />
    </AppGate>
  );
}

function ReportCardsContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "school_admin";
  // Wave C: exam/class pre-selection is URL state so the hub's
  // "Report Cards" row link (?exam=<id>) lands ready.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const rcPathname = windowRoute?.pathname ?? "/dashboard/exams/report-cards";
  const setRouteFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    navigate(qs ? `${rcPathname}?${qs}` : rcPathname);
  };
  const examId = routeParams.get("exam") || "";
  const classId = routeParams.get("cls") || "";
  const [rcSearch, setRcSearch] = useState("");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  // Deep-link convenience: ?exam=<id> without ?cls= fills the class from the
  // exam itself (same behavior as picking the exam manually).
  useEffect(() => {
    if (!examId || classId) return;
    const chosen = (exams || []).find((e: { id: string; class_id?: string | null }) => e.id === examId);
    if (chosen?.class_id) setRouteFilter({ cls: chosen.class_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, classId, exams]);

  const { data: reportCards, isLoading, isError, refetch } = useQuery({
    queryKey: ["report-cards", examId, classId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/report-cards?class_id=${classId}`);
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!examId && !!classId,
    retry: 1,
  });

  // Wave C: local search actually filters (DataTable's box is display-only).
  const rcNeedle = rcSearch.trim().toLowerCase();
  const rcFiltered = (reportCards || []).filter((rc: ReportCard) =>
    !rcNeedle || `${rc.student_name} ${rc.roll_number} ${rc.overall_grade ?? ""}`.toLowerCase().includes(rcNeedle)
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/exams/${examId}/report-cards`, { class_id: classId });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.data?.download_url) {
        window.open(data.data.download_url, "_blank");
      }
      toast.success("Report cards generated with AI remarks!");
    },
    onError: () => toast.error("Failed to generate report cards"),
  });

  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/exams/${examId}/report-cards/bulk-pdf?class_id=${classId}`, {
        responseType: "blob",
      });
      return res.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_cards_${examId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Downloading bulk report cards");
    },
    onError: () => toast.error("Failed to download"),
  });

  return (
    <AOSPage>
      <PrintStyles />
      <AOSPageHeader
        icon={<FileText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Report Cards", "रिपोर्ट कार्ड")}
        subtitle={t("Generate AI-powered report cards with personalized remarks", "व्यक्तिगत टिप्पणी सहित AI रिपोर्ट कार्ड बनाउनुहोस्")}
        actions={
          <>
            <PrintTwinButton
              title={`Report Cards — ${(exams || []).find((e: { id: string; name: string }) => e.id === examId)?.name || "Exam"}`}
              disabled={!examId || !classId || (reportCards || []).length === 0}
            />
            <Button
              variant="outline"
              onClick={() => bulkDownloadMutation.mutate()}
              disabled={!examId || !classId || bulkDownloadMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" /> {t("Download All PDF", "सबै PDF डाउनलोड")}
            </Button>
          </>
        }
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="space-y-1 w-full md:w-56">
            <Label className="text-xs">Select Exam</Label>
            <Select value={examId} onValueChange={(v) => {
              const chosen = (exams || []).find((e: { id: string; class_id?: string | null }) => e.id === v);
              setRouteFilter(chosen?.class_id && !classId ? { exam: v, cls: chosen.class_id } : { exam: v });
            }}>
              <SelectTrigger><SelectValue placeholder="Choose exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-48">
            <Label className="text-xs">Select Class</Label>
            <Select value={classId} onValueChange={(v) => setRouteFilter({ cls: v })}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-end">
            {isAdmin ? (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!examId || !classId || generateMutation.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generateMutation.isPending ? "Generating..." : "Generate with AI"}
              </Button>
            ) : (
              <p className="text-xs pb-2 text-[color:var(--w11-text-secondary)]">Only admins can generate report cards</p>
            )}
          </div>
        </FilterCommandBar>

        {examId && classId && (
          <DataPanel title={`Report Cards (${(reportCards || []).length})`} bodyClassName="p-0">
            {isError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-[#c42b1c]">Failed to load report cards. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <PageLoader />
            ) : (reportCards || []).length === 0 ? (
              <AOSEmptyState
                icon={<FileText className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
                title="No report cards generated yet."
                description='Click "Generate with AI" to create report cards with personalized remarks.'
                action={
                  <a href="/dashboard/exams" className="win11-btn" style={{ textDecoration: "none" }}>
                    Create an exam and enter marks — परीक्षा सिर्जना गर्नुहोस्
                  </a>
                }
              />
            ) : (
              <PrintRegion>
                <div className="hidden print:block px-4 pt-3">
                  <p className="font-bold text-lg">Report Cards — {(exams || []).find((e: { id: string; name: string }) => e.id === examId)?.name || "Exam"} ({(classes || []).find((c: { id: string; name: string }) => c.id === classId)?.name || ""})</p>
                </div>
                <DataTable
                  columns={REPORT_CARD_COLUMNS}
                  rows={rcFiltered}
                  rowKey={(rc: ReportCard) => rc.id}
                  searchable
                  searchValue={rcSearch}
                  onSearchChange={setRcSearch}
                  searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
                  exportFileName="report-cards"
                />
              </PrintRegion>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
