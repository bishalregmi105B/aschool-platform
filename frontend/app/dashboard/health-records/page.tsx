"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { HeartPulse, ShieldCheck, Syringe, Stethoscope, Users, PlusCircle, AlertTriangle } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
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

  // Both lists load up front — the KPI hub above the tabs summarizes them
  // (previously each query was tab-gated and only fetched on its own tab).
  const { isError, refetch, data: visits, isLoading } = useQuery<any>({
    queryKey: ["health-visits"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/visits");
      return (res.data.data as MedicalVisit[]) || [];
    },
  });

  const { data: immunizations } = useQuery<any>({
    queryKey: ["health-immunizations"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/immunizations");
      return (res.data.data as Array<{ id: string; student_id: string; vaccine_name: string; dose_number: number; date_administered: string }>) || [];
    },
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

  const HUB_VISIT_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (v) => v.student_name ?? "", render: (v) => v.student_name || v.student_id },
    { key: "visit_date", label: "Date", sortable: true, value: (v) => v.visit_date ?? "", render: (v) => displayBS(v.visit_date) },
    { key: "reason", label: "Reason", value: (v) => v.reason ?? "" },
    { key: "diagnosis", label: "Diagnosis", value: (v) => v.diagnosis ?? "" },
    { key: "treatment", label: "Treatment", value: (v) => v.treatment ?? "" },
  ];

  const HUB_IMMUNIZATION_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (i) => i.student_name ?? "", render: (i) => i.student_name || i.student_id },
    { key: "vaccine_name", label: "Vaccine", sortable: true, value: (i) => i.vaccine_name ?? "", render: (i) => <span className="font-medium">{i.vaccine_name}</span> },
    { key: "dose_number", label: "Dose", align: "center", sortable: true, value: (i) => i.dose_number ?? 0, render: (i) => <span className="win11-chip subtle">Dose {i.dose_number}</span> },
    { key: "date_administered", label: "Date", sortable: true, value: (i) => i.date_administered ?? "" },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading health records…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Health Records" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }


  return (
    <AOSPage>
      <AOSPageHeader
        icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Health Records"
        subtitle={`Student health profiles, medical visits, immunizations · ${tab === "visits" ? `${visits?.length ?? 0} visits` : `${immunizations?.length ?? 0} immunizations`}`}
        actions={
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
        }
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real counts from the data this page already loads */}
        <StatGrid>
          <KpiCard
            label="Medical Visits"
            value={visits?.length ?? "—"}
            icon={<Stethoscope className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Immunizations"
            value={immunizations?.length ?? "—"}
            color="#107c10"
            icon={<Syringe className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Students Seen"
            value={visits ? new Set(visits.map((v: any) => v.student_id)).size : "—"}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label="Vaccines"
            value={immunizations ? new Set(immunizations.map((i: any) => i.vaccine_name)).size : "—"}
            color="#d83b01"
            icon={<ShieldCheck className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
        </StatGrid>

        {/* Quick links — every health-records subpage from the plugin manifest */}
        <QuickLinks
          section="Student Life"
          links={[
            { label: "Records", href: "/dashboard/health-records/records", icon: "FileText" },
            { label: "Vaccinations", href: "/dashboard/health-records/vaccinations", icon: "ShieldCheck" },
            { label: "Allergies", href: "/dashboard/health-records/allergies", icon: "AlertTriangle" },
          ]}
        />

        <FilterCommandBar>
          <Button variant={tab === "visits" ? "default" : "outline"} onClick={() => setTab("visits")}>
            <Stethoscope className="h-4 w-4 mr-2" /> Medical Visits
          </Button>
          <Button variant={tab === "immunizations" ? "default" : "outline"} onClick={() => setTab("immunizations")}>
            <Syringe className="h-4 w-4 mr-2" /> Immunizations
          </Button>
        </FilterCommandBar>

        {tab === "visits" && (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={HUB_VISIT_COLUMNS}
              rows={visits ?? []}
              rowKey={(v: any) => v.id}
              searchable
              searchPlaceholder="Search visits…"
              exportFileName="health-visits"
            />
          </DataPanel>
        )}

        {tab === "immunizations" && (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={HUB_IMMUNIZATION_COLUMNS}
              rows={immunizations ?? []}
              rowKey={(imm: any) => imm.id}
              searchable
              searchPlaceholder="Search immunizations…"
              exportFileName="immunizations"
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
