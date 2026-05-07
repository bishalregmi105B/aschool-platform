"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewStudentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "", last_name: "", gender: "male", date_of_birth: "", blood_group: "",
    class_id: "", section_id: "", enrollment_number: "", admission_date: new Date().toISOString().split("T")[0],
    address: "", phone: "", email: "",
    guardian_name: "", guardian_phone: "", guardian_email: "", guardian_relation: "father",
    guardian2_name: "", guardian2_phone: "", guardian2_email: "", guardian2_relation: "mother",
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: any) => c.id === form.class_id);

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        class_id: form.class_id || undefined,
        section_id: form.section_id || undefined,
        student_id: form.enrollment_number || undefined,
        gender: form.gender || undefined,
        blood_group: form.blood_group || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address ? { permanent: form.address } : undefined,
        dob_ad: form.date_of_birth || undefined,
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
    onSuccess: () => { toast.success("Student enrolled!"); router.push("/dashboard/students"); },
    onError: () => toast.error("Failed to enroll student"),
  });

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Enroll New Student</h1><p className="text-muted-foreground">Add a new student to the system</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
              <div className="space-y-2"><Label>Blood Group</Label><Input value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} placeholder="e.g. A+" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                      {(classes || []).map((klass: any) => (
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
                      {(selectedClass?.sections || []).map((section: any) => (
                        <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Enrollment No.</Label><Input value={form.enrollment_number} onChange={(e) => set("enrollment_number", e.target.value)} /></div>
                <div className="space-y-2"><Label>Admission Date</Label><Input type="date" value={form.admission_date} onChange={(e) => set("admission_date", e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Guardian Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Guardian Name</Label><Input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Relation</Label>
                  <Select value={form.guardian_relation} onValueChange={(v) => set("guardian_relation", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="father">Father</SelectItem><SelectItem value="mother">Mother</SelectItem><SelectItem value="guardian">Guardian</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Guardian Phone</Label><Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} /></div>
                <div className="space-y-2"><Label>Guardian Email</Label><Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} /></div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-3">Second Guardian (Optional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Guardian Name</Label><Input value={form.guardian2_name} onChange={(e) => set("guardian2_name", e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Relation</Label>
                    <Select value={form.guardian2_relation} onValueChange={(v) => set("guardian2_relation", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="father">Father</SelectItem><SelectItem value="mother">Mother</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2"><Label>Guardian Phone</Label><Input value={form.guardian2_phone} onChange={(e) => set("guardian2_phone", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Guardian Email</Label><Input type="email" value={form.guardian2_email} onChange={(e) => set("guardian2_email", e.target.value)} /></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => create.mutate()} disabled={!form.first_name || !form.last_name || !form.class_id || create.isPending}>
          {create.isPending ? <Spinner className="mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />} Enroll Student
        </Button>
      </div>
    </div>
  );
}
