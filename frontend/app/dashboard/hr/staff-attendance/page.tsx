"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Calendar, Save, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface AttendanceRecord {
  user_id: string;
  status: "present" | "absent" | "late" | "half_day" | "excused";
  check_in_time?: string;
  check_out_time?: string;
}

export default function StaffAttendancePage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  
  const queryClient = useQueryClient();

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      // Fetch both teachers and staff
      const [teachersRes, staffRes] = await Promise.all([
        api.get<ApiResponse<User[]>>("/users?role=teacher&limit=100"),
        api.get<ApiResponse<User[]>>("/users?role=staff&limit=100")
      ]);
      return [...(teachersRes.data.data || []), ...(staffRes.data.data || [])];
    },
  });

  const { data: attendanceData, isLoading: attLoading } = useQuery({
    queryKey: ["staff-attendance", date],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(`/attendance/teachers/list?date=${date}`);
      
      // Pre-fill local state
      const newRecords: Record<string, AttendanceRecord> = {};
      (res.data.data || []).forEach(record => {
        newRecords[record.user_id] = {
          user_id: record.user_id,
          status: record.status as any,
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
        };
      });
      setRecords(newRecords);
      return res.data.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post("/attendance/teachers/mark", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", date] });
      toast.success("Attendance saved successfully");
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  const handleStatusChange = (userId: string, status: AttendanceRecord["status"]) => {
    setRecords(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, status }
    }));
  };

  const markAll = (status: AttendanceRecord["status"]) => {
    const newRecords = { ...records };
    (staffData || []).forEach(staff => {
      newRecords[staff.id] = { ...newRecords[staff.id], user_id: staff.id, status };
    });
    setRecords(newRecords);
  };

  const handleSave = () => {
    const payloadRecords = Object.values(records);
    if (payloadRecords.length === 0) {
      toast.error("No attendance changes to save");
      return;
    }
    
    saveMutation.mutate({
      date,
      records: payloadRecords
    });
  };

  if (staffLoading || attLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Staff Attendance
          </h1>
          <p className="text-muted-foreground">Mark daily attendance for teachers and staff</p>
        </div>
        <div className="flex items-center gap-4">
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Attendance
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => markAll("present")}>
                      Mark All Present
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
                      Mark All Absent
                    </Button>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(staffData || []).map((staff) => {
                const record = records[staff.id] || { status: "absent" };
                
                return (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.full_name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{staff.role.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Input 
                        type="time" 
                        value={record.check_in_time || ""} 
                        onChange={(e) => setRecords(prev => ({
                          ...prev,
                          [staff.id]: { ...prev[staff.id], user_id: staff.id, check_in_time: e.target.value }
                        }))}
                        className="w-32 h-8" 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="time" 
                        value={record.check_out_time || ""} 
                        onChange={(e) => setRecords(prev => ({
                          ...prev,
                          [staff.id]: { ...prev[staff.id], user_id: staff.id, check_out_time: e.target.value }
                        }))}
                        className="w-32 h-8" 
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant={record.status === "present" ? "default" : "outline"}
                          size="sm"
                          className={record.status === "present" ? "bg-green-600 hover:bg-green-700" : ""}
                          onClick={() => handleStatusChange(staff.id, "present")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Present
                        </Button>
                        <Button 
                          variant={record.status === "absent" ? "default" : "outline"}
                          size="sm"
                          className={record.status === "absent" ? "bg-red-600 hover:bg-red-700" : ""}
                          onClick={() => handleStatusChange(staff.id, "absent")}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Absent
                        </Button>
                        <Button 
                          variant={record.status === "late" ? "default" : "outline"}
                          size="sm"
                          className={record.status === "late" ? "bg-amber-500 hover:bg-amber-600" : ""}
                          onClick={() => handleStatusChange(staff.id, "late")}
                        >
                          <Clock className="h-4 w-4 mr-1" /> Late
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!staffData || staffData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No staff members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
