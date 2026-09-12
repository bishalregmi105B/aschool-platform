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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Users, UserCog, Layers } from "lucide-react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Class Section & Teachers
        </h1>
        <p className="text-muted-foreground">
          Assign class teachers and subject teachers to sections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <AdvancedSelect
            className="max-w-xs"
            value={selectedClass}
            onChange={setSelectedClass}
            searchable
            placeholder="Choose a class..."
            options={(classes || []).map((cls: any) => ({ value: cls.id, label: cls.name }))}
          />
        </CardContent>
      </Card>

      {selectedClassData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(selectedClassData.sections || []).map((section: any) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  {selectedClassData.name} - {section.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">Capacity: {section.capacity} students</p>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <div>
                  <p className="text-sm font-medium mb-1.5">Subject Teachers</p>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground border rounded-md p-3">
                      Subject teachers are assigned at class level. Use the table below to map each subject to a teacher.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!selectedClassData.sections || selectedClassData.sections.length === 0) && (
            <p className="text-muted-foreground col-span-3 text-center py-8">
              No sections found. Add sections in Academics → Classes & Sections.
            </p>
          )}
        </div>
      )}

      {selectedClass && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSubjects ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <div className="space-y-3">
                {(classSubjects || []).map((subject: any) => (
                  <div key={subject.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{subject.name}</div>
                      <div className="text-sm text-muted-foreground">{subject.code || "No code"}</div>
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
                  <p className="py-4 text-center text-muted-foreground">Assign subjects to this class first.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
