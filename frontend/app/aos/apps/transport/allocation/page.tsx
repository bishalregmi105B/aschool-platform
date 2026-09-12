"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Users, Search, Save, CheckSquare, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Transport Allocation
          </h1>
          <p className="text-muted-foreground">Assign students to specific pickup points</p>
        </div>
        <Button onClick={handleSave} disabled={!selectedStopId || updateMutation.isPending}>
          {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Allocations
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Select Stop</CardTitle>
            <CardDescription>Choose a route and stop to view/edit allocations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="pt-4 border-t mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Currently Allocated:</span>
                  <Badge variant="secondary" className="text-sm">
                    {allocatedIds.size} Students
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Student List</CardTitle>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                className="pl-10 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                        className={`cursor-pointer ${isAllocated ? 'bg-muted/50' : ''}`}
                        onClick={() => {
                          if (selectedStopId) toggleStudent(student.id);
                        }}
                      >
                        <TableCell>
                          {isAllocated ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{student.admission_number}</TableCell>
                        <TableCell>
                          {student.class_name ? `${student.class_name} ${student.section_name || ''}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
