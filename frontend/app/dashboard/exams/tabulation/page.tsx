"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  AOSPage, AOSPageHeader, AOSPageBody, FilterCommandBar,
  DataPanel, StatusChip, AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Table2, Trophy, Printer, GraduationCap,
} from "lucide-react";

// ── Types (GET /exams/<id>/tabulation and /merit-list) ──────────────────────
interface TabulationSubjectCell {
  subject_id: string;
  subject_name: string;
  obtained: number;
  full_marks: number;
  grade: string;
  gpa: number;
  entered: boolean;
  is_absent: boolean;
}

interface TabulationRow {
  student_id: string;
  student_name: string;
  roll_number: number;
  subjects: TabulationSubjectCell[];
  total_obtained: number;
  total_full: number;
  percentage: number;
  gpa: number;
  result: string;
  merit_order: number;
}

interface TabulationPayload {
  exam: { id: string; name: string; exam_type: string };
  subjects: Array<{ id: string; name: string }>;
  rows: TabulationRow[];
  grade_chart: Array<{ grade_name: string; gpa: number; percent_from: number }>;
}

interface MeritRow {
  merit_order: number;
  student_name: string;
  roll_number: number;
  gpa: number;
  percentage: number;
  total_obtained: number;
  total_full: number;
  result: string;
}

export default function TabulationPage() {
  return (
    <PluginGate slug="exams">
      <TabulationContent />
    </PluginGate>
  );
}

type ActiveTab = "sheet" | "merit";

/** Tabulation result ("PASS"/"NG") → StatusChip tone key. */
const RESULT_TONE: Record<string, string> = {
  pass: "pass",
  ng: "fail",
};

function TabulationContent() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("sheet");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams?per_page=200");
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

  const selectedClass = (classes || []).find((c: { id: string; sections?: Array<{ id: string; name: string }> }) => c.id === classId);
  const sections = selectedClass?.sections || [];

  const isReady = !!examId && !!classId;
  const sectionParam = sectionId !== "all" ? `&section_id=${sectionId}` : "";

  const tabulation = useQuery({
    queryKey: ["tabulation", examId, classId, sectionId],
    queryFn: async () => {
      const res = await api.get(
        `/exams/${examId}/tabulation?class_id=${classId}${sectionParam}`,
      );
      return res.data?.data as TabulationPayload | null;
    },
    enabled: isReady && activeTab === "sheet",
    retry: 1,
  });

  const merit = useQuery({
    queryKey: ["merit-list", examId, classId, sectionId],
    queryFn: async () => {
      const res = await api.get(
        `/exams/${examId}/merit-list?class_id=${classId}${sectionParam}`,
      );
      return res.data?.data as { exam: TabulationPayload["exam"]; rows: MeritRow[] } | null;
    },
    enabled: isReady && activeTab === "merit",
    retry: 1,
  });

  /** Print twin: fetch the server-rendered HTML (auth via session cookies)
   *  and write it into a new tab — same flow as the marksheet previews. */
  const openPrint = async (kind: "tabulation" | "merit-list") => {
    if (!isReady) return;
    try {
      const res = await api.get(
        `/exams/${examId}/${kind}?class_id=${classId}${sectionParam}&format=print`,
        { responseType: "text", transformResponse: [(d) => d] },
      );
      const html = typeof res.data === "string" ? res.data : "";
      if (!html) {
        toast.error("No printable content returned");
        return;
      }
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
      } else {
        toast.error("Popup blocked — allow popups for this site");
      }
    } catch {
      toast.error("Failed to open the print view");
    }
  };

  const payload = tabulation.data;
  const gradeChart = payload?.grade_chart || [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Table2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Tabulation Sheet"
        subtitle="Students × subjects grid with totals, GPA, result and merit order"
        actions={
          <Button
            variant="outline"
            disabled={!isReady || (activeTab === "sheet" ? !payload?.rows?.length : !merit.data?.rows?.length)}
            onClick={() => openPrint(activeTab === "sheet" ? "tabulation" : "merit-list")}
          >
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        {/* Pickers */}
        <FilterCommandBar>
          <div className="space-y-1 w-full md:w-56">
            <Label className="text-xs">Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-48">
            <Label className="text-xs">Class</Label>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSectionId("all");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classes || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-48">
            <Label className="text-xs">Section</Label>
            <Select value={sectionId} onValueChange={setSectionId} disabled={!sections.length}>
              <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterCommandBar>

        {/* Tabs */}
        {isReady && (
          <div className="border-b border-[var(--w11-border-subtle)] flex gap-0">
            {(
              [
                { id: "sheet", label: "Tabulation Sheet" },
                { id: "merit", label: "Merit List" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--w11-accent)] text-[color:var(--w11-accent)]"
                    : "border-transparent text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Grade legend strip */}
        {activeTab === "sheet" && gradeChart.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {gradeChart.map((g) => (
              <Badge key={g.grade_name} variant="outline" className="text-xs">
                {g.grade_name} · GPA {Number(g.gpa ?? 0).toFixed(1)} · ≥{Number(g.percent_from ?? 0)}%
              </Badge>
            ))}
          </div>
        )}

        {!isReady && (
          <div className="win11-card">
            <AOSEmptyState
              icon={<GraduationCap className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
              title="Select an exam and class"
              description="The tabulation sheet builds from entered marks"
            />
          </div>
        )}

        {/* ── Tabulation sheet ─────────────────────────────────────────────── */}
        {isReady && activeTab === "sheet" && (
          <DataPanel bodyClassName="p-0">
            {tabulation.isLoading ? (
              <PageLoader />
            ) : tabulation.isError ? (
              <ErrorState
                body="Failed to load the tabulation sheet. Please try again."
                onRetry={() => tabulation.refetch()}
                size="sm"
              />
            ) : !payload || payload.rows.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Table2}
                title="No tabulation data"
                body="Enter marks for this exam and class first — the sheet appears here."
              />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: "var(--w11-control-hover)" }}>
                      <th className="text-center px-3 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] sticky left-0 min-w-[50px]" style={{ background: "var(--w11-control-hover)" }}>
                        Roll
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] sticky left-12 min-w-[160px]" style={{ background: "var(--w11-control-hover)" }}>
                        Student
                      </th>
                      {payload.subjects.map((s) => (
                        <th
                          key={s.id}
                          className="text-center px-2 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] min-w-[76px]"
                          title={s.name}
                        >
                          <div className="truncate max-w-[76px]">{s.name}</div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] min-w-[90px]">Total</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] min-w-[60px]">%</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] min-w-[56px]">GPA</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r border-[var(--w11-border-subtle)] min-w-[64px]">Result</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-[var(--w11-border-subtle)] min-w-[56px]">Merit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--w11-border-subtle)]">
                    {payload.rows.map((row) => (
                      <tr
                        key={row.student_id}
                        className="transition-colors hover:bg-[color:var(--w11-control-hover)]"
                        style={row.result === "NG" ? { background: "rgba(196,43,28,.06)" } : undefined}
                      >
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] sticky left-0 bg-inherit text-center font-mono text-xs">
                          {row.roll_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] sticky left-12 bg-inherit font-medium">
                          {row.student_name}
                        </td>
                        {payload.subjects.map((s) => {
                          const cell = row.subjects.find(
                            (c) => c.subject_id === s.id,
                          );
                          return (
                            <td
                              key={s.id}
                              className="px-2 py-2 border-r border-[var(--w11-border-subtle)] text-center"
                              title={cell ? `${cell.obtained} / ${cell.full_marks}` : ""}
                            >
                              {!cell || !cell.entered || cell.is_absent ? (
                                <span className="text-[color:var(--w11-text-secondary)]">
                                  {cell?.is_absent ? "AB" : "—"}
                                </span>
                              ) : (
                                <div>
                                  <div
                                    className={cell.grade === "NG" ? "font-medium" : ""}
                                    style={cell.grade === "NG" ? { color: "#c42b1c" } : undefined}
                                  >
                                    {cell.obtained}
                                  </div>
                                  <div className="text-[10px] text-[color:var(--w11-text-secondary)]">{cell.grade}</div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] text-center font-medium whitespace-nowrap">
                          {row.total_obtained}/{row.total_full}
                        </td>
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] text-center">{row.percentage?.toFixed(1)}%</td>
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] text-center font-medium">{row.gpa?.toFixed(2)}</td>
                        <td className="px-3 py-2 border-r border-[var(--w11-border-subtle)] text-center">
                          <StatusChip
                            status={RESULT_TONE[row.result?.toLowerCase()] ?? row.result}
                            label={row.result}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.merit_order <= 3 ? (
                            <Badge variant="secondary">#{row.merit_order}</Badge>
                          ) : (
                            `#${row.merit_order}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>
        )}

        {/* ── Merit list ───────────────────────────────────────────────────── */}
        {isReady && activeTab === "merit" && (
          <DataPanel bodyClassName="p-0">
            {merit.isLoading ? (
              <PageLoader />
            ) : merit.isError ? (
              <ErrorState
                body="Failed to load the merit list. Please try again."
                onRetry={() => merit.refetch()}
                size="sm"
              />
            ) : !merit.data || merit.data.rows.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Trophy}
                title="No merit list"
                body="Enter marks first — students appear here ordered by GPA."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--w11-control-hover)" }}>
                    <TableHead className="w-16">Merit</TableHead>
                    <TableHead className="w-14">Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-28">Total</TableHead>
                    <TableHead className="w-20">%</TableHead>
                    <TableHead className="w-20">GPA</TableHead>
                    <TableHead className="w-20">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merit.data.rows.map((r) => (
                    <TableRow
                      key={`${r.merit_order}-${r.roll_number}`}
                      style={r.result === "NG" ? { background: "rgba(196,43,28,.04)" } : undefined}
                    >
                      <TableCell>
                        {r.merit_order <= 3 ? (
                          <Badge variant={r.merit_order === 1 ? "default" : "secondary"}>#{r.merit_order}</Badge>
                        ) : (
                          <span className="text-[color:var(--w11-text-secondary)] text-sm">#{r.merit_order}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">{r.roll_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.total_obtained}/{r.total_full}</TableCell>
                      <TableCell>{r.percentage?.toFixed(1)}%</TableCell>
                      <TableCell className="font-semibold">{r.gpa?.toFixed(2)}</TableCell>
                      <TableCell>
                        <StatusChip
                          status={RESULT_TONE[r.result?.toLowerCase()] ?? r.result}
                          label={r.result}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
