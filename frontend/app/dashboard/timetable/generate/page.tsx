"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { Wand2, CheckCircle, Calendar, AlertCircle } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
}

interface GenerateResult {
  status: string;
  slots_created: number;
  message?: string;
}

export default function TimetableGeneratePage() {
  return (
    <PluginGate slug="timetable">
      <GenerateContent />
    </PluginGate>
  );
}

function GenerateContent() {
  const [classId, setClassId] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes-for-timetable"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClassItem[]>>("/academics/classes");
      return res.data.data ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<GenerateResult>>("/timetable/generate", {
        class_id: classId || undefined,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data ?? null);
      toast.success(`Timetable generated: ${data?.slots_created ?? 0} slots created`);
    },
    onError: () => toast.error("Failed to generate timetable"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6" /> AI Timetable Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Automatically generate optimized timetables using AI — considers teacher availability,
          subject load, and room constraints.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generation Options</CardTitle>
          <CardDescription>Select scope for timetable generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Class (optional — leave blank to generate for all classes)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Classes</SelectItem>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium">What the AI considers:</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Teacher weekly subject load and availability</li>
              <li>No teacher double-booking across classes</li>
              <li>Subject distribution across days (no clustering)</li>
              <li>Free periods and break times</li>
              <li>Room/lab availability for specialized subjects</li>
            </ul>
          </div>

          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <><Spinner size="sm" className="mr-2" /> Generating...</>
              : <><Wand2 className="h-4 w-4 mr-2" /> Generate Timetable</>}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3 items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-400">
                  Timetable Generated Successfully
                </p>
                <p className="text-sm text-green-700 dark:text-green-500 mt-1">
                  {result.slots_created} time slots created.
                  {result.message && ` ${result.message}`}
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href="/dashboard/timetable">
                    <Calendar className="h-3.5 w-3.5 mr-2" /> View Timetable
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info note */}
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Generating a timetable will replace any existing auto-generated slots for the selected class.
              Manually created or locked slots will not be affected. Review the result in the Timetable view before publishing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
