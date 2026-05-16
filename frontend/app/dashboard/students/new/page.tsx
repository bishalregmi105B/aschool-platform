"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, UserPlus, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BSDateInput } from "@/components/ui/bs-date-input";

export default function NewStudentPage() {
  const router = useRouter();
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
    onSuccess: () => {
      toast.success("Student enrolled!");
      router.push("/dashboard/students");
    },
    onError: () => toast.error("Failed to enroll student"),
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Enroll New Student</h1>
          <p className="text-muted-foreground">Add a new student to the system</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Personal Information ── */}
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-3">
                {form.photo_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.photo_url} alt="Student photo" className="h-16 w-16 rounded-full object-cover border" />
                    <button
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                      onClick={() => set("photo_url", "")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center bg-muted">
                    <UserPlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                </Button>
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
              </div>
            </div>

            {/* English names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name (English) *</Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name (English) *</Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
            </div>
            {/* Nepali names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>पहिलो नाम (नेपाली)</Label>
                <Input value={form.first_name_nepali} onChange={(e) => set("first_name_nepali", e.target.value)} placeholder="पहिलो नाम" />
              </div>
              <div className="space-y-2">
                <Label>थर (नेपाली)</Label>
                <Input value={form.last_name_nepali} onChange={(e) => set("last_name_nepali", e.target.value)} placeholder="थर" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <BSDateInput value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Input value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} placeholder="e.g. A+" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Religion</Label>
                <Select value={form.religion} onValueChange={(v) => set("religion", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hindu">Hindu</SelectItem>
                    <SelectItem value="Buddhist">Buddhist</SelectItem>
                    <SelectItem value="Christian">Christian</SelectItem>
                    <SelectItem value="Muslim">Muslim</SelectItem>
                    <SelectItem value="Kirant">Kirant</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <Input value={form.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} placeholder="e.g. Brahmin" />
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Previous School</Label>
              <Input value={form.previous_school} onChange={(e) => set("previous_school", e.target.value)} placeholder="Name of previous institution" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* ── Academic Information ── */}
          <Card>
            <CardHeader><CardTitle>Academic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={form.class_id}
                    onValueChange={(v) => {
                      set("class_id", v);
                      set("section_id", "");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {(classes || []).map((klass: { id: string; name: string }) => (
                        <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={form.section_id} onValueChange={(v) => set("section_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      {((selectedClass as { sections?: { id: string; name: string }[] })?.sections || []).map((section) => (
                        <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admission / Enrollment No.</Label>
                  <Input value={form.enrollment_number} onChange={(e) => set("enrollment_number", e.target.value)} placeholder="e.g. ADM1023" />
                </div>
                <div className="space-y-2">
                  <Label>Roll Number</Label>
                  <Input value={form.roll_number} onChange={(e) => set("roll_number", e.target.value)} placeholder="e.g. 12" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admission Date (BS)</Label>
                <BSDateInput value={form.admission_date} onChange={(v) => set("admission_date", v)} />
              </div>
            </CardContent>
          </Card>

          {/* ── Guardian Information ── */}
          <Card>
            <CardHeader><CardTitle>Guardian Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Guardian Name</Label>
                  <Input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Relation</Label>
                  <Select value={form.guardian_relation} onValueChange={(v) => set("guardian_relation", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} />
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-3">Second Guardian (Optional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Guardian Name</Label>
                    <Input value={form.guardian2_name} onChange={(e) => set("guardian2_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Relation</Label>
                    <Select value={form.guardian2_relation} onValueChange={(v) => set("guardian2_relation", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.guardian2_phone} onChange={(e) => set("guardian2_phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.guardian2_email} onChange={(e) => set("guardian2_email", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => create.mutate()}
          disabled={!form.first_name || !form.last_name || !form.class_id || create.isPending}
        >
          {create.isPending ? <Spinner className="mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
          Enroll Student
        </Button>
      </div>
    </div>
  );
}
