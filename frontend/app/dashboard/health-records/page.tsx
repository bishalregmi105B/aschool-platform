"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { HeartPulse, Syringe, Stethoscope, PlusCircle } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
interface HealthProfile {
  id: string;
  student_id: string;
  blood_group: string;
  height_cm: number;
  weight_kg: number;
  allergies: string;
  medical_conditions: string;
  exists: boolean;
}

interface MedicalVisit {
  id: string;
  student_id: string;
  visit_date: string;
  reason: string;
  diagnosis: string;
  treatment: string;
}

export default function HealthRecordsPage() {
  return (
    <PluginGate slug="health_records">
      <HealthRecordsContent />
    </PluginGate>
  );
}

function HealthRecordsContent() {
  const [tab, setTab] = useState<"visits" | "immunizations">("visits");
  const [showVisit, setShowVisit] = useState(false);
  const queryClient = useQueryClient();

  const { data: visits, isLoading } = useQuery({
    queryKey: ["health-visits"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/visits");
      return (res.data.data as MedicalVisit[]) || [];
    },
    enabled: tab === "visits",
  });

  const { data: immunizations } = useQuery({
    queryKey: ["health-immunizations"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/immunizations");
      return (res.data.data as Array<{ id: string; student_id: string; vaccine_name: string; dose_number: number; date_administered: string }>) || [];
    },
    enabled: tab === "immunizations",
  });

  const createVisitMut = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await api.post<ApiResponse>("/health-records/visits", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-visits"] });
      setShowVisit(false);
      toast.success("Visit recorded");
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Records</h1>
          <p className="text-muted-foreground">Student health profiles, medical visits, immunizations</p>
        </div>
        <Dialog open={showVisit} onOpenChange={setShowVisit}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="h-4 w-4 mr-2" /> Record Visit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Medical Visit</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createVisitMut.mutate(Object.fromEntries(fd) as Record<string, string>);
            }} className="space-y-4">
              <Input name="student_id" placeholder="Student ID" required />
              <BSDateInput name="visit_date" required />
              <Input name="reason" placeholder="Reason for visit" required />
              <Textarea name="diagnosis" placeholder="Diagnosis" rows={2} />
              <Textarea name="treatment" placeholder="Treatment given" rows={2} />
              <Button type="submit" disabled={createVisitMut.isPending} className="w-full">
                {createVisitMut.isPending ? "Saving..." : "Save Visit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "visits" ? "default" : "outline"} onClick={() => setTab("visits")}>
          <Stethoscope className="h-4 w-4 mr-2" /> Medical Visits
        </Button>
        <Button variant={tab === "immunizations" ? "default" : "outline"} onClick={() => setTab("immunizations")}>
          <Syringe className="h-4 w-4 mr-2" /> Immunizations
        </Button>
      </div>

      {tab === "visits" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Treatment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits?.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>{v.student_id}</TableCell>
                    <TableCell>{v.visit_date}</TableCell>
                    <TableCell>{v.reason}</TableCell>
                    <TableCell>{v.diagnosis}</TableCell>
                    <TableCell>{v.treatment}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === "immunizations" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {immunizations?.map(imm => (
                  <TableRow key={imm.id}>
                    <TableCell>{imm.student_id}</TableCell>
                    <TableCell className="font-medium">{imm.vaccine_name}</TableCell>
                    <TableCell><Badge variant="outline">Dose {imm.dose_number}</Badge></TableCell>
                    <TableCell>{imm.date_administered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
