"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Table2 className="h-6 w-6" /> Tabulation Sheet
          </h1>
          <p className="text-muted-foreground text-sm">
            Students × subjects grid with totals, GPA, result and merit order
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!isReady || (activeTab === "sheet" ? !payload?.rows?.length : !merit.data?.rows?.length)}
          onClick={() => openPrint(activeTab === "sheet" ? "tabulation" : "merit-list")}
        >
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>

      {/* Pickers */}
      <Card>
        <CardContent className="pt-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {(exams || []).map((e: { id: string; name: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
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
          <div className="space-y-1.5">
            <Label>Section</Label>
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
        </CardContent>
      </Card>

      {/* Tabs */}
      {isReady && (
        <div className="border-b flex gap-0">
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
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select an exam and class</p>
            <p className="text-sm mt-1">The tabulation sheet builds from entered marks</p>
          </CardContent>
        </Card>
      )}

      {/* ── Tabulation sheet ─────────────────────────────────────────────── */}
      {isReady && activeTab === "sheet" && (
        <Card>
          <CardContent className="p-0">
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
                    <tr className="bg-muted/60">
                      <th className="text-center px-3 py-2.5 font-medium border-b border-r sticky left-0 bg-muted/60 min-w-[50px]">
                        Roll
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium border-b border-r sticky left-12 bg-muted/60 min-w-[160px]">
                        Student
                      </th>
                      {payload.subjects.map((s) => (
                        <th
                          key={s.id}
                          className="text-center px-2 py-2.5 font-medium border-b border-r min-w-[76px]"
                          title={s.name}
                        >
                          <div className="truncate max-w-[76px]">{s.name}</div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-2.5 font-medium border-b border-r min-w-[90px]">Total</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r min-w-[60px]">%</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r min-w-[56px]">GPA</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b border-r min-w-[64px]">Result</th>
                      <th className="text-center px-2 py-2.5 font-medium border-b min-w-[56px]">Merit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payload.rows.map((row) => (
                      <tr
                        key={row.student_id}
                        className={`hover:bg-muted/30 transition-colors ${
                          row.result === "NG" ? "bg-red-50 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <td className="px-3 py-2 border-r sticky left-0 bg-inherit text-center font-mono text-xs">
                          {row.roll_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-r sticky left-12 bg-inherit font-medium">
                          {row.student_name}
                        </td>
                        {payload.subjects.map((s) => {
                          const cell = row.subjects.find(
                            (c) => c.subject_id === s.id,
                          );
                          return (
                            <td
                              key={s.id}
                              className="px-2 py-2 border-r text-center"
                              title={cell ? `${cell.obtained} / ${cell.full_marks}` : ""}
                            >
                              {!cell || !cell.entered || cell.is_absent ? (
                                <span className="text-muted-foreground">
                                  {cell?.is_absent ? "AB" : "—"}
                                </span>
                              ) : (
                                <div>
                                  <div className={cell.grade === "NG" ? "text-red-600 font-medium" : ""}>
                                    {cell.obtained}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{cell.grade}</div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 border-r text-center font-medium whitespace-nowrap">
                          {row.total_obtained}/{row.total_full}
                        </td>
                        <td className="px-2 py-2 border-r text-center">{row.percentage?.toFixed(1)}%</td>
                        <td className="px-2 py-2 border-r text-center font-medium">{row.gpa?.toFixed(2)}</td>
                        <td className="px-2 py-2 border-r text-center">
                          <Badge
                            className={
                              row.result === "NG"
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                            }
                          >
                            {row.result}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-center">
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
          </CardContent>
        </Card>
      )}

      {/* ── Merit list ───────────────────────────────────────────────────── */}
      {isReady && activeTab === "merit" && (
        <Card>
          <CardContent className="p-0">
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
                  <TableRow className="bg-muted/30">
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
                    <TableRow key={`${r.merit_order}-${r.roll_number}`} className={r.result === "NG" ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                      <TableCell>
                        {r.merit_order <= 3 ? (
                          <Badge variant={r.merit_order === 1 ? "default" : "secondary"}>#{r.merit_order}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">#{r.merit_order}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">{r.roll_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.total_obtained}/{r.total_full}</TableCell>
                      <TableCell>{r.percentage?.toFixed(1)}%</TableCell>
                      <TableCell className="font-semibold">{r.gpa?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            r.result === "NG"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }
                        >
                          {r.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
