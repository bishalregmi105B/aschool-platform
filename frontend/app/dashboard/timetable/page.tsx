"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Wand2 } from "lucide-react";

interface TimetableSlot {
  id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetablePage() {
  return (
    <PluginGate slug="timetable">
      <TimetableContent />
    </PluginGate>
  );
}

function TimetableContent() {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/academics/classes");
      return (res.data.data as Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>) || [];
    },
  });

  const selectedClass = classes?.find(c => c.id === classId);

  const { data: slots, isLoading } = useQuery({
    queryKey: ["timetable", classId, sectionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);
      const res = await api.get<ApiResponse>(`/timetable?${params}`);
      return (res.data.data as TimetableSlot[]) || [];
    },
    enabled: !!classId,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse>("/timetable/generate", { periods_per_day: 8 });
      return res.data.data;
    },
    onSuccess: () => toast.success("Timetable generated!"),
    onError: () => toast.error("Generation failed"),
  });

  // Group slots by day
  const grouped: Record<string, TimetableSlot[]> = {};
  DAYS.forEach(d => { grouped[d] = []; });
  slots?.forEach(s => {
    if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
  });

  const maxPeriods = Math.max(8, ...Object.values(grouped).map(arr => arr.length));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">View and auto-generate school timetables</p>
        </div>
        <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
          <Wand2 className="h-4 w-4 mr-2" /> {generateMut.isPending ? "Generating..." : "Auto Generate"}
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>
            {classes?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClass && (
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select Section" /></SelectTrigger>
            <SelectContent>
              {selectedClass.sections?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? <PageLoader /> : classId && (
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted text-left">Day / Period</th>
                  {Array.from({ length: maxPeriods }, (_, i) => (
                    <th key={i} className="border p-2 bg-muted text-center">P{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="border p-2 font-medium bg-muted/50">{day}</td>
                    {Array.from({ length: maxPeriods }, (_, i) => {
                      const slot = grouped[day]?.find(s => s.period_number === i + 1);
                      return (
                        <td key={i} className="border p-2 text-center text-xs">
                          {slot ? (
                            <div>
                              <p className="font-medium">{slot.subject_name || "Subject"}</p>
                              <p className="text-muted-foreground">{slot.teacher_name || ""}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
