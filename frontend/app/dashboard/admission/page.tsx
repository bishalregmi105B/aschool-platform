"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatGrid,
  KpiCard,
  FormSection,
} from "@/components/aos/kit/page-kit";
import { PlusCircle, UserPlus, BarChart3, Eye, LayoutDashboard } from "lucide-react";

interface Inquiry {
  id: string;
  student_name: string;
  guardian_name: string;
  phone: string;
  class_applied: string;
  source: string;
  status: string;
  created_at: string;
}

interface Application {
  id: string;
  student_name: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  dob: string | null;
  gender: string;
  address: string;
  previous_school: string;
  class_applied: string;
  status: string;
  remarks: string;
  created_at: string;
  test_score?: number | null;
  interview_score?: number | null;
  merit_rank?: number | null;
  notes?: string | null;
  documents?: unknown[];
}

interface DashboardData {
  total_inquiries: number;
  pipeline: Record<string, number>;
}

const PIPELINE_STAGES = [
  "submitted", "under_review", "shortlisted", "interview",
  "accepted", "enrolled", "waitlisted", "rejected",
];

/** Sequential pipeline: the single next legal forward stage per status.
 * Mirrors the server-side transition rules in PUT /admission/applications/<id>/status
 * (backwards jumps and non-accepted → enrolled are rejected with 400). */
const NEXT_STAGE: Record<string, { status: string; label: string }> = {
  submitted: { status: "under_review", label: "Start Review" },
  under_review: { status: "shortlisted", label: "Shortlist" },
  shortlisted: { status: "interview", label: "Move to Interview" },
  interview: { status: "accepted", label: "Accept" },
  accepted: { status: "enrolled", label: "Enroll" },
  rejected: { status: "under_review", label: "Reopen Review" },
  waitlisted: { status: "under_review", label: "Reopen Review" },
};

/** Timeline shown in the detail dialog — the ordered happy path. */
const TIMELINE_STAGES = [
  "submitted", "under_review", "shortlisted", "interview", "accepted", "enrolled",
];

function statusLabel(s: string) {
  return (s || "").replace("_", " ");
}

export default function AdmissionPage() {
  return (
    <PluginGate slug="admission">
      <AdmissionContent />
    </PluginGate>
  );
}

function AdmissionContent() {
  const [tab, setTab] = useState<"dashboard" | "inquiries" | "applications">("dashboard");
  const [showInquiry, setShowInquiry] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  // Radix Select doesn't submit via FormData — track gender separately.
  const [newAppGender, setNewAppGender] = useState("");
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery({
    queryKey: ["admission-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/dashboard");
      return res.data.data as DashboardData;
    },
  });

  const { data: inquiries, isLoading: loadingInq } = useQuery({
    queryKey: ["admission-inquiries"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/inquiries");
      return (res.data.data as Inquiry[]) || [];
    },
    enabled: tab === "inquiries",
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ["admission-applications"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/applications");
      return (res.data.data as Application[]) || [];
    },
    enabled: tab === "applications",
  });

  // Full detail (test/interview scores, merit rank, notes, documents) for the
  // open dialog — served by GET /admission/applications/<id>.
  const detailQuery = useQuery({
    queryKey: ["admission-application", detailApp?.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(
        `/admission/applications/${detailApp!.id}`,
      );
      return res.data.data as Application;
    },
    enabled: !!detailApp,
  });
  // Only read while the dialog is open (detailApp non-null there).
  const detail: Application =
    (detailQuery.data as Application | undefined) || detailApp!;

  const createInquiryMut = useMutation({
    mutationFn: async (data: Partial<Inquiry>) => {
      const res = await api.post<ApiResponse>("/admission/inquiries", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-inquiries", "admission-dashboard"] });
      setShowInquiry(false);
      toast.success("Inquiry added");
    },
    onError: () => toast.error("Failed to add inquiry"),
  });

  const inquiryStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put<ApiResponse>(`/admission/inquiries/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-inquiries", "admission-dashboard"] });
      toast.success("Inquiry updated");
    },
    onError: () => toast.error("Failed to update inquiry"),
  });

  const convertMut = useMutation({
    mutationFn: async (inq: any) => {
      const res = await api.post<ApiResponse>("/admission/applications", {
        student_name: inq.student_name,
        guardian_name: inq.guardian_name,
        guardian_phone: inq.phone,
        class_applied: inq.class_applied || "",
        inquiry_id: inq.id,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-inquiries", "admission-applications", "admission-dashboard"] });
      toast.success("Converted to application — manage it in the Applications tab");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to convert"),
  });

  const createApplicationMut = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await api.post<ApiResponse>("/admission/applications", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-applications", "admission-dashboard"] });
      setShowApplication(false);
      toast.success("Application created");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to create application"),
  });

  // Moving straight to "enrolled" from a non-accepted state would create NO
  // student record (the auto-creation listener only fires on "accepted"), so
  // first PUT "accepted" then "enrolled" — two sequential requests.
  const statusMut = useMutation({
    mutationFn: async ({ id, status, current }: { id: string; status: string; current: string }) => {
      if (status === "enrolled" && current !== "accepted") {
        await api.put<ApiResponse>(`/admission/applications/${id}/status`, { status: "accepted" });
      }
      const res = await api.put<ApiResponse>(`/admission/applications/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admission-applications", "admission-dashboard"] });
      toast.success(
        vars.status === "enrolled" && vars.current !== "accepted"
          ? "Student accepted first (a Student record + login are auto-created at the Accepted stage), then enrolled"
          : "Status updated",
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to update status"),
  });

  const pipeline = dashboard?.pipeline || {};
  const inquiryStages = ["new", "contacted", "followed_up", "converted", "lost"];

  const INQUIRY_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (i) => i.student_name ?? "", render: (i) => <span className="font-medium">{i.student_name}</span> },
    { key: "guardian_name", label: "Guardian", value: (i) => i.guardian_name ?? "" },
    { key: "phone", label: "Phone", value: (i) => i.phone ?? "" },
    { key: "class_applied", label: "Class", sortable: true, value: (i) => i.class_applied ?? "" },
    { key: "source", label: "Source", sortable: true, value: (i) => i.source ?? "" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (i) => i.status ?? "",
      render: (i) => (
        <AdvancedSelect
          className="w-36"
          triggerClassName="h-8 text-xs"
          value={i.status}
          onChange={(val) => inquiryStatusMut.mutate({ id: i.id, status: val })}
          options={inquiryStages.map((st) => ({ value: st, label: statusLabel(st) }))}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (i) =>
        i.status !== "converted" ? (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); convertMut.mutate(i); }} disabled={convertMut.isPending}>
            Convert to Application
          </Button>
        ) : null,
    },
  ];

  const APPLICATION_COLUMNS: Column<any>[] = [
    { key: "student_name", label: "Student", sortable: true, value: (a) => a.student_name ?? "", render: (a) => <span className="font-medium">{a.student_name}</span> },
    { key: "guardian", label: "Guardian", value: (a) => a.guardian_name ?? a.parent_name ?? "", render: (a) => a.guardian_name || a.parent_name },
    { key: "class_applied", label: "Class", sortable: true, value: (a) => a.class_applied ?? "" },
    { key: "status", label: "Status", sortable: true, value: (a) => a.status ?? "", render: (a) => <Badge>{a.status}</Badge> },
    {
      key: "next",
      label: "Next Step",
      render: (a) => {
        const next = NEXT_STAGE[a.status];
        const sideOptions = PIPELINE_STAGES.filter((s) =>
          (s === "rejected" || s === "waitlisted") && s !== a.status &&
          a.status !== "enrolled",
        );
        return next && a.status !== "enrolled" ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => statusMut.mutate({ id: a.id, status: next.status, current: a.status })}
              disabled={statusMut.isPending}
            >
              {next.label}
              {next.status === "accepted" ? " (creates login)" : ""}
            </Button>
            {sideOptions.length > 0 && (
              <AdvancedSelect
                className="w-28"
                triggerClassName="h-8"
                onValueChange={(val) => statusMut.mutate({ id: a.id, status: val, current: a.status })}
                placeholder="More…"
                options={sideOptions.map((s) => ({ value: s, label: s === "rejected" ? "Reject" : "Waitlist" }))}
              />
            )}
          </div>
        ) : (
          <span className="text-xs text-[color:var(--w11-text-secondary)]">—</span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (a) => (
        <Button
          variant="ghost"
          size="sm"
          title="View applicant details"
          onClick={(e) => {
            e.stopPropagation();
            setDetailApp(a);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<UserPlus className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Admission CRM"
        subtitle="Manage inquiries and applications pipeline"
        actions={
          <>
            <Dialog
              open={showApplication}
              onOpenChange={(open) => {
                setShowApplication(open);
                if (!open) setNewAppGender("");
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="h-4 w-4 mr-2" /> New Application</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Application</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const payload = Object.fromEntries(fd) as unknown as Record<string, string>;
                  if (newAppGender) payload.gender = newAppGender;
                  createApplicationMut.mutate(payload);
                }} className="space-y-4">
                  <FormSection title="Student">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="app-student-name">Student Name *</Label>
                        <Input id="app-student-name" name="student_name" placeholder="Student Name" required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="app-dob">Date of Birth</Label>
                          <BSDateInput name="dob" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Gender</Label>
                          <Select value={newAppGender} onValueChange={setNewAppGender}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </FormSection>
                  <FormSection title="Class & Previous School">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="app-class">Class Applied</Label>
                        <Input id="app-class" name="class_applied" placeholder="e.g. Class 6" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="app-previous-school">Previous School</Label>
                        <Input id="app-previous-school" name="previous_school" placeholder="Previous school" />
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <Label htmlFor="app-address">Address</Label>
                      <Input id="app-address" name="address" placeholder="Address" />
                    </div>
                  </FormSection>
                  <FormSection title="Parent / Guardian">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="app-parent-name">Parent Name</Label>
                          <Input id="app-parent-name" name="parent_name" placeholder="Parent/Guardian name" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="app-parent-phone">Parent Phone *</Label>
                          <Input id="app-parent-phone" name="parent_phone" placeholder="98XXXXXXXX" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="app-parent-email">Parent Email</Label>
                        <Input id="app-parent-email" name="parent_email" type="email" placeholder="parent@example.com" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="app-guardian-name">Guardian Name</Label>
                          <Input id="app-guardian-name" name="guardian_name" placeholder="If different from parent" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="app-guardian-phone">Guardian Phone</Label>
                          <Input id="app-guardian-phone" name="guardian_phone" placeholder="98XXXXXXXX" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="app-guardian-email">Guardian Email</Label>
                        <Input id="app-guardian-email" name="guardian_email" type="email" placeholder="guardian@example.com" />
                      </div>
                    </div>
                  </FormSection>
                  <FormSection title="Remarks">
                    <Textarea id="app-remarks" name="remarks" rows={2} placeholder="Anything worth noting about this application" />
                  </FormSection>
                  <Button type="submit" disabled={createApplicationMut.isPending} className="w-full">
                    {createApplicationMut.isPending ? "Creating..." : "Create Application"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={showInquiry} onOpenChange={setShowInquiry}>
              <DialogTrigger asChild>
                <Button><PlusCircle className="h-4 w-4 mr-2" /> New Inquiry</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Inquiry</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createInquiryMut.mutate(Object.fromEntries(fd) as unknown as Partial<Inquiry>);
                }} className="space-y-4">
                  <Input name="student_name" placeholder="Student Name" required />
                  <Input name="guardian_name" placeholder="Guardian Name" required />
                  <Input name="phone" placeholder="Phone" required />
                  <Input name="class_applied" placeholder="Class Applied" />
                  <Input name="source" placeholder="Source (walk-in, referral, online)" />
                  <Textarea name="notes" placeholder="Notes" rows={2} />
                  <Button type="submit" disabled={createInquiryMut.isPending} className="w-full">
                    {createInquiryMut.isPending ? "Adding..." : "Add Inquiry"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <AOSPageBody>
        {/* Fluent pivot tabs */}
        <div className="flex gap-1 mb-4 border-b border-[var(--w11-border-subtle)]">
          {(["dashboard", "inquiries", "applications"] as const).map((t: any) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
                tab === t
                  ? "border-[var(--w11-accent)] text-[color:var(--w11-text-primary)]"
                  : "border-transparent text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
              }`}
            >
              {t === "dashboard" && <LayoutDashboard className="h-4 w-4" />}
              {t === "inquiries" && <UserPlus className="h-4 w-4" />}
              {t === "applications" && <BarChart3 className="h-4 w-4" />}
              {t}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-4">
            <StatGrid min={160}>
              <KpiCard
                label="Total Inquiries"
                value={dashboard?.total_inquiries || 0}
                icon={<UserPlus className="h-5 w-5" style={{ color: "var(--w11-text-tertiary)" }} />}
              />
            </StatGrid>
            <StatGrid min={130}>
              {PIPELINE_STAGES.map((stage) => (
                <KpiCard
                  key={stage}
                  label={<span className="capitalize">{statusLabel(stage)}</span>}
                  value={pipeline[stage] || 0}
                  color={
                    stage === "enrolled" || stage === "accepted"
                      ? "#107c10"
                      : stage === "rejected"
                        ? "#c42b1c"
                        : stage === "waitlisted"
                          ? "#d83b01"
                          : undefined
                  }
                />
              ))}
            </StatGrid>
          </div>
        )}

        {tab === "inquiries" && (loadingInq ? <PageLoader /> : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={INQUIRY_COLUMNS}
              rows={inquiries ?? []}
              rowKey={(inq: any) => inq.id}
              searchable
              searchPlaceholder="Search inquiries…"
              exportFileName="admission-inquiries"
              empty={{ icon: UserPlus, title: "No inquiries yet", body: "Log your first admission inquiry." }}
            />
          </DataPanel>
        ))}

        {tab === "applications" && (loadingApps ? <PageLoader /> : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={APPLICATION_COLUMNS}
              rows={applications ?? []}
              rowKey={(a: any) => a.id}
              onRowClick={(a) => setDetailApp(a)}
              searchable
              searchPlaceholder="Search applications…"
              exportFileName="admission-applications"
              empty={{ icon: UserPlus, title: "No applications yet", body: "Convert inquiries or create applications directly." }}
            />
          </DataPanel>
        ))}

        {detailApp ? (
          <Dialog open onOpenChange={(open) => !open && setDetailApp(null)}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Applicant — {detail.student_name}</DialogTitle>
              </DialogHeader>
              {/* Status timeline — the ordered pipeline with the current stage
                  highlighted; side-states (rejected/waitlisted) get a banner. */}
              <div className="rounded-[var(--w11-radius-lg)] border border-[var(--w11-border-subtle)] bg-[var(--w11-control-hover)] p-3">
                <div className="flex items-start">
                  {TIMELINE_STAGES.map((stage, i) => {
                    const curIdx = TIMELINE_STAGES.indexOf(detail.status);
                    const reached = curIdx >= 0 && i <= curIdx;
                    const isCurrent = stage === detail.status;
                    return (
                      <div key={stage} className="flex flex-1 items-start last:flex-none">
                        <div className="flex flex-col items-center gap-1 px-1">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              isCurrent
                                ? "text-white"
                                : reached
                                  ? ""
                                  : "border border-[var(--w11-border-default)] text-[color:var(--w11-text-secondary)]"
                            }`}
                            style={
                              isCurrent
                                ? { background: "var(--w11-accent)", boxShadow: "0 0 0 3px var(--w11-accent-light)" }
                                : reached
                                  ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" }
                                  : { background: "var(--w11-control-hover)" }
                            }
                          >
                            {i + 1}
                          </span>
                          <span className={`text-[10px] leading-tight text-center ${isCurrent ? "font-semibold" : "text-[color:var(--w11-text-secondary)]"}`}>
                            {statusLabel(stage)}
                          </span>
                        </div>
                        {i < TIMELINE_STAGES.length - 1 && (
                          <div
                            className={`mt-2.5 h-0.5 flex-1 ${reached && curIdx > i ? "" : ""}`}
                            style={{ background: reached && curIdx > i ? "var(--w11-accent-light)" : "var(--w11-border-default)" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {(detail.status === "rejected" || detail.status === "waitlisted") && (
                  <p className="mt-2 text-xs font-medium capitalize text-center" style={{ color: "#c42b1c" }}>
                    Current side-state: {statusLabel(detail.status)}
                  </p>
                )}
                {detail.created_at && (
                  <p className="mt-1 text-[10px] text-[color:var(--w11-text-secondary)] text-center">
                    Applied on {detail.created_at.slice(0, 10)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Detail label="Class Applied" value={detail.class_applied} />
                <Detail label="Status" value={statusLabel(detail.status)} />
                <Detail label="Date of Birth" value={detail.dob} />
                <Detail label="Gender" value={detail.gender} />
                <Detail label="Previous School" value={detail.previous_school} />
                <Detail label="Address" value={detail.address} />
                <Detail label="Parent Name" value={detail.parent_name || detail.guardian_name} />
                <Detail label="Parent Phone" value={detail.parent_phone || detail.guardian_phone} />
                <Detail label="Parent Email" value={detail.parent_email || detail.guardian_email} />
                <Detail label="Guardian Name" value={detail.guardian_name} />
                <Detail label="Guardian Phone" value={detail.guardian_phone} />
                <Detail label="Guardian Email" value={detail.guardian_email} />
                <Detail label="Test Score" value={detail.test_score != null ? String(detail.test_score) : null} />
                <Detail label="Interview Score" value={detail.interview_score != null ? String(detail.interview_score) : null} />
                <Detail label="Merit Rank" value={detail.merit_rank != null ? String(detail.merit_rank) : null} />
                <Detail label="Documents" value={detail.documents?.length ? `${detail.documents.length} attached` : null} />
                <Detail label="Remarks" value={detail.remarks} />
                <Detail label="Notes" value={detail.notes} />
                <Detail label="Created" value={detail.created_at ? detail.created_at.slice(0, 10) : null} />
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </AOSPageBody>
    </AOSPage>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[color:var(--w11-text-secondary)]">{label}</p>
      <p className="font-medium truncate">{value || "—"}</p>
    </div>
  );
}
