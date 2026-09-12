"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { Users, Save, CheckSquare, Square } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_name?: string;
  section_name?: string;
}

interface BusStop {
  id: string;
  route_id: string;
  name: string;
  student_ids: string[];
}

export default function TransportAllocationPage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [allocatedIds, setAllocatedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: routes } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/transport/routes");
      return res.data.data;
    },
  });

  const { data: stops } = useQuery({
    queryKey: ["transport-stops", selectedRouteId],
    enabled: !!selectedRouteId,
    queryFn: async () => {
      const res = await api.get<ApiResponse<BusStop[]>>(`/transport/stops?route_id=${selectedRouteId}`);
      return res.data.data;
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Student[]>>("/students?limit=500");
      return res.data.data;
    },
  });

  // Load existing allocations when stop is selected
  const handleStopChange = (stopId: string) => {
    setSelectedStopId(stopId);
    const stop = stops?.find((s: any) => s.id === stopId);
    if (stop && stop.student_ids) {
      setAllocatedIds(new Set(stop.student_ids));
    } else {
      setAllocatedIds(new Set());
    }
  };

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string, student_ids: string[] }) =>
      api.put(`/transport/stops/${payload.id}`, { student_ids: payload.student_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-stops"] });
      toast.success("Allocations updated successfully");
    },
    onError: () => toast.error("Failed to update allocations"),
  });

  const toggleStudent = (studentId: string) => {
    setAllocatedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    if (!selectedStopId) return;
    updateMutation.mutate({
      id: selectedStopId,
      student_ids: Array.from(allocatedIds)
    });
  };

  const filteredStudents = (students || []).filter((s: Student) =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Transport Allocation"
        subtitle={`${allocatedIds.size} ${allocatedIds.size === 1 ? "student" : "students"} allocated to the selected pickup point`}
        actions={
          <Button onClick={handleSave} disabled={!selectedStopId || updateMutation.isPending}>
            {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Allocations
          </Button>
        }
      />
      <AOSPageBody>
        <div className="grid md:grid-cols-3 gap-4">
          <DataPanel title="Select Stop" className="md:col-span-1 h-fit">
            <p className="text-xs mb-4" style={{ color: "var(--w11-text-secondary)" }}>
              Choose a route and stop to view/edit allocations
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Route</Label>
                <Select value={selectedRouteId} onValueChange={(val) => {
                  setSelectedRouteId(val);
                  setSelectedStopId("");
                  setAllocatedIds(new Set());
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Route" />
                  </SelectTrigger>
                  <SelectContent>
                    {(routes || []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pickup Point</Label>
                <Select value={selectedStopId} onValueChange={handleStopChange} disabled={!selectedRouteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Pickup Point" />
                  </SelectTrigger>
                  <SelectContent>
                    {(stops || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStopId && (
                <div className="pt-4 border-t border-[var(--w11-border-subtle)] mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>Currently Allocated:</span>
                    <span className="win11-chip subtle text-sm">
                      {allocatedIds.size} Students
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel
            className="md:col-span-2"
            bodyClassName="p-0"
            title="Student List"
            actions={
              <div className="relative max-w-sm">
                <Input
                  placeholder="Search students..."
                  className="h-9 w-56"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            {studentsLoading ? (
              <div className="py-8 flex justify-center"><Spinner /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student: Student) => {
                    const isAllocated = allocatedIds.has(student.id);
                    return (
                      <TableRow
                        key={student.id}
                        className={`cursor-pointer ${isAllocated ? 'bg-[var(--w11-control-hover)]' : ''}`}
                        onClick={() => {
                          if (selectedStopId) toggleStudent(student.id);
                        }}
                      >
                        <TableCell>
                          {isAllocated ? (
                            <CheckSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
                          ) : (
                            <Square className="h-5 w-5" style={{ color: "var(--w11-text-secondary)" }} />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell style={{ color: "var(--w11-text-secondary)" }}>{student.admission_number}</TableCell>
                        <TableCell>
                          {student.class_name ? `${student.class_name} ${student.section_name || ''}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
                        No students found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
