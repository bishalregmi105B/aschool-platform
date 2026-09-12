"use client";

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
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { Plus, Link2 } from "lucide-react";

export default function ClassSubjectsPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<string>("");

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
      toast.success("Subject assigned to class");
    },
    onError: () => toast.error("Failed to assign subject"),
  });

  const updateSubjectMutation = useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: Record<string, unknown> }) =>
      updateSubject(subjectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-subjects", selectedClass] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: () => toast.error("Failed to update subject assignment"),
  });

  if (clsLoading) return <PageLoader />;

  const assignedSubjectIds = new Set(
    (classSubjects || []).map((subject: any) => subject.id || subject.subject_id)
  );

  const CLASS_SUBJECT_COLUMNS: Column<any>[] = [
    { key: "name", label: "Subject", sortable: true, value: (cs) => cs.subject_name || cs.name || "", render: (cs) => <span className="font-medium">{cs.subject_name || cs.name}</span> },
    { key: "code", label: "Code", sortable: true, value: (cs) => cs.code || "" },
    {
      key: "is_optional",
      label: "Type",
      value: (cs) => (cs.is_optional ? "optional" : "compulsory"),
      render: (cs) => (
        <Badge variant={cs.is_optional ? "outline" : "secondary"}>
          {cs.is_optional ? "Optional" : "Compulsory"}
        </Badge>
      ),
    },
    {
      key: "teacher_id",
      label: "Teacher",
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
          placeholder="Assign teacher"
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
          Remove
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Link2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Class Subjects"
        subtitle="Assign subjects to classes and manage the mapping"
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

        {selectedClass && (
          <DataPanel title="Assigned Subjects">
            {csLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <>
                <DataTable
                  columns={CLASS_SUBJECT_COLUMNS}
                  rows={(classSubjects || []) as any[]}
                  rowKey={(cs: any) => cs.id || cs.subject_id}
                  searchable
                  searchPlaceholder="Search assigned subjects…"
                  empty={{
                    icon: Link2,
                    title: "No subjects assigned",
                    body: "Use Quick Assign below to map subjects to this class.",
                  }}
                />

                {/* Available subjects to assign */}
                {subjects && subjects.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--w11-border-subtle)]">
                    <p className="text-sm font-medium mb-2">Quick Assign:</p>
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
                    </div>
                  </div>
                )}
              </>
            )}
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
