"use client";

/**
 * Academics / Class Subjects — A1 mapping page (plan 34 row 3).
 *
 * Rewrite: class picker is URL-backed (?class=) so a mapping view can be
 * shared/back-buttoned; skeletons; dependency-missing empty state when no
 * classes exist (→ Academics hub); guided "pick a class" state; StatusChip
 * for subject type; bilingual chrome. Endpoints and inline-assignment
 * behaviour (updateSubject teacher_id / class_ids) unchanged.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assignSubjectToClass,
  fetchClassSubjects,
  fetchClasses,
  fetchSubjects,
  fetchTeachers,
  updateSubject,
} from "@/lib/services/dashboard/academics.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { DependencyMissingEmptyState, EmptyState } from "@/components/ui/empty-state";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { Plus, Link2, Inbox } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ClassSubjectsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/academics/class-subjects";
  const selectedClass = routeParams.get("class") ?? "";
  const [assignOpen, setAssignOpen] = useState(false);

  function setSelectedClass(v: string) {
    const next = new URLSearchParams(routeParams.toString());
    if (v) next.set("class", v);
    else next.delete("class");
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: classes, isLoading: clsLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: fetchSubjects,
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: fetchTeachers,
  });

  const { data: classSubjects, isLoading: csLoading } = useQuery({
    queryKey: ["class-subjects", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      return fetchClassSubjects(selectedClass);
    },
    enabled: !!selectedClass,
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { class_id: string; subject_id: string }) =>
      assignSubjectToClass(payload.class_id, payload.subject_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subjects", selectedClass] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("Subject assigned to class", "विषय कक्षामा तोकियो"));
    },
    onError: () => toast.error(t("Failed to assign subject", "तोक्न सकिएन")),
  });

  const updateSubjectMutation = useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: Record<string, unknown> }) =>
      updateSubject(subjectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subjects", selectedClass] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: () => toast.error(t("Failed to update subject assignment", "अद्यावधिक भएन")),
  });

  if (clsLoading) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Link2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Class Subjects", "कक्षा-विषय")} />
        <AOSPageBody><SkeletonTable rows={6} /></AOSPageBody>
      </AOSPage>
    );
  }

  if ((classes || []).length === 0) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Link2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Class Subjects", "कक्षा-विषय")} />
        <AOSPageBody>
          <DependencyMissingEmptyState
            icon={Inbox}
            title={t("No classes yet", "अझै कक्षा छैन")}
            prerequisiteName={t("Classes", "कक्षा")}
            setupHref="/dashboard/academics?tab=classes"
            setupLabel={t("Create a class first →", "पहिले कक्षा बनाउनुहोस् →")}
            body={t("Subject mapping needs at least one class.", "म्यापिङका लागि कम्तीमा एक कक्षा चाहिन्छ।")}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  const assignedSubjectIds = new Set(
    (classSubjects || []).map((subject: any) => subject.id || subject.subject_id)
  );

  const CLASS_SUBJECT_COLUMNS: Column<any>[] = [
    { key: "name", label: t("Subject", "विषय"), sortable: true, value: (cs) => cs.subject_name || cs.name || "", render: (cs) => <span className="font-medium">{cs.subject_name || cs.name}</span> },
    { key: "code", label: t("Code", "कोड"), sortable: true, value: (cs) => cs.code || "" },
    {
      key: "is_optional",
      label: t("Type", "प्रकार"),
      value: (cs) => (cs.is_optional ? "optional" : "compulsory"),
      render: (cs) => (
        <StatusChip
          status={cs.is_optional ? "pending" : "active"}
          label={cs.is_optional ? t("Optional", "ऐच्छिक") : t("Compulsory", "अनिवार्य")}
        />
      ),
    },
    {
      key: "teacher_id",
      label: t("Teacher", "शिक्षक"),
      render: (cs) => (
        <AdvancedSelect
          className="w-52"
          triggerClassName="h-8 text-[12px]"
          value={cs.teacher_id || ""}
          onChange={(teacherId) => {
            updateSubjectMutation.mutate({
              subjectId: cs.id || cs.subject_id,
              data: { teacher_id: teacherId || null },
            });
          }}
          clearable
          searchable
          placeholder={t("Assign teacher", "शिक्षक तोक्नुहोस्")}
          options={(teachers || []).map((teacher: any) => ({ value: teacher.id, label: teacher.full_name }))}
        />
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (cs) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const classIds = (cs.class_ids || []).filter((id: string) => id !== selectedClass);
            updateSubjectMutation.mutate({
              subjectId: cs.id || cs.subject_id,
              data: { class_ids: classIds },
            });
          }}
          disabled={updateSubjectMutation.isPending}
        >
          {t("Remove", "हटाउनुहोस्")}
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Link2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Class Subjects", "कक्षा-विषय")}
        subtitle={t(
          "Assign subjects to classes and map a teacher per subject",
          "कक्षामा विषय तोक्नुहोस् र विषयगत शिक्षक राख्नुहोस्",
        )}
        actions={
          selectedClass ? (
            <Button size="sm" onClick={() => setAssignOpen((o) => !o)}>
              <Plus className="h-4 w-4 mr-2" /> {t("Quick Assign", "द्रुत तोक्ने")}
            </Button>
          ) : undefined
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <AdvancedSelect
            className="max-w-xs"
            value={selectedClass}
            onChange={(v) => setSelectedClass(v || "")}
            searchable
            placeholder={t("Choose a class...", "कक्षा छान्नुहोस्…")}
            options={(classes || []).map((cls: any) => ({ value: cls.id, label: cls.name }))}
          />
        </FilterCommandBar>

        {!selectedClass ? (
          <EmptyState
            icon={Link2}
            title={t("Pick a class to start", "सक्न कक्षा छान्नुहोस्")}
            body={t("The subject map for that class appears here.", "कक्षाको विषय सूची यहाँ आउँछ।")}
          />
        ) : (
          <DataPanel title={t("Assigned Subjects", "तोकिएका विषय")} bodyClassName="p-0">
            {csLoading ? (
              <SkeletonTable rows={5} columns={4} />
            ) : (
              <DataTable
                columns={CLASS_SUBJECT_COLUMNS}
                rows={(classSubjects || []) as any[]}
                rowKey={(cs: any) => cs.id || cs.subject_id}
                searchable
                searchPlaceholder={t("Search assigned subjects…", "खोज्नुहोस्…")}
                empty={{
                  icon: Link2,
                  title: t("No subjects assigned", "विषय तोकिएको छैन"),
                  body: t("Use Quick Assign (top right) to map subjects to this class.", "माथि दायाँ द्रुत तोक्ने प्रयोग गर्नुहोस्।"),
                  action: { label: t("Quick Assign", "द्रुत तोक्ने"), onClick: () => setAssignOpen(true) },
                }}
              />
            )}
            {assignOpen && subjects && subjects.length > 0 && (
              <div className="border-t border-[var(--w11-border-subtle)] p-4">
                <p className="text-sm font-medium mb-2">{t("Not yet mapped — click to assign:", "अनटोकिएको — थिचेर तोक्नुहोस्:")}</p>
                <div className="flex flex-wrap gap-2">
                  {subjects
                    .filter((s: any) => !assignedSubjectIds.has(s.id))
                    .map((s: any) => (
                      <Button
                        key={s.id}
                        variant="outline"
                        size="sm"
                        onClick={() => assignMutation.mutate({ class_id: selectedClass, subject_id: s.id })}
                        disabled={assignMutation.isPending}
                      >
                        <Plus className="h-3 w-3 mr-1" /> {s.name}
                      </Button>
                    ))}
                  {subjects.filter((s: any) => !assignedSubjectIds.has(s.id)).length === 0 && (
                    <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {t("Every subject is already mapped to this class.", "सबै विषय توकिएका छन्।")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
