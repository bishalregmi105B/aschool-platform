"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClassSubjects,
  fetchClasses,
  fetchTeachers,
  updateSection,
  updateSubject,
} from "@/lib/services/dashboard/academics.service";
import { toast } from "sonner";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  FormSection,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { Users, UserCog, Layers, BookOpen } from "lucide-react";

export default function ClassSectionsTeachersPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<string>("");

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
      toast.success("Class teacher updated");
    },
    onError: () => toast.error("Failed to update class teacher"),
  });

  const updateSubjectTeacherMutation = useMutation({
    mutationFn: ({ subjectId, teacherId }: { subjectId: string; teacherId: string | null }) =>
      updateSubject(subjectId, { teacher_id: teacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subjects", selectedClass] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Subject teacher updated");
    },
    onError: () => toast.error("Failed to update subject teacher"),
  });

  if (isLoading) return <PageLoader />;

  const selectedClassData = (classes || []).find((c: any) => c.id === selectedClass);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Class Section & Teachers"
        subtitle="Assign class teachers and subject teachers to sections"
      />
      <AOSPageBody>
        <FilterCommandBar>
          <AdvancedSelect
            className="max-w-xs"
            value={selectedClass}
            onChange={setSelectedClass}
            searchable
            placeholder="Choose a class..."
            options={(classes || []).map((cls: any) => ({ value: cls.id, label: cls.name }))}
          />
        </FilterCommandBar>

        {selectedClassData && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
            {(selectedClassData.sections || []).map((section: any) => (
              <FormSection key={section.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                  <span className="text-[15px] font-semibold">
                    {selectedClassData.name} - {section.name}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--w11-text-secondary)] mb-4">
                  Capacity: {section.capacity} students
                </p>
                {/* Class Teacher */}
                <div>
                  <p className="text-sm font-medium mb-1.5">Class Teacher</p>
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
                    placeholder="Assign class teacher..."
                    options={(teachers || []).map((t: any) => ({ value: t.id, label: t.full_name }))}
                  />
                </div>

                {/* Subject Teachers */}
                <div className="mt-4">
                  <p className="text-sm font-medium mb-1.5">Subject Teachers</p>
                  <div className="space-y-2">
                    <div
                      className="text-sm text-[color:var(--w11-text-secondary)] border border-[var(--w11-border-subtle)] rounded-[var(--w11-radius-md)] p-3"
                    >
                      Subject teachers are assigned at class level. Use the table below to map each subject to a teacher.
                    </div>
                  </div>
                </div>
              </FormSection>
            ))}
            {(!selectedClassData.sections || selectedClassData.sections.length === 0) && (
              <div className="col-span-3">
                <AOSEmptyState
                  icon={<UserCog className="h-10 w-10" />}
                  title="No sections found"
                  description="Add sections in Academics → Classes &amp; Sections."
                />
              </div>
            )}
          </div>
        )}

        {selectedClass && (
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Subject Teachers
              </span>
            }
          >
            {loadingSubjects ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <div className="space-y-3">
                {(classSubjects || []).map((subject: any) => (
                  <div
                    key={subject.id}
                    className="flex flex-col gap-3 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)] p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">{subject.name}</div>
                      <div className="text-sm text-[color:var(--w11-text-secondary)]">{subject.code || "No code"}</div>
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
                      placeholder="Assign subject teacher"
                      options={(teachers || []).map((teacher: any) => ({ value: teacher.id, label: teacher.full_name }))}
                    />
                  </div>
                ))}
                {(classSubjects || []).length === 0 && (
                  <AOSEmptyState
                    title="No subjects assigned"
                    description="Assign subjects to this class first."
                  />
                )}
              </div>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
