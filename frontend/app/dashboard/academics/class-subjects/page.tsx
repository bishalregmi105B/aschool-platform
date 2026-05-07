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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" /> Class Subjects
        </h1>
        <p className="text-muted-foreground">
          Assign subjects to classes and manage the mapping
        </p>
      </div>

      {/* Class selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Choose a class..." />
            </SelectTrigger>
            <SelectContent>
              {(classes || []).map((cls: any) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Assigned subjects */}
      {selectedClass && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assigned Subjects</CardTitle>
            {/* Quick assign buttons for unassigned subjects */}
          </CardHeader>
          <CardContent>
            {csLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(classSubjects || []).map((cs: any) => (
                      <TableRow key={cs.id || cs.subject_id}>
                        <TableCell className="font-medium">{cs.subject_name || cs.name}</TableCell>
                        <TableCell>{cs.code || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={cs.is_optional ? "outline" : "secondary"}>
                            {cs.is_optional ? "Optional" : "Compulsory"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={cs.teacher_id || "unassigned"}
                            onValueChange={(teacherId) => {
                              updateSubjectMutation.mutate({
                                subjectId: cs.id || cs.subject_id,
                                data: { teacher_id: teacherId === "unassigned" ? null : teacherId },
                              });
                            }}
                          >
                            <SelectTrigger className="w-52">
                              <SelectValue placeholder="Assign teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Not assigned</SelectItem>
                              {(teachers || []).map((teacher: any) => (
                                <SelectItem key={teacher.id} value={teacher.id}>
                                  {teacher.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!classSubjects || classSubjects.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No subjects assigned to this class yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Available subjects to assign */}
                {subjects && subjects.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
