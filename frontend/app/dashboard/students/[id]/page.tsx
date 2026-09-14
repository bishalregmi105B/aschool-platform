"use client";

/**
 * Students / [id] — A2 object detail (plan Part 32-A2, 34 row 1).
 *
 * Research (NN/g object-detail patterns; eSchool/InfixEdu student screens):
 * a person page leads with the persona header (name, code, status, photo),
 * puts the 3–6 same-entity views into tabs (never nested tabs), and exposes
 * the highest-frequency micro-edits (phone/email) inline instead of a modal.
 * Applied: ObjectHeader + URL-synced tabs (Overview | Attendance | Fees |
 * Account) + EditableField for contact + honest not-found.
 *
 * Fixed here: the old "Reset password to default" fired the mutation
 * regardless of the confirm dialog answer (fire-and-forget `.then`); it now
 * awaits. The fee/attendance payloads and endpoints are unchanged.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  useAOSPathParam,
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AOSPage,
  AOSPageBody,
  DataPanel,
  DetailSplit,
  FormSection,
  KpiCard,
  StatGrid,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader, EditableField } from "@/components/aos/kit/detail-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
import {
  fetchStudentAttendance,
  fetchStudentById,
  fetchStudentFeeCollections,
} from "@/lib/services/dashboard/students.service";

// Mirrors the backend default (app/utils/password.py): parents get
// p{roll}.{first}{last4 of phone} derived from the child's identity,
// e.g. p12.ram4821; falls back to {first}.{last4} when the child has no
// roll yet. The backend may append -2/-3 on in-school collisions.
function parentDefaultHint(
  s: { first_name?: string; roll_number?: number | null } | null,
  phone: string
): string {
  const slug = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = slug(s?.first_name) || "user";
  const last4 = slug(phone).slice(-4);
  if (s?.roll_number == null) return `${first}.${last4}`;
  return `p${s.roll_number}.${first}${last4}`;
}

type TabKey = "overview" | "attendance" | "fees" | "account";

export default function StudentDetailPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const params = useParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const routeParams = useAOSRouteParams();
  const studentId = useAOSPathParam(2) || (params.id as string);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const activeTab: TabKey = (["overview", "attendance", "fees", "account"].includes(
    routeParams.get("tab") ?? ""
  )
    ? (routeParams.get("tab") as TabKey)
    : "overview");

  function setTab(tab: TabKey) {
    const base = windowRoute?.pathname ?? `/dashboard/students/${studentId}`;
    navigate(`${base}?tab=${tab}`);
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => fetchStudentById(studentId),
  });

  // Tab bodies lazy-load: related queries only fire when their tab is open.
  const { data: fees } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: async () => fetchStudentFeeCollections(studentId),
    enabled: activeTab === "fees" || activeTab === "overview",
  });
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => fetchStudentAttendance(studentId),
    enabled: activeTab === "attendance" || activeTab === "overview",
  });

  const queryClient = useQueryClient();
  const [resetPwData, setResetPwData] = useState<any>(null);
  const resetPw = useMutation({
    mutationFn: async () => {
      if (!s.user_id) throw new Error("no user");
      const res = await api.post(`/users/${s.user_id}/reset-default-password`);
      return res.data?.data;
    },
    onSuccess: (resData) => {
      setResetPwData(resData);
      toast.success(t("Password reset to school default", "पासवर्ड डिफल्टमा रिसेट"));
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
    onError: () => toast.error(t("Could not reset password", "पासवर्ड रिसेट हुन सकेन")),
  });

  // B1: the default password no longer serializes with student payloads —
  // admins reveal it explicitly (POST /students/<id>/reveal-default-password).
  const [revealPwData, setRevealPwData] = useState<any>(null);
  const revealPw = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/students/${studentId}/reveal-default-password`);
      return res.data?.data;
    },
    onSuccess: () => toast.success(t("Default password revealed", "डिफल्ट पासवर्ड देखाइयो")),
    onError: () => toast.error(t("Could not reveal password", "पासवर्ड देखिएन")),
  });

  // Inline contact edits (A2: EditableField) — PUT the same single field the
  // full Edit dialog sends, so the payload contract is unchanged.
  const inlineEdit = useMutation({
    mutationFn: async (patch: Record<string, string | null>) => {
      await api.put(`/students/${studentId}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error(t("Couldn't save — try the Edit dialog.", "सुरक्षित हुन सकेन।")),
  });

  if (isLoading) {
    return (
      <AOSPage>
        <AOSPageBody>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isError || !data) {
    return (
      <AOSPage>
        <AOSPageBody>
          <EmptyState
            title={isError ? t("Couldn't load this student", "विद्यार्थी लोड हुन सकेन") : t("Student not found", "विद्यार्थी भेटिएन")}
            body={isError
              ? t("The service didn't answer — retry or go back to the roster.", "सेवाले जवाफ दिएन — फेरि प्रयास गर्नुहोस्।")
              : t("This record may have been deleted or transferred.", "यो रेकर्ड मेटिएको वा स्थानान्तरण भएको हुन सक्छ।")}
            action={{ label: t("Back to students", "विद्यार्थीमा फर्कनुहोस्"), href: "/dashboard/students" }}
            secondaryAction={isError ? { label: t("Retry", "फेरि"), onClick: () => void refetch() } : undefined}
          />
        </AOSPageBody>
      </AOSPage>
    );
  }

  const s = data;
  const guardians = s.guardians || [];
  const attendanceRecords: any[] = attendance || [];
  const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : null;
  const totalFees = (fees || []).reduce((acc: number, f: any) => acc + (f.amount || 0), 0);
  const totalDue = (fees || []).reduce((acc: number, f: any) => acc + (f.due_amount || 0), 0);

  const addr =
    typeof s.address === "object" && s.address
      ? s.address.permanent || s.address.temporary || "—"
      : s.address || "—";

  return (
    <AOSPage>
      <AOSPageBody className="space-y-0">
        {/* Persona header — where am I / whose page is this */}
        <ObjectHeader
          avatar={
            <Avatar
              src={s.photo_url}
              name={`${s.first_name} ${s.last_name}`}
              size="lg"
            />
          }
          name={s.full_name || `${s.first_name} ${s.last_name}`}
          nameNepali={s.first_name_nepali ? `${s.first_name_nepali} ${s.last_name_nepali || ""}`.trim() : undefined}
          code={s.enrollment_number || "—"}
          codeLabel={t("Enrollment No.", "भर्ना नम्बर")}
          status={s.status}
          meta={
            <div className="flex flex-wrap gap-2 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
              <span>{s.class_name ? `Class ${String(s.class_name).replace(/^\s*class\s+/i, "")}${s.section_name ? ` · ${s.section_name}` : ""}` : t("No class assigned", "कक्षा तोकिएको छैन")}</span>
              {s.roll_number != null && <span>· {t("Roll", "रोल")} {s.roll_number}</span>}
              {s.gender && <span>· <span className="capitalize">{s.gender}</span></span>}
            </div>
          }
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/students")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {t("Back", "फर्कनुहोस्")}
              </Button>
              <Button size="sm" onClick={() => setIsEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> {t("Edit Profile", "प्रोफाइल सम्पादन")}
              </Button>
            </>
          }
        />

        {/* What's the state — the three numbers admins ask about first */}
        <StatGrid min={170} className="mt-4">
          <KpiCard
            label={t("Attendance", "उपस्थिति")}
            value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
            denominator={attendanceRecords.length ? `/ ${attendanceRecords.length} days` : undefined}
            color="#107c10"
            footnote={t(`${presentCount} present`, `${presentCount} उपस्थित`)}
          />
          <KpiCard
            label={t("Total Fees", "कुल शुल्क")}
            value={`Rs. ${totalFees.toLocaleString()}`}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Due", "बाँकी")}
            value={`Rs. ${totalDue.toLocaleString()}`}
            color={totalDue > 0 ? "#c42b1c" : "#107c10"}
            footnote={totalDue > 0 ? t("Open balance", "रकम बाँकी") : t("Cleared", "तिरिसकियो")}
          />
        </StatGrid>

        {/* What can I do — the entity's views, URL-synced (?tab=) */}
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList variant="underline">
            <TabsTrigger value="overview">{t("Overview", "सारांश")}</TabsTrigger>
            <TabsTrigger value="attendance" badge={attendanceRecords.length || undefined}>
              {t("Attendance", "उपस्थिति")}
            </TabsTrigger>
            <TabsTrigger value="fees" badge={(fees || []).length || undefined}>
              {t("Fees", "शुल्क")}
            </TabsTrigger>
            <TabsTrigger value="account">{t("Account", "खाता")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <DetailSplit
              sidebar={
                <FormSection title={t("Personal", "व्यक्तिगत")}>
                  <dl className="space-y-2 text-[13px]">
                    <div className="flex justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Date of Birth", "जन्म मिति")}</dt>
                      <dd className="text-right">{s.date_of_birth || s.dob_bs || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Blood Group", "रक्त समूह")}</dt>
                      <dd>{s.blood_group || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Gender", "लिङ्ग")}</dt>
                      <dd className="capitalize">{s.gender || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Address", "ठेगाना")}</dt>
                      <dd className="text-right max-w-[55%] break-words">{addr}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Phone", "फोन")}</dt>
                      <dd>
                        <EditableField
                          value={s.phone}
                          aria-label={t("Phone", "फोन")}
                          onSave={(next) => inlineEdit.mutateAsync({ phone: next || null })}
                        />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt style={{ color: "var(--w11-text-secondary)" }}>{t("Email", "इमेल")}</dt>
                      <dd>
                        <EditableField
                          value={s.email}
                          inputType="email"
                          aria-label={t("Email", "इमेल")}
                          onSave={(next) => inlineEdit.mutateAsync({ email: next || null })}
                        />
                      </dd>
                    </div>
                  </dl>
                </FormSection>
              }
            >
              <DataPanel title={t("Guardians", "अभिभावक")} bodyClassName="p-3">
                {guardians.length === 0 ? (
                  <EmptyState
                    size="sm"
                    title={t("No guardian linked", "अभिभावक जोडिएको छैन")}
                    body={t("Add one from Edit Profile or the Parents module.", "सम्पादन वा अभिभावक मोड्युलबाट थप्नुहोस्।")}
                    action={{ label: t("Edit Profile", "प्रोफाइल सम्पादन"), onClick: () => setIsEditOpen(true) }}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {guardians.map((g: any, i: number) => (
                      <div key={g.id ?? i} className="win11-card" style={{ margin: 0, padding: "12px" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{g.full_name}</span>
                          {g.relation && <StatusChip status={String(g.relation).toLowerCase()} label={String(g.relation)} />}
                        </div>
                        {g.phone && <p className="text-[12px] mt-1" style={{ color: "var(--w11-text-secondary)" }}>{g.phone}</p>}
                        {g.email && <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>{g.email}</p>}
                        {g.phone && (
                          <p className="text-[11px] mt-1.5" style={{ color: "var(--w11-text-tertiary)" }}>
                            {t("Parent app login", "अभिभावक लगइन")}: <span className="font-mono">{g.phone}</span> · {t("default password", "डिफल्ट पासवर्ड")}{" "}
                            <span className="font-mono">{parentDefaultHint(s, String(g.phone))}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </DataPanel>
            </DetailSplit>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            <DataPanel title={t("Attendance History", "उपस्थिति इतिहास")} bodyClassName="p-0">
              {attendanceRecords.length === 0 ? (
                <EmptyState
                  size="sm"
                  title={t("No attendance records yet", "अझै उपस्थिति छैन")}
                  body={t("Records appear here after the first class register is saved.", "रजिस्टर सेभ गरेपछि यहाँ देखिन्छ।")}
                  action={{ label: t("Mark attendance", "उपस्थिति हाल्नुहोस्"), href: "/dashboard/attendance" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Date", "मिति")}</TableHead>
                      <TableHead>{t("Status", "अवस्था")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((r: any, i: number) => (
                      <TableRow key={r.id ?? i}>
                        <TableCell>{r.date || r.attendance_date || r.day || "—"}</TableCell>
                        <TableCell><StatusChip status={String(r.status || "pending")} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataPanel>
          </TabsContent>

          <TabsContent value="fees" className="mt-4">
            <DataPanel title={t("Fee Records", "शुल्क रेकर्ड")} bodyClassName="p-0">
              {(fees || []).length === 0 ? (
                <EmptyState
                  size="sm"
                  title={t("No fee records", "शुल्क रेकर्ड छैन")}
                  body={t("Bills appear here once fee structures are applied.", "फिँस लागू गरेपछि यहाँ देखिन्छ।")}
                  action={{ label: t("Open Fees", "शुल्क खोल्नुहोस्"), href: "/dashboard/fees" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Fee Type", "शुल्क प्रकार")}</TableHead>
                      <TableHead className="text-right">{t("Amount", "रकम")}</TableHead>
                      <TableHead className="text-right">{t("Paid", "तिरिएको")}</TableHead>
                      <TableHead className="text-right">{t("Due", "बाँकी")}</TableHead>
                      <TableHead>{t("Status", "अवस्था")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(fees || []).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.fee_type}</TableCell>
                        <TableCell className="text-right">Rs. {f.amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {f.paid_amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right" style={{ color: f.due_amount > 0 ? "#c42b1c" : undefined }}>
                          Rs. {f.due_amount?.toLocaleString()}
                        </TableCell>
                        <TableCell><StatusChip status={String(f.status)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataPanel>
          </TabsContent>

          <TabsContent value="account" className="mt-4">
            <FormSection title={t("Account Access", "खाता पहुँच")} className="max-w-xl">
              <div className="space-y-4 text-[13px]">
                <div>
                  <p style={{ color: "var(--w11-text-secondary)" }}>{t("Login ID (Student ID)", "लगइन आईडी")}</p>
                  <p className="font-medium">{s.login_id || s.student_id || t("Not set", "तोकिएको छैन")}</p>
                </div>
                <div>
                  <p style={{ color: "var(--w11-text-secondary)" }}>{t("Default Password", "डिफल्ट पासवर्ड")}</p>
                  {revealPwData ? (
                    <div className="mt-1 rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-xs">
                      <span className="font-mono font-semibold">{revealPwData.default_password}</span>
                      <p className="text-muted-foreground mt-1">
                        {t("Shown once — copy it before leaving this page.", "एकपटक देखिन्छ — नक्कल गर्नुहोस्।")}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={revealPw.isPending || !s.user_id} onClick={() => revealPw.mutate()}>
                        {revealPw.isPending ? t("Revealing…", "देखाँदै…") : t("Reveal default password", "डिफल्ट पासवर्ड देखाउनुहोस्")}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("Pattern", "ढाँचा")}: <span className="font-mono">{"{class}{section}{roll}.{first}"}</span> — {t("parents", "अभिभावक")} {"p{roll}.{first}{last4}"}
                  </p>
                </div>
                {s.user_id && (
                  <div className="pt-2 border-t border-[var(--w11-border-subtle)]">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetPw.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("Reset password to default?", "पासवर्ड डिफल्टमा रिसेट गर्ने?"),
                          body: t("The student's current login password stops working immediately.", "हालको पासवर्ड तुरुन्तै काम गर्दैन।"),
                          confirmLabel: t("Reset", "रिसेट"),
                        });
                        if (ok) resetPw.mutate();
                      }}
                    >
                      {resetPw.isPending ? t("Resetting…", "रिसेट हुँदै…") : t("Reset password to default", "पासवर्ड डिफल्टमा रिसेट")}
                    </Button>
                    {resetPwData && (
                      <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">{t("Login", "लगइन")}:</span> <span className="font-mono">{resetPwData.login}</span></p>
                        <p><span className="text-muted-foreground">{t("Password", "पासवर्ड")}:</span> <span className="font-mono font-semibold">{resetPwData.default_password}</span></p>
                        <p className="text-muted-foreground">{t("Share these with the family. Shown once per reset.", "पরিवारलाई दिनुहोस् — एकपटक मात्र देखिन्छ।")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormSection>
          </TabsContent>
        </Tabs>

        <StudentProfileEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          student={s}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

function StudentProfileEditDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(student.first_name || "");
  const [lastName, setLastName] = useState(student.last_name || "");
  const [gender, setGender] = useState(student.gender || "other");
  const [status, setStatus] = useState(student.status || "active");
  const [classId, setClassId] = useState(student.class_id || "none");
  const [sectionId, setSectionId] = useState(student.section_id || "none");
  const [phone, setPhone] = useState(student.phone || "");
  const [email, setEmail] = useState(student.email || "");
  const [dobBs, setDobBs] = useState(student.dob_bs || "");
  const [bloodGroup, setBloodGroup] = useState(student.blood_group || "");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });
  const selectedClass = (classes || []).find((klass: any) => klass.id === classId);

  const updateStudent = useMutation({
    mutationFn: async () => {
      await api.put(`/students/${student.id}`, {
        first_name: firstName,
        last_name: lastName,
        gender,
        status,
        class_id: classId === "none" ? null : classId,
        section_id: sectionId === "none" ? null : sectionId,
        phone: phone || null,
        email: email || null,
        dob_bs: dobBs || null,
        blood_group: bloodGroup || null,
      });
    },
    onSuccess: () => {
      toast.success(t("Student profile updated", "प्रोफाइल अद्यावधिक भयो"));
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: () => toast.error(t("Failed to update student profile", "अद्यावधिक हुन सकेन")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Edit Student Profile", "विद्यार्थी प्रोफाइल सम्पादन")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("First Name", "पहिलो नाम")}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("Last Name", "थर")}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Class / Grade", "कक्षा")}</Label>
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setSectionId("none");
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("Select class", "कक्षा छान्नुहोस्")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Not assigned", "तोकिएको छैन")}</SelectItem>
                  {(classes || []).map((klass: any) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Section", "खण्ड")}</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder={t("Select section", "खण्ड छान्नुहोस्")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Not assigned", "तोकिएको छैन")}</SelectItem>
                  {(selectedClass?.sections || []).map((section: any) => (
                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Gender", "लिङ्ग")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("Male", "पुरुष")}</SelectItem>
                  <SelectItem value="female">{t("Female", "महिला")}</SelectItem>
                  <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Status", "अवस्था")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("Active", "सक्रिय")}</SelectItem>
                  <SelectItem value="on_leave">{t("On Leave", "बिदामा")}</SelectItem>
                  <SelectItem value="transferred_in">{t("Transferred In", "भित्र स्थानान्तरण")}</SelectItem>
                  <SelectItem value="transferred_out">{t("Transferred Out", "बाहिर स्थानान्तरण")}</SelectItem>
                  <SelectItem value="graduated">{t("Graduated", "स्नातक")}</SelectItem>
                  <SelectItem value="dropped_out">{t("Dropped Out", "विछुटेको")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Phone", "फोन")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("Email", "इमेल")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("DOB (BS)", "जन्म मिति (बि.सं.)")}</Label>
              <BSDateInput value={dobBs} onChange={(v) => setDobBs(v)} emit="bs" />
            </div>
            <div className="space-y-2">
              <Label>{t("Blood Group", "रक्त समूह")}</Label>
              <Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. A+" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "रद्द")}</Button>
          <Button onClick={() => updateStudent.mutate()} disabled={updateStudent.isPending}>
            {updateStudent.isPending ? t("Saving...", "सुरक्षित हुँदै…") : t("Save Changes", "सुरक्षित")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
