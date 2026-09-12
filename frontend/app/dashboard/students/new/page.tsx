"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormSection,
  FormGrid,
  FormFull,
  FormActions,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { BSDateInput } from "@/components/ui/bs-date-input";
import {
  AiFormAssist,
  type AiFieldSchema,
} from "@/components/ai/ai-form-assist";
import { ArrowLeft, UserPlus, Upload, User, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { useI18n } from "@/lib/i18n";

/** Field schema doubles for the AI assistant — the same metadata drives the
 *  rendered form, so AI can never target a field the form doesn't have. */
const AI_FIELDS: AiFieldSchema[] = [
  { key: "first_name", label: "First Name", ne: "पहिलो नाम", type: "text", required: true },
  { key: "last_name", label: "Last Name", ne: "थर", type: "text", required: true },
  { key: "gender", label: "Gender", ne: "लिङ्ग", type: "select", options: ["male", "female", "other"] },
  { key: "date_of_birth", label: "Date of Birth (AD)", ne: "जन्म मिति", type: "date", hint: "BS dates are converted to AD" },
  { key: "blood_group", label: "Blood Group", ne: "रक्त समूह", type: "text" },
  { key: "religion", label: "Religion", ne: "धर्म", type: "select", options: ["Hindu", "Buddhist", "Christian", "Muslim", "Kirant", "Other"] },
  { key: "ethnicity", label: "Ethnicity", ne: "जाति", type: "text" },
  { key: "address", label: "Address", ne: "ठेगाना", type: "textarea" },
  { key: "phone", label: "Phone", ne: "फोन", type: "text" },
  { key: "email", label: "Email", ne: "इमेल", type: "email" },
  { key: "previous_school", label: "Previous School", ne: "अघिल्लो विद्यालय", type: "text" },
  { key: "roll_number", label: "Roll Number", ne: "रोल नम्बर", type: "number" },
  { key: "guardian_name", label: "Guardian Name", ne: "अभिभावकको नाम", type: "text" },
  { key: "guardian_phone", label: "Guardian Phone", ne: "अभिभावक फोन", type: "text" },
  { key: "guardian_relation", label: "Relation", ne: "नाता", type: "select", options: ["father", "mother", "guardian"] },
];

export default function NewStudentPage() {
  const router = useAOSRouterNavigate();
  const { t } = useI18n();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    first_name_nepali: "",
    last_name_nepali: "",
    gender: "male",
    date_of_birth: "",
    blood_group: "",
    religion: "",
    ethnicity: "",
    nationality: "Nepali",
    class_id: "",
    section_id: "",
    enrollment_number: "",
    roll_number: "",
    admission_date: new Date().toISOString().split("T")[0],
    address: "",
    phone: "",
    email: "",
    previous_school: "",
    photo_url: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    guardian_relation: "father",
    guardian2_name: "",
    guardian2_phone: "",
    guardian2_email: "",
    guardian2_relation: "mother",
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: { id: string }) => c.id === form.class_id);

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "student-photos");
      const res = await api.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url || res.data?.url;
      if (url) set("photo_url", url);
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        ...(form.first_name_nepali && { first_name_nepali: form.first_name_nepali }),
        ...(form.last_name_nepali && { last_name_nepali: form.last_name_nepali }),
        ...(form.class_id && { class_id: form.class_id }),
        ...(form.section_id && { section_id: form.section_id }),
        ...(form.enrollment_number && { student_id: form.enrollment_number }),
        ...(form.roll_number && { roll_number: form.roll_number }),
        ...(form.gender && { gender: form.gender }),
        ...(form.blood_group && { blood_group: form.blood_group }),
        ...(form.religion && { religion: form.religion }),
        ...(form.ethnicity && { ethnicity: form.ethnicity }),
        ...(form.nationality && { nationality: form.nationality }),
        ...(form.phone && { phone: form.phone }),
        ...(form.email && { email: form.email }),
        ...(form.address && { address: { permanent: form.address } }),
        ...(form.date_of_birth && { dob_ad: form.date_of_birth }),
        ...(form.admission_date && { admission_date_bs: form.admission_date }),
        ...(form.previous_school && { previous_school: form.previous_school }),
        ...(form.photo_url && { photo_url: form.photo_url }),
        guardians: [
          form.guardian_name
            ? {
                full_name: form.guardian_name,
                phone: form.guardian_phone,
                email: form.guardian_email,
                relation: form.guardian_relation,
              }
            : null,
          form.guardian2_name
            ? {
                full_name: form.guardian2_name,
                phone: form.guardian2_phone,
                email: form.guardian2_email,
                relation: form.guardian2_relation,
              }
            : null,
        ].filter(Boolean),
      };
      return (await api.post("/students", payload)).data;
    },
    onSuccess: (res) => {
      const s = res?.data ?? res;
      const enr = s?.enrollment_number || s?.admission_number;
      const roll = s?.roll_number;
      const assigned = [
        enr ? `Enrollment No. ${enr}` : null,
        roll ? `Roll No. ${roll}` : null,
      ].filter(Boolean).join(", ");
      toast.success(assigned ? `Student enrolled! ${assigned} auto-assigned.` : "Student enrolled!");
      router("/dashboard/students");
    },
    onError: () => toast.error("Failed to enroll student"),
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("Enroll New Student", "नयाँ विद्यार्थी भर्ना")}</h1>
          <p className="text-muted-foreground">{t("Add a new student to the system", "प्रणालीमा नयाँ विद्यार्थी थप्नुहोस्")}</p>
        </div>
      </div>

      {/* AI Quick Fill — schema-driven, works on any field below */}
      <AiFormAssist
        formId="student_admission"
        schema={AI_FIELDS}
        values={form}
        applyValues={(vals) => {
          for (const [k, v] of Object.entries(vals)) {
            if (k in form) set(k, v === null || v === undefined ? "" : String(v));
          }
        }}
      />

      <div className="space-y-6">
        {/* ── Personal Information ── */}
        <FormSection
          title="Personal Information"
          ne="व्यक्तिगत जानकारी"
          description="Student identity as it appears on official documents"
          neDescription="आधिकारिक कागजातमा देखिने विद्यार्थीको पहिचान"
          icon={User}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? <Spinner className="mr-2 h-3 w-3" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {uploadingPhoto ? t("Uploading…", "अपलोड हुँदै…") : t("Photo", "फोटो")}
            </Button>
          }
        >
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
            }}
          />
          <FormGrid cols={3}>
            <FormField label="First Name" ne="पहिलो नाम" required>
              <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </FormField>
            <FormField label="Last Name" ne="थर" required>
              <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </FormField>
            <FormField
              label="Date of Birth"
              ne="जन्म मिति"
              hint="Pick in BS — the AD equivalent is kept automatically"
              neHint="बि.सं.मा छान्नुहोस् — ई.सं. स्वतः सुरक्षित हुन्छ"
            >
              <BSDateInput value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
            </FormField>
            <FormField label="First Name (Nepali)" ne="पहिलो नाम (नेपाली)">
              <Input value={form.first_name_nepali} onChange={(e) => set("first_name_nepali", e.target.value)} placeholder="पहिलो नाम" />
            </FormField>
            <FormField label="Last Name (Nepali)" ne="थर (नेपाली)">
              <Input value={form.last_name_nepali} onChange={(e) => set("last_name_nepali", e.target.value)} placeholder="थर" />
            </FormField>
            <FormField label="Gender" ne="लिङ्ग">
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("Male", "पुरुष")}</SelectItem>
                  <SelectItem value="female">{t("Female", "महिला")}</SelectItem>
                  <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Blood Group" ne="रक्त समूह">
              <Input value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} placeholder="A+" />
            </FormField>
            <FormField label="Religion" ne="धर्म">
              <Select value={form.religion} onValueChange={(v) => set("religion", v)}>
                <SelectTrigger><SelectValue placeholder={t("Select", "छान्नुहोस्")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hindu">{t("Hindu", "हिन्दू")}</SelectItem>
                  <SelectItem value="Buddhist">{t("Buddhist", "बौद्ध")}</SelectItem>
                  <SelectItem value="Christian">{t("Christian", "इसाई")}</SelectItem>
                  <SelectItem value="Muslim">{t("Muslim", "मुस्लिम")}</SelectItem>
                  <SelectItem value="Kirant">{t("Kirant", "किराँत")}</SelectItem>
                  <SelectItem value="Other">{t("Other", "अन्य")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Ethnicity" ne="जाति">
              <Input value={form.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} placeholder={t("e.g. Brahmin", "जस्तै: ब्राह्मण")} />
            </FormField>
            <FormField label="Nationality" ne="राष्ट्रियता">
              <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </FormField>
            <FormField label="Phone" ne="फोन">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98XXXXXXXX" />
            </FormField>
            <FormField label="Email" ne="इमेल">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
            <FormFull>
              <FormField label="Address" ne="ठेगाना">
                <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
              </FormField>
            </FormFull>
            <FormFull>
              <FormField label="Previous School" ne="अघिल्लो विद्यालय">
                <Input value={form.previous_school} onChange={(e) => set("previous_school", e.target.value)} placeholder={t("Name of previous institution", "अघिल्लो संस्थाको नाम")} />
              </FormField>
            </FormFull>
          </FormGrid>
        </FormSection>

        {/* ── Academic Information ── */}
        <FormSection
          title="Academic Information"
          ne="शैक्षिक जानकारी"
          description="Class placement and identification numbers"
          neDescription="कक्षा तथा पहिचान नम्बर"
          icon={GraduationCap}
        >
          <FormGrid cols={3}>
            <FormField label="Class" ne="कक्षा">
              <Select
                value={form.class_id}
                onValueChange={(v) => {
                  set("class_id", v);
                  set("section_id", "");
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("Select class", "कक्षा छान्नुहोस्")} /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((klass: { id: string; name: string }) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Section" ne="खण्ड">
              <Select value={form.section_id} onValueChange={(v) => set("section_id", v)}>
                <SelectTrigger><SelectValue placeholder={t("Select section", "खण्ड छान्नुहोस्")} /></SelectTrigger>
                <SelectContent>
                  {((selectedClass as { sections?: { id: string; name: string }[] })?.sections || []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Admission Date" ne="भर्ना मिति">
              <BSDateInput value={form.admission_date} onChange={(v) => set("admission_date", v)} />
            </FormField>
            <FormField
              label="Enrollment No."
              ne="भर्ना नम्बर"
              hint={t("Leave blank to auto-assign the next number", "खाली छोड्दा अर्को नम्बर स्वतः दिइन्छ")}
            >
              <Input value={form.enrollment_number} onChange={(e) => set("enrollment_number", e.target.value)} placeholder={t("Auto-generated", "स्वतः तयार हुने")} />
            </FormField>
            <FormField
              label="Roll Number"
              ne="रोल नम्बर"
              hint={t("Leave blank to auto-assign within the class", "खाली छोड्दा कक्षाभित्रै स्वतः दिइन्छ")}
            >
              <Input type="number" value={form.roll_number} onChange={(e) => set("roll_number", e.target.value)} placeholder={t("Auto-assigned", "स्वतः तयार हुने")} />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* ── Guardian Information ── */}
        <FormSection
          title="Guardian Information"
          ne="अभिभावकको जानकारी"
          description="Primary contact for notices, fees and emergencies"
          neDescription="सूचना, शुल्क र आपतकालीन सम्पर्कको लागि"
          icon={Users}
        >
          <FormGrid cols={3}>
            <FormField label="Guardian Name" ne="अभिभावकको नाम" required>
              <Input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
            </FormField>
            <FormField label="Relation" ne="नाता">
              <Select value={form.guardian_relation} onValueChange={(v) => set("guardian_relation", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">{t("Father", "बुबा")}</SelectItem>
                  <SelectItem value="mother">{t("Mother", "आमा")}</SelectItem>
                  <SelectItem value="guardian">{t("Guardian", "अभिभावक")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Phone" ne="फोन" hint={t("SMS notices go to this number", "यो नम्बरमा SMS सूचना जान्छ")}>
              <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} placeholder="98XXXXXXXX" />
            </FormField>
            <FormFull>
              <FormField label="Email" ne="इमेल">
                <Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} />
              </FormField>
            </FormFull>
          </FormGrid>

          <div className="mt-5 border-t pt-4">
            <p className="mb-3 text-[12px] font-medium text-muted-foreground">
              {t("Second Guardian (optional)", "दोस्रो अभिभावक (ऐच्छिक)")}
            </p>
            <FormGrid cols={3}>
              <FormField label="Name" ne="नाम">
                <Input value={form.guardian2_name} onChange={(e) => set("guardian2_name", e.target.value)} />
              </FormField>
              <FormField label="Relation" ne="नाता">
                <Select value={form.guardian2_relation} onValueChange={(v) => set("guardian2_relation", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="father">{t("Father", "बुबा")}</SelectItem>
                    <SelectItem value="mother">{t("Mother", "आमा")}</SelectItem>
                    <SelectItem value="guardian">{t("Guardian", "अभिभावक")}</SelectItem>
                    <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Phone" ne="फोन">
                <Input value={form.guardian2_phone} onChange={(e) => set("guardian2_phone", e.target.value)} placeholder="98XXXXXXXX" />
              </FormField>
              <FormFull>
                <FormField label="Email" ne="इमेल">
                  <Input type="email" value={form.guardian2_email} onChange={(e) => set("guardian2_email", e.target.value)} />
                </FormField>
              </FormFull>
            </FormGrid>
          </div>
        </FormSection>
      </div>

      <FormActions>
        <Button
          variant="ghost"
          onClick={() => router("/dashboard/students")}
        >
          {t("Cancel", "रद्द")}
        </Button>
        <Button
          size="lg"
          onClick={() => create.mutate()}
          disabled={!form.first_name || !form.last_name || !form.class_id || create.isPending}
        >
          {create.isPending ? <Spinner className="mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
          {t("Enroll Student", "विद्यार्थी भर्ना गर्नुहोस्")}
        </Button>
      </FormActions>
    </div>
  );
}
