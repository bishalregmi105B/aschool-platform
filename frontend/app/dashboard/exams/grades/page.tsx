"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { Star } from "lucide-react";

/** Shape returned by GET /exams/grade-table (static NEB reference). */
interface Grade {
  grade: string;
  gpa: number;
  min_pct: number;
  description?: string;
}

export default function ExamGradesPage() {
  return (
    <PluginGate slug="exams">
      <ExamGradesContent />
    </PluginGate>
  );
}

function ExamGradesContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["exam-grades"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Grade[]>>("/exams/grade-table");
      return res.data.data ?? [];
    },
    retry: 1,
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load the grade table. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" /> Exam Grades</h1>
        <p className="text-muted-foreground">
          Nepal NEB grading scale — used automatically for marks entry, results and report cards
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            NEB Grading Scale (Letter Grade Directive 2078)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Min %</TableHead><TableHead>Grade Point (GPA)</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((g, i) => (
                <TableRow key={`${g.grade}-${i}`}>
                  <TableCell className="font-bold text-lg">{g.grade}</TableCell>
                  <TableCell>{g.min_pct}%</TableCell>
                  <TableCell><Badge>{g.gpa}</Badge></TableCell>
                  <TableCell>{g.description || "—"}</TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Grade table unavailable.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Grades and GPA are computed with this scale automatically — theory marks must be ≥ the
        pass threshold and practical marks ≥ 40% where a practical component exists.
      </p>
    </div>
  );
}
