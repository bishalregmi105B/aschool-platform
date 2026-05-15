"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { Calendar, Clock } from "lucide-react";

interface ExamScheduleItem {
  id: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  total_marks: number;
  pass_marks: number;
  room?: string;
}

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  status: string;
  schedules: ExamScheduleItem[];
}

export default function ExamSchedulePage() {
  return (
    <PluginGate slug="exams">
      <ExamScheduleContent />
    </PluginGate>
  );
}

function ExamScheduleContent() {
  const { data: exams, isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Schedule</h1>
        <p className="text-muted-foreground">View exam timetables and schedules</p>
      </div>

      {(exams || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No exams scheduled yet.</div>
      ) : (
        (exams || []).map((exam: Exam) => (
          <Card key={exam.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {exam.name}
                </CardTitle>
                <Badge variant={exam.status === "ongoing" ? "warning" : exam.status === "completed" ? "success" : "secondary"} className="capitalize">
                  {exam.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {exam.schedules?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Total Marks</TableHead>
                      <TableHead>Pass Marks</TableHead>
                      <TableHead>Room</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exam.schedules.map((s: ExamScheduleItem) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.subject_name}</TableCell>
                        <TableCell>{displayBS(s.exam_date)}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.start_time} - {s.end_time}
                        </TableCell>
                        <TableCell>{s.total_marks}</TableCell>
                        <TableCell>{s.pass_marks}</TableCell>
                        <TableCell>{s.room || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Schedule not yet assigned for this exam.</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
