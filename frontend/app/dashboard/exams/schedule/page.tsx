"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, StatusChip,
  AOSModuleLoadingState, AOSEmptyState, FilterCommandBar,
} from "@/components/aos/kit/page-kit";
import { Calendar, Search } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import { useI18n } from "@/lib/i18n";

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  status: string;
  class_name?: string;
  start_date_bs?: string;
  end_date_bs?: string;
  start_date?: string;
  end_date?: string;
  total_marks?: number;
  pass_marks?: number;
  is_practical?: boolean;
}

interface ExamSubject {
  id: string;
  name: string;
  code?: string;
  has_practical: boolean;
  full_marks: number;
  pass_marks: number;
  practical_full_marks?: number;
  total_full_marks: number;
  total_pass_marks: number;
}

const SCHEDULE_COLUMNS: Column<ExamSubject>[] = [
  { key: "name", label: "Subject", sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
  { key: "code", label: "Code", sortable: true, value: (s) => s.code ?? "", render: (s) => <span className="text-[color:var(--w11-text-secondary)]">{s.code || "—"}</span> },
  { key: "full", label: "Full Marks", align: "right", sortable: true, value: (s) => s.total_full_marks ?? s.full_marks, render: (s) => <>{s.total_full_marks ?? s.full_marks}</> },
  { key: "pass", label: "Pass Marks", align: "right", sortable: true, value: (s) => s.total_pass_marks ?? s.pass_marks, render: (s) => <>{s.total_pass_marks ?? s.pass_marks}</> },
  {
    key: "practical",
    label: "Practical",
    value: (s) => (s.has_practical ? "yes" : "no"),
    render: (s) =>
      s.has_practical ? (
        <Badge variant="outline" className="text-xs">
          {s.practical_full_marks ? `${s.practical_full_marks} marks` : "Yes"}
        </Badge>
      ) : (
        <span className="text-[color:var(--w11-text-secondary)] text-sm">—</span>
      ),
  },
];

/** Exam status → StatusChip tone key (ongoing rides the warning key). */
const STATUS_TONE: Record<string, string> = {
  ongoing: "pending",
  completed: "completed",
  result_published: "published",
};

export default function ExamSchedulePage() {
  return (
    <AppGate slug="exams">
      <ExamScheduleContent />
    </AppGate>
  );
}

function ExamScheduleContent() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  if (isLoading) return <AOSPage><AOSModuleLoadingState label={t("Loading schedule…", "तालिका लोड हुँदैछ…")} /></AOSPage>;

  if (isError)
    return (
      <AOSPage>
        <AOSPageHeader title={t("Exam Schedule", "परीक्षा तालिका")} subtitle={t("View exam timetables and schedules", "परीक्षाको समयतालिका हेर्नुहोस्")} />
        <AOSPageBody>
          <div className="win11-card p-6 rounded-lg text-sm text-[#c42b1c] text-center">
            {t("Failed to load the exam schedule. Please refresh the page to try again.", "परीक्षा तालिका लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}
          </div>
        </AOSPageBody>
      </AOSPage>
    );

  const needle = search.trim().toLowerCase();
  // Filter exams by name/class OR by any subject name (the card tables below
  // are per-exam, but the toolbar search should surface the right cards).
  const visible = (exams || []).filter((e: Exam) =>
    !needle || `${e.name} ${e.class_name ?? ""}`.toLowerCase().includes(needle)
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Exam Schedule", "परीक्षा तालिका")}
        subtitle={`${(exams || []).length} ${t("exams", "परीक्षा")} · ${t("View exam timetables and schedules", "परीक्षाको समयतालिका हेर्नुहोस्")}`}
        actions={
          <a href="/dashboard/exams" className="text-sm font-medium text-[color:var(--w11-accent)] hover:underline whitespace-nowrap">
            {t("Create / manage exams →", "परीक्षा बनाउनुहोस् / व्यवस्थापन →")}
          </a>
        }
      />
      <AOSPageBody className="space-y-4">
        {(exams || []).length === 0 ? (
          <AOSEmptyState
            icon={<Calendar className="h-8 w-8" style={{ color: "var(--w11-accent)" }} />}
            title={t("No exams scheduled yet.", "अझै कुनै परीक्षा तालिकाबद्ध छैन।")}
            description={t("Create your first exam on the Exams overview.", "Exams overview मा पहिलो परीक्षा बनाउनुहोस्।")}
            action={
              <a href="/dashboard/exams" className="text-sm font-medium text-[color:var(--w11-accent)] hover:underline">
                {t("Create your first exam →", "पहिलो परीक्षा बनाउनुहोस् →")}
              </a>
            }
          />
        ) : (
          <>
            <FilterCommandBar>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--w11-text-secondary)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search exams or classes…", "परीक्षा वा कक्षा खोज्नुहोस्…")}
                  className="pl-8 h-9"
                />
              </div>
            </FilterCommandBar>
            {visible.length === 0 ? (
              <AOSEmptyState
                icon={<Calendar className="h-8 w-8" style={{ color: "var(--w11-text-tertiary)" }} />}
                title={t(`No exam matches “${search}”`, `“${search}” सँग मिल्ने परीक्षा भेटिएन`)}
                description={t("Clear the search to see all exams.", "सबै हेर्न खोज खाली गर्नुहोस्।")}
                action={<Button variant="outline" size="sm" onClick={() => setSearch("")}>{t("Clear", "खाली")}</Button>}
              />
            ) : (
              visible.map((exam: Exam) => <ExamCard key={exam.id} exam={exam} />)
            )}
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

function ExamCard({ exam }: { exam: Exam }) {
  const { data: subjects, isLoading } = useQuery({
    queryKey: ["exam-subjects-schedule", exam.id],
    queryFn: async () => {
      const res = await api.get(`/exams/${exam.id}/subjects`);
      return Array.isArray(res.data?.data) ? (res.data.data as ExamSubject[]) : [];
    },
  });

  const startBs = exam.start_date_bs;
  const endBs = exam.end_date_bs;
  const dateLabel = startBs
    ? endBs && endBs !== startBs
      ? `${displayBS(startBs)} – ${displayBS(endBs)}`
      : displayBS(startBs)
    : exam.start_date
    ? displayBS(exam.start_date)
    : "—";

  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" /> {exam.name}
        </span>
      }
      actions={
        <>
          {exam.class_name && (
            <Badge variant="outline" className="capitalize">
              {exam.class_name}
            </Badge>
          )}
          <StatusChip
            status={STATUS_TONE[exam.status] || exam.status}
            label={exam.status?.replace("_", " ")}
            className="capitalize"
          />
        </>
      }
    >
      <p className="text-sm text-[color:var(--w11-text-secondary)] mb-3">{dateLabel}</p>
      {isLoading ? (
        <div className="space-y-2" aria-label="Loading subjects">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      ) : !subjects || subjects.length === 0 ? (
        <p className="text-sm text-[color:var(--w11-text-secondary)]">No subjects assigned for this exam.</p>
      ) : (
        <DataTable<ExamSubject>
          columns={SCHEDULE_COLUMNS}
          rows={subjects}
          rowKey={(s) => s.id}
          dense
          exportFileName={`exam-schedule-${exam.name}`}
          empty={{ icon: Calendar, title: "No subjects assigned", body: "Add subjects to this exam to build the schedule." }}
        />
      )}
    </DataPanel>
  );
}
