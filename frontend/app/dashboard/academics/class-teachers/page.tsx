"use client";

/**
 * Academics / Class Teachers — assignment workspace (plan 34 row 3).
 *
 * Rewrite: class picker URL-backed (?class=); per-section cards now show the
 * live student count context via capacity; skeletons; dependency + guidance
 * empty states; StatusChip; bilingual chrome. Mutations unchanged
 * (updateSection class_teacher_id, updateSubject teacher_id).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClassSubjects,
  fetchClasses,
  fetchTeachers,
  updateSection,
  updateSubject,
} from "@/lib/services/dashboard/academics.service";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedSelect } from "@/components/ui/advanced-select";
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
  FormSection,
} from "@/components/aos/kit/page-kit";
import { Users, UserCog, Layers, BookOpen, Inbox } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ClassSectionsTeachersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/academics/class-teachers";
  const selectedClass = routeParams.get("class") ?? "";

  function setSelectedClass(v: string) {
    const next = new URLSearchParams(routeParams.toString());
    if (v) next.set("class", v);
    else next.delete("class");
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: fetchTeachers,
  });

  const { data: classSubjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["class-subjects", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      return fetchClassSubjects(selectedClass);
    },
    enabled: !!selectedClass,
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, classTeacherId }: { sectionId: string; classTeacherId: string | null }) =>
      updateSection(selectedClass, sectionId, {
        class_teacher_id: classTeacherId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success(t("Class teacher updated", "कक्षा शिक्षक अद्यावधिक"));
    },
    onError: () => toast.error(t("Failed to update class teacher", "अद्यावधिक भएन")),
  });

  const updateSubjectTeacherMutation = useMutation({
    mutationFn: ({ subjectId, teacherId }: { subjectId: string; teacherId: string | null }) =>
      updateSubject(subjectId, { teacher_id: teacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subjects", selectedClass] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success(t("Subject teacher updated", "विषय शिक्षक अद्यावधिक"));
    },
    onError: () => toast.error(t("Failed to update subject teacher", "अद्यावधिक भएन")),
  });

  if (isLoading) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Class Teachers", "कक्षा-शिक्षक")} />
        <AOSPageBody>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" />
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if ((classes || []).length === 0) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Class Teachers", "कक्षा-शिक्षक")} />
        <AOSPageBody>
          <DependencyMissingEmptyState
            icon={Inbox}
            title={t("No classes yet", "अझै कक्षा छैन")}
            prerequisiteName={t("Classes", "कक्षा")}
            setupHref="/dashboard/academics?tab=classes"
            setupLabel={t("Create a class first →", "पहिले कक्षा बनाउनुहोस् →")}
            body={t("Teacher assignment works per class section.", "शिक्षक तोक्न कक्षा सेक्सन चाहिन्छ।")}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  const selectedClassData = (classes || []).find((c: any) => c.id === selectedClass);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Class Section & Teachers", "कक्षा सेक्सन र शिक्षक")}
        subtitle={t(
          "Assign a class teacher per section and a subject teacher per subject",
          "सेक्सनअनुसार कक्षा शिक्षक र विषयअनुसार विषय शिक्षक तोक्नुहोस्",
        )}
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
            icon={UserCog}
            title={t("Pick a class to start", "सक्न कक्षा छान्नुहोस्")}
            body={t("Sections with their teacher pickers appear here.", "सेक्सन र शिक्षक चयन यहाँ आउँछ।")}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
              {(selectedClassData?.sections || []).map((section: any) => (
                <FormSection key={section.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                    <span className="text-[15px] font-semibold">
                      {selectedClassData?.name} - {section.name}
                    </span>
                  </div>
                  <p className="text-sm mb-4" style={{ color: "var(--w11-text-secondary)" }}>
                    {t("Capacity", "अनुमति")}: {section.capacity ?? "—"} {t("students", "विद्यार्थी")}
                  </p>
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t("Class Teacher", "कक्षा शिक्षक")}</p>
                    <AdvancedSelect
                      value={section.class_teacher_id || ""}
                      onChange={(teacherId) => {
                        updateSectionMutation.mutate({
                          sectionId: section.id,
                          classTeacherId: teacherId || null,
                        });
                      }}
                      clearable
                      searchable
                      placeholder={t("Assign class teacher...", "शिक्षक तोक्नुहोस्…")}
                      options={(teachers || []).map((teacher: any) => ({ value: teacher.id, label: teacher.full_name }))}
                    />
                  </div>
                </FormSection>
              ))}
              {(selectedClassData?.sections || []).length === 0 && (
                <div className="col-span-3">
                  <EmptyState
                    size="sm"
                    icon={Layers}
                    title={t("No sections in this class", "यो कक्षामा सेक्सन छैन")}
                    body={t("Add sections in Academics → Classes & Sections.", "अकाडेमिक्समा सेक्सन थप्नुहोस्।")}
                    action={{ label: t("Open Academics", "अकाडेमिक्स खोल्नुहोस्"), href: "/dashboard/academics?tab=classes" }}
                  />
                </div>
              )}
            </div>

            <DataPanel
              title={
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> {t("Subject Teachers", "विषय शिक्षक")}
                </span>
              }
            >
              {loadingSubjects ? (
                <div className="space-y-3">
                  <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(classSubjects || []).map((subject: any) => (
                    <div
                      key={subject.id}
                      className="flex flex-col gap-3 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{subject.code || t("No code", "कोड छैन")}</div>
                      </div>
                      <AdvancedSelect
                        className="w-full md:w-64"
                        value={subject.teacher_id || ""}
                        onChange={(teacherId) => {
                          updateSubjectTeacherMutation.mutate({
                            subjectId: subject.id,
                            teacherId: teacherId || null,
                          });
                        }}
                        clearable
                        searchable
                        placeholder={t("Assign subject teacher", "विषय शिक्षक तोक्नुहोस्")}
                        options={(teachers || []).map((teacher: any) => ({ value: teacher.id, label: teacher.full_name }))}
                      />
                    </div>
                  ))}
                  {(classSubjects || []).length === 0 && (
                    <EmptyState
                      size="sm"
                      icon={BookOpen}
                      title={t("No subjects assigned to this class", "यो कक्षामा विषय तोकिएको छैन")}
                      body={t("Map subjects first, then teachers appear here.", "पहिले विषय तोक्नुहोस्।")}
                      action={{ label: t("Open Class Subjects", "कक्षा-विषय खोल्नुहोस्"), href: `/dashboard/academics/class-subjects?class=${selectedClass}` }}
                    />
                  )}
                </div>
              )}
            </DataPanel>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
