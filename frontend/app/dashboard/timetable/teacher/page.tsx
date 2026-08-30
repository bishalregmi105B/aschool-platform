"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar, Clock } from "lucide-react";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

export default function TeacherTimetablePage() {
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const { data: staff, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["teachers-list"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/design-studio/data-sources/teacher/records?limit=100");
      return res.data.data;
    },
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["teacher-timetable", selectedTeacherId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/timetable", {
        params: { teacher_id: selectedTeacherId },
      });
      return res.data.data ?? [];
    },
    enabled: Boolean(selectedTeacherId),
  });

  const periodNumbers = Array.from(
    new Set(slots.map((slot) => Number(slot.period_number)).filter(Boolean))
  ).sort((a, b) => a - b);
  const periods = periodNumbers.length > 0 ? periodNumbers : [1, 2, 3, 4, 5, 6];

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load teacher list. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" /> Teacher Timetable
        </h1>
        <p className="text-muted-foreground">View and manage individual class schedules for teachers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Teacher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label>Teacher Name</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a teacher..." />
              </SelectTrigger>
              <SelectContent>
                {(staff || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTeacherId && (
        <Card className="overflow-hidden">
          {slotsLoading ? (
            <PageLoader />
          ) : slots.length === 0 ? (
            <CardContent className="py-10 text-center text-muted-foreground">
              No timetable slots assigned to this teacher.
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                <thead className="bg-muted text-muted-foreground uppercase">
                  <tr>
                    <th className="px-6 py-4 border font-medium"><Clock className="h-4 w-4 inline mr-2" /> Time / Day</th>
                    {periods.map((period) => (
                      <th key={period} className="px-6 py-4 border font-medium text-center">Period {period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day} className="bg-card hover:bg-muted/50 transition-colors border-b">
                      <td className="px-6 py-4 border font-medium bg-muted/20">{day}</td>
                      {periods.map((period) => {
                        const slot = slots.find(
                          (item) => item.day_of_week === day && Number(item.period_number) === period
                        );

                        return (
                          <td key={`${day}-${period}`} className="px-4 py-3 border text-center relative group">
                            {slot ? (
                              <div className="flex flex-col items-center justify-center p-2 rounded bg-primary/10 border border-primary/20">
                                <span className="font-semibold">
                                  {[slot.class_name, slot.section_name].filter(Boolean).join(" ") || "Assigned"}
                                </span>
                                <span className="text-xs text-muted-foreground">{slot.subject_name || slot.subject || "Subject"}</span>
                                {slot.time && <span className="text-[11px] text-muted-foreground">{slot.time}</span>}
                              </div>
                            ) : (
                              <div className="text-muted-foreground/50 text-xs">Free</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
