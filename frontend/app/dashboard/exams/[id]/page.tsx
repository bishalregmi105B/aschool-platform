"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  useAOSPathParam,
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import Link from "next/link";
import { ArrowLeft, Calendar, ClipboardList, FileBarChart, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AOSPage, AOSPageBody, KpiCard, StatGrid,
  DataPanel, StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader } from "@/components/aos/kit/detail-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { displayBS } from "@/lib/nepali_date";
import { useI18n } from "@/lib/i18n";

interface Exam {
  id: string;
  name: string;
  name_nepali?: string | null;
  exam_type?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_date_bs?: string | null;
  end_date_bs?: string | null;
  total_marks?: number | null;
  pass_marks?: number | null;
  is_practical?: boolean;
  status?: string;
  description?: string | null;
}

interface ExamSubject {
  id: string;
  name: string;
  code?: string;
  has_practical: boolean;
  full_marks: number;
  pass_marks: number;
  practical_full_marks?: number;
  total_full_marks?: number;
  total_pass_marks?: number;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  percentage: number;
  grade?: string | null;
  gpa?: number | null;
  status?: string;
}

/** Exam status → StatusChip tone key. */
const STATUS_TONE: Record<string, string> = {
  scheduled: "scheduled",
  ongoing: "pending",
  completed: "completed",
  published: "published",
  result_published: "published",
  cancelled: "cancelled",
};

export default function ExamDetailPage() {
  const params = useParams();
  const examId = useAOSPathParam(2) || (params.id as string);

  const { t } = useI18n();
  // Wave C (A2 archetype): ObjectHeader + Tabs, tab is URL state (?tab=) so
  // the shell can deep-link Subjects/Results from anywhere.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const tab = routeParams.get("tab") || "overview";
  const setTab = (v: string) => {
    const pathname = windowRoute?.pathname ?? `/dashboard/exams/${examId}`;
    const next = new URLSearchParams(routeParams.toString());
    if (v === "overview") next.delete("tab");
    else next.set("tab", v);
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}`);
      return resp.data.data as Exam;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["exam-subjects", examId],
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}/subjects`);
      return (resp.data.data ?? []) as ExamSubject[];
    },
  });

  const { data: results } = useQuery({
    queryKey: ["exam-results", examId, exam?.class_id],
    enabled: Boolean(exam?.class_id),
    queryFn: async () => {
      const resp = await api.get(`/exams/${examId}/results`, {
        params: { class_id: exam?.class_id },
      });
      return (resp.data.data ?? []) as StudentResult[];
    },
  });

  if (isLoading) return <AOSPage><AOSModuleLoadingState label={t("Loading exam…", "परीक्षा लोड हुँदैछ…")} /></AOSPage>;
  if (error || !exam) {
    return (
      <AOSPage>
        <AOSPageBody>
          <EmptyState
            variant="filtered"
            title={t("Exam not found", "परीक्षा भेटिएन")}
            body={t("This exam may have been deleted or belongs to another school.", "यो परीक्षा मेटाइएको वा अर्को विद्यालयको हुन सक्छ।")}
            action={{ label: t("Back to exams", "परीक्षा सूचीमा फर्कनुहोस्"), href: "/dashboard/exams" }}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  const totalFull = subjects?.reduce((sum, s) => sum + (s.total_full_marks ?? s.full_marks ?? 0), 0);
  const summary = results && results.length > 0
    ? {
        appeared: results.length,
        passed: results.filter((r) => r.status === "pass" || (r.percentage ?? 0) >= (exam.pass_marks ?? 0)).length,
        average: Math.round(
          results.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / results.length
        ),
        highest: Math.max(...results.map((r) => r.percentage ?? 0)),
      }
    : null;

  const windowLabel = `${displayBS(exam.start_date_bs || exam.start_date) || "—"} → ${displayBS(exam.end_date_bs || exam.end_date) || "—"}`;

  return (
    <AOSPage>
      <AOSPageBody className="space-y-4">
        <ObjectHeader
          name={exam.name}
          nameNepali={exam.name_nepali}
          codeLabel={t("Window", "अवधि")}
          code={windowLabel}
          status={exam.status ? (STATUS_TONE[exam.status] ?? exam.status) : undefined}
          avatar={
            <Link href="/dashboard/exams" aria-label={t("Back to exams", "परीक्षा सूचीमा फर्कनुहोस्")}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          }
          meta={
            <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
              <span className="win11-chip subtle">{exam.exam_type || "—"}</span>
              <span className="win11-chip subtle">{exam.class_name || t("All classes", "सबै कक्षा")}</span>
              {exam.is_practical && <span className="win11-chip subtle">{t("Practical", "प्राक्टिकल")}</span>}
            </div>
          }
          actions={
            <>
              <Link href={`/dashboard/exams/marks?exam=${examId}`}>
                <Button size="sm">
                  <ClipboardList className="mr-1 h-4 w-4" /> {t("Enter marks", "अंक भर्नुहोस्")}
                </Button>
              </Link>
              <Link href={`/dashboard/exams/results?exam=${examId}`}>
                <Button size="sm" variant="outline">
                  <FileBarChart className="mr-1 h-4 w-4" /> {t("Results", "नतिजा")}
                </Button>
              </Link>
            </>
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="overview">{t("Overview", "सारांश")}</TabsTrigger>
            <TabsTrigger value="subjects" badge={subjects?.length || undefined}>
              {t("Subjects", "विषयहरू")}
            </TabsTrigger>
            <TabsTrigger value="results" badge={results?.length || undefined}>
              {t("Results", "नतिजा")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <StatGrid className="mb-0">
              <KpiCard
                label={t("Subjects", "विषयहरू")}
                value={subjects?.length ?? 0}
                icon={<ClipboardList className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote={t("mapped to this exam", "यो परीक्षासँग जोडिएका")}
              />
              <KpiCard
                label={t("Full Marks", "पूर्णांक")}
                value={exam.total_marks ?? totalFull ?? "—"}
                icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote={`${t("Pass marks", "उत्तीर्णांक")} ${exam.pass_marks ?? "—"}`}
              />
              <KpiCard
                label={t("Appeared", "उपस्थित")}
                value={summary?.appeared ?? "—"}
                icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote={summary ? `highest ${summary.highest}%` : t("No marks entered yet", "अझै अंक भरिएको छैन")}
              />
              <KpiCard
                label={t("Passed", "उत्तीर्ण")}
                value={summary?.passed ?? "—"}
                color="#107c10"
                footnote={summary ? `${summary.appeared} ${t("students appeared", "विद्यार्थी")}` : t("No marks entered yet", "अझै अंक भरिएको छैन")}
              />
            </StatGrid>
            {exam.description && (
              <DataPanel title={t("Description / Instructions", "विवरण / निर्देशन")}>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--w11-text-primary)" }}>
                  {exam.description}
                </p>
              </DataPanel>
            )}
          </TabsContent>

          <TabsContent value="subjects">
            <DataPanel title={t("Exam subjects", "परीक्षाका विषयहरू")} bodyClassName="p-0">
              {subjects && subjects.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Subject", "विषय")}</TableHead>
                      <TableHead>{t("Code", "संकेत")}</TableHead>
                      <TableHead className="text-right">{t("Full marks", "पूर्णांक")}</TableHead>
                      <TableHead className="text-right">{t("Pass marks", "उत्तीर्णांक")}</TableHead>
                      <TableHead>{t("Practical", "प्राक्टिकल")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-[color:var(--w11-text-secondary)]">{s.code || "—"}</TableCell>
                        <TableCell className="text-right">{s.total_full_marks ?? s.full_marks}</TableCell>
                        <TableCell className="text-right">{s.total_pass_marks ?? s.pass_marks}</TableCell>
                        <TableCell>
                          {s.has_practical ? (
                            <Badge variant="outline" className="text-xs">
                              {s.practical_full_marks ? `${s.practical_full_marks} marks` : "Yes"}
                            </Badge>
                          ) : (
                            <span className="text-sm text-[color:var(--w11-text-secondary)]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  size="sm"
                  title={t("No subjects mapped", "विषय जोडिएको छैन")}
                  body={t("Map subjects to this exam from the exam editor.", "exam editor बाट यो परीक्षामा विषय जोड्नुहोस्।")}
                  action={{ label: t("Back to exams", "परीक्षा सूचीमा फर्कनुहोस्"), href: "/dashboard/exams" }}
                />
              )}
            </DataPanel>
          </TabsContent>

          <TabsContent value="results">
            {results && results.length > 0 ? (
              <DataPanel title={t("Top performers", "उत्कृष्ट प्रदर्शन")} bodyClassName="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t("Student", "विद्यार्थी")}</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>{t("Grade", "ग्रेड")}</TableHead>
                      <TableHead>{t("Status", "अवस्था")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.slice(0, 10).map((r, i) => (
                      <TableRow key={r.student_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.student_name}</TableCell>
                        <TableCell className="text-right">{r.percentage}%</TableCell>
                        <TableCell>{r.grade || "—"}</TableCell>
                        <TableCell>
                          <StatusChip status={r.status || "—"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataPanel>
            ) : (
              <EmptyState
                variant="dependency"
                title={t("No results yet", "अझै नतिजा छैन")}
                body={t("Enter marks for this exam to compute NEB grades and results.", "NEB ग्रेड र नतिजाका लागि अंक भर्नुहोस्।")}
                action={{ label: t("Enter marks", "अंक भर्नुहोस्"), href: `/dashboard/exams/marks?exam=${examId}` }}
              />
            )}
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}
