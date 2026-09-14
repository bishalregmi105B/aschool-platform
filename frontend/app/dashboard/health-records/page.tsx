"use client";

/**
 * Health Records — hub (A5 launcher) + per-student drill (A2, spec:
 * per-student tabs [Visits | Immunizations | Profile]).
 *
 * Research notes: (1) school-nurse record UX works when the student is the
 * unit of navigation — the registry picks the student, the tabs show their
 * history; (2) health data needs the same confidentiality framing as
 * wellbeing, and raw student-ID text inputs are the #1 source of mis-filed
 * records (replaced with the searchable EntityPicker).
 *
 * The per-student view is URL-addressable via ?student=<id> (useUrlFilters)
 * instead of a new dynamic route, so the auto-generated AOSRouteTable keeps
 * resolving it. Note: the plan's "Incidents" tab has no health-records API
 * (incidents live in their own module) — flagged; Profile is the third tab.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FormSection,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader, EditableField } from "@/components/aos/kit/detail-kit";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { HeartPulse, ShieldCheck, Syringe, Stethoscope, Users, PlusCircle, AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";

export default function HealthRecordsPage() {
  return (
    <AppGate slug="health_records">
      <HealthRecordsContent />
    </AppGate>
  );
}

function HealthRecordsContent() {
  const { t } = useI18n();
  const { values, setValues } = useUrlFilters(["student", "tab"]);
  const studentId = values.student || "";

  if (studentId) return <StudentHealthView studentId={studentId} onBack={() => setValues({ student: "", tab: "" })} />;
  return <RegistryView t={t} onOpenStudent={(id) => setValues({ student: id, tab: "visits" })} />;
}

/* ── Registry (school-wide lists + student picker drill) ─────────────────── */

function RegistryView({ t, onOpenStudent }: { t: (en: string, ne: string) => string; onOpenStudent: (id: string) => void }) {
  const { values, setValues } = useUrlFilters(["tab"]);
  const tab = values.tab || "visits";
  const { isError, refetch, data: visits, isLoading } = useQuery<any>({
    queryKey: ["health-visits"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/visits?per_page=100");
      return (res.data.data as any[]) || [];
    },
  });

  const { data: immunizations } = useQuery<any>({
    queryKey: ["health-immunizations"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/health-records/immunizations?per_page=100");
      return (res.data.data as any[]) || [];
    },
  });

  const { data: profiles } = useQuery<any>({
    queryKey: ["health-profiles"],
    queryFn: async () => (await api.get("/health-records/profiles?per_page=100")).data?.data || [],
  });

  const [showVisit, setShowVisit] = useState(false);
  const queryClient = useQueryClient();
  const createVisitMut = useMutation({
    mutationFn: async (data: Record<string, string>) => (await api.post<ApiResponse>("/health-records/visits", data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-visits"] });
      setShowVisit(false);
      toast.success(t("Visit recorded", "भ्रमण रेकर्ड भयो"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to record visit", "रेकर्ड गर्न असफल")),
  });

  const HUB_VISIT_COLUMNS: Column<any>[] = [
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (v) => v.student_name ?? "", render: (v) => <span className="font-medium">{v.student_name || v.student_id}</span> },
    { key: "visit_date", label: t("Date", "मिति"), sortable: true, value: (v) => v.visit_date ?? "", render: (v) => displayBS(v.visit_date) },
    { key: "reason", label: t("Reason", "कारण"), value: (v) => v.reason ?? "" },
    { key: "diagnosis", label: t("Diagnosis", "निदान"), value: (v) => v.diagnosis ?? "" },
    { key: "treatment", label: t("Treatment", "उपचार"), value: (v) => v.treatment ?? "" },
  ];

  const HUB_IMMUNIZATION_COLUMNS: Column<any>[] = [
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (i) => i.student_name ?? "", render: (i) => <span className="font-medium">{i.student_name || i.student_id}</span> },
    { key: "vaccine_name", label: t("Vaccine", "खोप"), sortable: true, value: (i) => i.vaccine_name ?? "" },
    { key: "dose_number", label: t("Dose", "डोज"), align: "center", sortable: true, value: (i) => i.dose_number ?? 0, render: (i) => <StatusChip status="active" label={`# ${i.dose_number}`} /> },
    { key: "date_administered", label: t("Date", "मिति"), sortable: true, value: (i) => i.date_administered ?? "", render: (i) => (i.date_administered ? displayBS(i.date_administered) : "—") },
  ];

  const PROFILE_COLUMNS: Column<any>[] = [
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (p) => p.student_name ?? "", render: (p) => <span className="font-medium">{p.student_name || p.student_id}</span> },
    { key: "blood_group", label: t("Blood group", "रगत समूह"), sortable: true, value: (p) => p.blood_group ?? "", render: (p) => <StatusChip status="subtle" label={p.blood_group || "—"} /> },
    {
      key: "allergies",
      label: t("Allergies", "एलर्जी"),
      value: (p) => (Array.isArray(p.allergies) ? p.allergies.join(", ") : ""),
      render: (p) =>
        Array.isArray(p.allergies) && p.allergies.length ? (
          <StatusChip status="overdue" label={`${p.allergies.length} recorded`} />
        ) : (
          <span className="text-xs" style={{ color: "var(--w11-text-tertiary)" }}>{t("None", "कुनै छैन")}</span>
        ),
    },
    {
      key: "medical_conditions",
      label: t("Conditions", "रोगहरू"),
      value: (p) => (Array.isArray(p.medical_conditions) ? p.medical_conditions.join(", ") : ""),
      render: (p) => <span className="text-sm">{Array.isArray(p.medical_conditions) && p.medical_conditions.length ? p.medical_conditions.join(", ") : "—"}</span>,
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label={t("Loading health records…", "स्वास्थ्य रेकर्ड लोड हुँदैछ…")} />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title="Health Records" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load data. Please try again.", "लोड गर्न असफल।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
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
        subtitle={t(
          `${visits?.length ?? 0} visits · ${immunizations?.length ?? 0} immunizations · click a row to open the student`,
          `स्वास्थ्य रेकर्ड`
        )}
        actions={
          <Button onClick={() => setShowVisit(true)}>
            <PlusCircle className="h-4 w-4 mr-2" /> {t("Record Visit", "भ्रमण रेकर्ड")}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="win11-infobar warning mb-4 flex items-start gap-2" role="note">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-[13px]">
            {t(
              "Health records are confidential to authorized staff. Do not open student records on shared screens.",
              "स्वास्थ्य रेकर्ड अधिकृत कर्मचारीका लागि मात्र गोपनीय छ।"
            )}
          </p>
        </div>

        <StatGrid>
          <KpiCard label={t("Medical Visits", "चिकित्सा भ्रमण")} value={visits?.length ?? "—"} icon={<Stethoscope className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label={t("Immunizations", "खोप")} value={immunizations?.length ?? "—"} color="#107c10" icon={<Syringe className="h-4 w-4" style={{ color: "#107c10" }} />} />
          <KpiCard label={t("Students Seen", "भेटिएका विद्यार्थी")} value={visits ? new Set(visits.map((v: any) => v.student_id)).size : "—"} icon={<Users className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />} />
          <KpiCard label={t("Allergy Registry", "एलर्जी दर्ता")} value={profiles ? (profiles as any[]).filter((p) => Array.isArray(p.allergies) && p.allergies.length).length : "—"} color="#d83b01" icon={<AlertTriangle className="h-4 w-4" style={{ color: "#d83b01" }} />} />
        </StatGrid>

        <QuickLinks
          section="Student Life"
          links={[
            { label: t("Visits", "भ्रमणहरू"), href: "/dashboard/health-records/records", icon: "HeartPulse" },
            { label: t("Vaccinations", "खोपहरू"), href: "/dashboard/health-records/vaccinations", icon: "ShieldCheck" },
            { label: t("Allergies", "एलर्जी"), href: "/dashboard/health-records/allergies", icon: "AlertTriangle" },
          ]}
        />

        <Tabs value={tab} onValueChange={(v) => setValues({ tab: v })}>
          <TabsList>
            <TabsTrigger value="visits" badge={visits?.length}>
              <Stethoscope className="h-4 w-4" /> {t("Visits", "भ्रमणहरू")}
            </TabsTrigger>
            <TabsTrigger value="immunizations" badge={immunizations?.length}>
              <Syringe className="h-4 w-4" /> {t("Immunizations", "खोपहरू")}
            </TabsTrigger>
            <TabsTrigger value="profiles" badge={profiles?.length}>
              <ShieldCheck className="h-4 w-4" /> {t("Profiles", "प्रोफाइलहरू")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visits">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={HUB_VISIT_COLUMNS}
                rows={visits ?? []}
                rowKey={(v: any) => v.id}
                onRowClick={(v: any) => v.student_id && onOpenStudent(v.student_id)}
                searchable
                searchPlaceholder={t("Search visits…", "भ्रमण खोज्नुहोस्…")}
                exportFileName="health-visits"
                empty={{ icon: Stethoscope, title: t("No visits recorded", "कुनै भ्रमण छैन"), body: t("Record a visit to start health histories.", "भ्रमण रेकर्ड गर्नुहोस्।") }}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="immunizations">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={HUB_IMMUNIZATION_COLUMNS}
                rows={immunizations ?? []}
                rowKey={(i: any) => i.id}
                onRowClick={(i: any) => i.student_id && onOpenStudent(i.student_id)}
                searchable
                searchPlaceholder={t("Search immunizations…", "खोप खोज्नुहोस्…")}
                exportFileName="immunizations"
                empty={{ icon: Syringe, title: t("No immunizations recorded", "कुनै खोप छैन"), body: t("Record vaccinations to keep histories complete.", "खोप रेकर्ड गर्नुहोस्।") }}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="profiles">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={PROFILE_COLUMNS}
                rows={profiles ?? []}
                rowKey={(p: any) => p.student_id}
                onRowClick={(p: any) => p.student_id && onOpenStudent(p.student_id)}
                searchable
                searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
                exportFileName="health-profiles"
                empty={{ icon: ShieldCheck, title: t("No health profiles yet", "कुनै प्रोफाइल छैन"), body: t("Profiles are created when you record allergies or a visit.", "एलर्जी रेकर्ड गर्दा प्रोफाइल बन्छ।") }}
              />
            </DataPanel>
          </TabsContent>
        </Tabs>
      </AOSPageBody>

      <RecordVisitDialog open={showVisit} onOpenChange={setShowVisit} onSubmit={(d) => createVisitMut.mutate(d)} pending={createVisitMut.isPending} />
    </AOSPage>
  );
}

/* ── Per-student A2 view: ObjectHeader + [Visits|Immunizations|Profile] ──── */

function StudentHealthView({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "visits");
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["health-profile-student", studentId],
    queryFn: async () => (await api.get(`/health-records/students/${studentId}`)).data?.data as any,
  });

  const { data: visits, isLoading: visitsLoading } = useQuery({
    queryKey: ["health-visits", studentId],
    queryFn: async () => (await api.get(`/health-records/visits?student_id=${studentId}`)).data?.data || [],
  });

  const { data: immunizations, isLoading: immLoading } = useQuery({
    queryKey: ["health-immunizations", studentId],
    queryFn: async () => (await api.get(`/health-records/immunizations?student_id=${studentId}`)).data?.data || [],
  });

  const [showVisit, setShowVisit] = useState(false);
  const createVisit = useMutation({
    mutationFn: async (data: Record<string, string>) => (await api.post("/health-records/visits", { ...data, student_id: studentId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-visits"] });
      setShowVisit(false);
      toast.success(t("Visit recorded", "भ्रमण रेकर्ड भयो"));
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => (await api.put(`/health-records/students/${studentId}`, patch)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-profile-student"] });
      queryClient.invalidateQueries({ queryKey: ["health-profiles"] });
      toast.success(t("Profile updated", "प्रोफाइल अद्यावधिक भयो"));
    },
    onError: () => toast.error(t("Failed to update profile", "अद्यावधिक असफल")),
  });

  const VISIT_COLUMNS: Column<any>[] = [
    { key: "visit_date", label: t("Date", "मिति"), sortable: true, value: (v) => v.visit_date ?? "", render: (v) => displayBS(v.visit_date) },
    { key: "reason", label: t("Reason", "कारण"), value: (v) => v.reason ?? "" },
    { key: "diagnosis", label: t("Diagnosis", "निदान"), value: (v) => v.diagnosis ?? "", render: (v) => v.diagnosis || "—" },
    { key: "treatment", label: t("Treatment", "उपचार"), value: (v) => v.treatment ?? "", render: (v) => v.treatment || "—" },
  ];

  const IMM_COLUMNS: Column<any>[] = [
    { key: "vaccine_name", label: t("Vaccine", "खोप"), sortable: true, value: (i) => i.vaccine_name ?? "" },
    { key: "dose_number", label: t("Dose", "डोज"), align: "center", value: (i) => i.dose_number ?? 0, render: (i) => <StatusChip status="active" label={`# ${i.dose_number}`} /> },
    { key: "date_administered", label: t("Given", "दिएको"), sortable: true, value: (i) => i.date_administered ?? "", render: (i) => (i.date_administered ? displayBS(i.date_administered) : "—") },
    { key: "next_due_date", label: t("Next due", "अर्को"), value: (i) => i.next_due_date ?? "", render: (i) => (i.next_due_date ? <StatusChip status="due" label={displayBS(i.next_due_date)} /> : "—") },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<HeartPulse className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Student Health Record", "विद्यार्थी स्वास्थ्य रेकर्ड")}
        actions={
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t("All records", "सबै रेकर्ड")}
          </Button>
        }
      />
      <AOSPageBody>
        {profileLoading ? (
          <Skeleton className="h-24 w-full mb-4" />
        ) : (
          <ObjectHeader
            className="mb-4"
            name={profile?.student_name || studentId}
            code={studentId.slice(0, 8)}
            codeLabel={t("Student", "विद्यार्थी")}
            status={profile?.exists === false ? "pending" : "active"}
            meta={
              <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                {profile?.blood_group && <StatusChip status="subtle" label={profile.blood_group} />}
                {Array.isArray(profile?.allergies) && profile.allergies.length > 0 && (
                  <StatusChip status="overdue" label={`${profile.allergies.length} ${t("allergies", "एलर्जी")}`} />
                )}
              </div>
            }
            actions={
              <Button size="sm" onClick={() => setShowVisit(true)}>
                <PlusCircle className="h-4 w-4 mr-2" /> {t("Record Visit", "भ्रमण")}
              </Button>
            }
          />
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="visits" badge={(visits || []).length}>{t("Visits", "भ्रमणहरू")}</TabsTrigger>
            <TabsTrigger value="immunizations" badge={(immunizations || []).length}>{t("Immunizations", "खोपहरू")}</TabsTrigger>
            <TabsTrigger value="profile">{t("Profile", "प्रोफाइल")}</TabsTrigger>
          </TabsList>

          <TabsContent value="visits">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={VISIT_COLUMNS}
                rows={visits || []}
                rowKey={(v: any) => v.id}
                loading={visitsLoading}
                empty={{ icon: Stethoscope, title: t("No visits for this student", "यस विद्यार्थीको भ्रमण छैन"), body: t("Record the first visit above.", "माथि पहिलो भ्रमण रेकर्ड गर्नुहोस्।") }}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="immunizations">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={IMM_COLUMNS}
                rows={immunizations || []}
                rowKey={(i: any) => i.id}
                loading={immLoading}
                empty={{ icon: Syringe, title: t("No immunizations recorded", "खोप रेकर्ड छैन"), body: t("Add them from the Vaccinations page.", "खोप पानाबाट थप्नुहोस्।") }}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="profile">
            <FormSection title={t("Health profile", "स्वास्थ्य प्रोफाइल")}>
              {profileLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Blood group", "रगत समूह")}>
                    <EditableField
                      value={profile?.blood_group}
                      aria-label={t("Blood group", "रगत समूह")}
                      onSave={(v) => saveProfile.mutateAsync({ blood_group: v })}
                      placeholder={t("Not recorded", "रेकर्ड छैन")}
                    />
                  </Field>
                  <Field label={t("Height (cm)", "उचाइ (सेमि)")}>
                    <EditableField
                      value={profile?.height_cm != null ? String(profile.height_cm) : ""}
                      inputType="number"
                      aria-label={t("Height", "उचाइ")}
                      onSave={(v) => saveProfile.mutateAsync({ height_cm: v ? Number(v) : null })}
                    />
                  </Field>
                  <Field label={t("Weight (kg)", "तौल (किलो)")}>
                    <EditableField
                      value={profile?.weight_kg != null ? String(profile.weight_kg) : ""}
                      inputType="number"
                      aria-label={t("Weight", "तौल")}
                      onSave={(v) => saveProfile.mutateAsync({ weight_kg: v ? Number(v) : null })}
                    />
                  </Field>
                  <Field label={t("Emergency phone", "आपतकालीन फोन")}>
                    <EditableField
                      value={profile?.emergency_phone}
                      aria-label={t("Emergency phone", "आपतकालीन फोन")}
                      onSave={(v) => saveProfile.mutateAsync({ emergency_phone: v })}
                    />
                  </Field>
                  <Field label={t("Allergies", "एलर्जी")} full>
                    <p className="text-sm">
                      {Array.isArray(profile?.allergies) && profile.allergies.length
                        ? profile.allergies.join(", ")
                        : t("None recorded — manage on the Allergies page.", "रेकर्ड छैन।")}
                    </p>
                  </Field>
                  <Field label={t("Medical conditions", "स्वास्थ्य अवस्था")} full>
                    <p className="text-sm">
                      {Array.isArray(profile?.medical_conditions) && profile.medical_conditions.length
                        ? profile.medical_conditions.join(", ")
                        : t("None recorded.", "रेकर्ड छैन।")}
                    </p>
                  </Field>
                </div>
              )}
            </FormSection>
          </TabsContent>
        </Tabs>
      </AOSPageBody>

      <RecordVisitDialog
        open={showVisit}
        onOpenChange={setShowVisit}
        fixedStudentId={studentId}
        onSubmit={(d) => createVisit.mutate(d)}
        pending={createVisit.isPending}
      />
    </AOSPage>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <p className="text-[12px] font-medium" style={{ color: "var(--w11-text-secondary)" }}>{label}</p>
      <div className="text-sm" style={{ color: "var(--w11-text-primary)" }}>{children}</div>
    </div>
  );
}

/* Shared Record-Visit dialog (EntityPicker instead of raw student-id input). */
function RecordVisitDialog({
  open,
  onOpenChange,
  fixedStudentId,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedStudentId?: string;
  onSubmit: (data: Record<string, string>) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState(fixedStudentId || "");
  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Record Medical Visit", "चिकित्सा भ्रमण रेकर्ड")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!fixedStudentId && (
            <div className="space-y-2">
              <Label>{t("Student", "विद्यार्थी")}</Label>
              <EntityPicker
                value={studentId}
                onChange={setStudentId}
                query={{ path: "/students", searchKey: "q", perPage: 20 }}
                getOptions={(rows) =>
                  (rows as any[]).map((s) => ({
                    value: s.id,
                    label: s.full_name || `${s.first_name} ${s.last_name}`,
                    ne: s.full_name_nepali,
                  }))
                }
                placeholder={t("Search student…", "विद्यार्थी खोज्नुहोस्…")}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Visit date", "भ्रमण मिति")}</Label>
              <BSDateInput value={visitDate} onChange={setVisitDate} />
            </div>
            <div className="space-y-2">
              <Label>{t("Reason", "कारण")} *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Fever, injury…", "ज्वरो…")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("Diagnosis", "निदान")}</Label>
            <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>{t("Treatment", "उपचार")}</Label>
            <Textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "रद्द")}</Button>
          <Button
            onClick={() =>
              onSubmit({
                student_id: fixedStudentId || studentId,
                visit_date: visitDate,
                reason,
                diagnosis,
                treatment,
              })
            }
            disabled={!(fixedStudentId || studentId) || !reason || pending}
          >
            {pending ? <Spinner className="mr-2" /> : null}
            {t("Save Visit", "भ्रमण सुरक्षित")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
