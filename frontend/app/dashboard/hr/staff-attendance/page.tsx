"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Calendar, Save, CheckCircle, XCircle, Clock, UserCheck, ShieldCheck } from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";

import { BSDateInput } from "@/components/ui/bs-date-input";
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
  const { t } = useI18n();
  const confirm = useConfirm();
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [dirtyCount, setDirtyCount] = useState(0);

  const queryClient = useQueryClient();

  const { data: staffData, isLoading: staffLoading } = useQuery<any>({
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

  const { data: attendanceData, isLoading: attLoading } = useQuery<any>({
    queryKey: ["staff-attendance", date],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(`/attendance/teachers/list?date=${date}`);

      // Pre-fill local state
      const newRecords: Record<string, AttendanceRecord> = {};
      (res.data.data || []).forEach((record: any) => {
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
      setDirtyCount(0); toast.success(t("Attendance saved successfully", "हाजिर सुरक्ष भए।"));
    },
    onError: () => toast.error(t("Failed to save attendance", "सुरक्ष गरेन")),
  });

  const handleStatusChange = (userId: string, status: AttendanceRecord["status"]) => {
    setDirtyCount((n) => n + 1);
    setRecords(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, status }
    }));
  };

  const markAll = async (status: AttendanceRecord["status"]) => {
    // Absent-alls is the dangerous default — confirm like the student register.
    if (status === "absent") {
      const ok = await confirm({
        title: t("Mark everyone absent?", "सबैलाई अनुपस्थित लगाउने?"),
        body: t("This sets Absent for every teacher and staff member. Save to commit.", "सबैको अनुपस्थित लग्ने। सुरक्ष गर्नु नपरेदै।"),
        confirmLabel: t("Mark all absent", "सबै अनुपस्थित"),
        tone: "danger",
      });
      if (!ok) return;
    }
    const newRecords = { ...records };
    (staffData || []).forEach((staff: any) => {
      newRecords[staff.id] = { ...newRecords[staff.id], user_id: staff.id, status };
    });
    setRecords(newRecords);
    setDirtyCount((n) => n + (staffData || []).length);
  };

  const handleSave = () => {
    const payloadRecords = Object.values(records);
    if (payloadRecords.length === 0) {
      toast.error(t("No attendance changes to save", "कुनै परिवर्तन छेन"));
      return;
    }

    saveMutation.mutate({
      date,
      records: payloadRecords
    });
  };

  const loading = staffLoading || attLoading;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Staff Attendance", "कर्मचारी हाजिर")}
        subtitle={`${(staffData || []).length} ${t("teachers and staff · mark daily attendance", "शिक्षक र कर्मचारी · दैनिक हाजिर")} ${dirtyCount > 0 ? `· ${dirtyCount} ${t("unsaved changes", "नबुद्दे परिवर्तन")}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <BSDateInput
              value={date}
              onChange={setDate}
              className="w-auto"
            />
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("Save Attendance", "हाजिर सुरक्ष")}
            </Button>
          </div>
        }
      />
      <AOSPageBody>
        {loading ? (
          <div className="win11-card p-4"><SkeletonTable rows={8} columns={5} /></div>
        ) : (
        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Staff Member", "कर्मचारी")}</TableHead>
                <TableHead>{t("Role", "भूमिका")}</TableHead>
                <TableHead>{t("Check In", "आगम")}</TableHead>
                <TableHead>{t("Check Out", "निकल्न")}</TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => markAll("present")}>
                      {t("Mark All Present", "सबै उपस्थित")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
                      {t("Mark All Absent", "सबै अनुपस्थित")}
                    </Button>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(staffData || []).map((staff: any) => {
                const record = records[staff.id] || { status: "absent" };

                return (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.full_name}</TableCell>
                    <TableCell className="capitalize" style={{ color: "var(--w11-text-secondary)" }}>{staff.role.replace("_", " ")}</TableCell>
                    <TableCell>
                      <TimePicker
                        value={record.check_in_time || ""}
                        onChange={(v) => setRecords(prev => ({
                          ...prev,
                          [staff.id]: { ...prev[staff.id], user_id: staff.id, check_in_time: v }
                        }))}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <TimePicker
                        value={record.check_out_time || ""}
                        onChange={(v) => setRecords(prev => ({
                          ...prev,
                          [staff.id]: { ...prev[staff.id], user_id: staff.id, check_out_time: v }
                        }))}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant={record.status === "present" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStatusChange(staff.id, "present")}
                          style={record.status === "present" ? { backgroundColor: "#107c10" } : undefined}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> {t("Present", "उपस्थित")}
                        </Button>
                        <Button
                          variant={record.status === "absent" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStatusChange(staff.id, "absent")}
                          style={record.status === "absent" ? { backgroundColor: "#c42b1c" } : undefined}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> {t("Absent", "अनुपस्थित")}
                        </Button>
                        <Button
                          variant={record.status === "late" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStatusChange(staff.id, "late")}
                          style={record.status === "late" ? { backgroundColor: "#d83b01" } : undefined}
                        >
                          <Clock className="h-4 w-4 mr-1" /> {t("Late", "धेरो")}
                        </Button>
                        <Button
                          variant={record.status === "half_day" ? "default" : "outline"}
                          size="sm"
                          title={t("Half day", "अध्य दिन")}
                          onClick={() => handleStatusChange(staff.id, "half_day")}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={record.status === "excused" ? "default" : "outline"}
                          size="sm"
                          title={t("Excused", "क्षमा")}
                          onClick={() => handleStatusChange(staff.id, "excused")}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!staffData || staffData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
                    {t("No staff members found. Add staff first.", "कुनै कर्मचारी छेन — पहिले थप्नु।")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
