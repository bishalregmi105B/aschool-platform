"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PrintStyles, PrintRegion, PrintTwinButton } from "../print-twin";

/** Shape returned by GET /exams/grade-table (static NEB reference). */
interface Grade {
  grade: string;
  gpa: number;
  min_pct: number;
  description?: string;
}

const GRADE_COLUMNS: Column<Grade>[] = [
  { key: "grade", label: "Grade", sortable: true, value: (g) => g.grade, render: (g) => <span className="font-bold text-lg">{g.grade}</span> },
  { key: "min_pct", label: "Min %", align: "right", sortable: true, value: (g) => g.min_pct, render: (g) => <>{g.min_pct}%</> },
  { key: "gpa", label: "Grade Point (GPA)", align: "right", sortable: true, value: (g) => g.gpa, render: (g) => <Badge>{g.gpa}</Badge> },
  { key: "description", label: "Description", value: (g) => g.description ?? "", render: (g) => g.description || "—" },
];

export default function ExamGradesPage() {
  return (
    <PluginGate slug="exams">
      <ExamGradesContent />
    </PluginGate>
  );
}

function ExamGradesContent() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["exam-grades"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Grade[]>>("/exams/grade-table");
      return res.data.data ?? [];
    },
    retry: 1,
  });

  if (isLoading) return <AOSPage><AOSModuleLoadingState label={t("Loading grade table…", "ग्रेड तालिका लोड हुँदैछ…")} /></AOSPage>;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          title={t("Exam Grades", "परीक्षा ग्रेड")}
          subtitle={t("Nepal NEB grading scale — used automatically for marks entry, results and report cards", "NEB ग्रेडिङ स्केल — अंक प्रविष्टि, नतिजा र रिपोर्ट कार्डमा स्वतः प्रयोग")}
        />
        <AOSPageBody>
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">{t("Failed to load the grade table. Please try again.", "ग्रेड तालिका लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <PrintStyles orientation="portrait" />
      <AOSPageHeader
        icon={<Star className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Exam Grades", "परीक्षा ग्रेड")}
        subtitle={`${(data || []).length} ${t("grades", "ग्रेड")} · ${t("Nepal NEB grading scale — used automatically for marks entry, results and report cards", "NEB ग्रेडिङ स्केल — अंक प्रविष्टि, नतिजा र रिपोर्ट कार्डमा स्वतः प्रयोग")}`}
        actions={<PrintTwinButton title="NEB Grading Scale" label={t("Print scale", "स्केल प्रिन्ट")} />}
      />
      <AOSPageBody className="space-y-4">
        <PrintRegion>
        <DataPanel title={t("NEB Grading Scale (Letter Grade Directive 2078)", "NEB ग्रेडिङ स्केल (अक्षर ग्रेड निर्देशन २०७८)")}>
          <DataTable<Grade>
            columns={GRADE_COLUMNS}
            rows={data || []}
            rowKey={(g) => g.grade}
            exportFileName="neb-grade-scale"
            empty={{ icon: Star, title: "Grade table unavailable", body: "The backend grade reference returned nothing." }}
          />
        </DataPanel>
        </PrintRegion>

        <p className="text-xs text-[color:var(--w11-text-secondary)]">
          {t(
            "Grades and GPA are computed with this scale automatically — theory marks must be ≥ the pass threshold and practical marks ≥ 40% where a practical component exists.",
            "ग्रेड र GPA यसै स्केलबाट स्वतः गणना हुन्छन् — सैद्धान्तिक अंक उत्तीर्णांकभन्दा बढी र प्राक्टिकल भएमा ४०% भन्दा बढी हुनुपर्छ।"
          )}
        </p>
      </AOSPageBody>
    </AOSPage>
  );
}
