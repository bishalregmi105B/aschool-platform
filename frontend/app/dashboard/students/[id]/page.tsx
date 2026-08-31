"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "sonner";
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

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => fetchStudentById(studentId),
  });

  const { data: fees } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: async () => fetchStudentFeeCollections(studentId),
  });

  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => fetchStudentAttendance(studentId),
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
      toast.success("Password reset to school default");
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
    onError: () => toast.error("Could not reset password"),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <div className="text-center py-16">Student not found</div>;

  const s = data;
  const guardians = s.guardians || [];
  const attendanceRecords = attendance || [];
  const presentCount = attendanceRecords.filter((record: any) => record.status === "present").length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">{s.full_name || `${s.first_name} ${s.last_name}`}</h1><p className="text-muted-foreground">Enrollment: {s.enrollment_number || "—"}</p></div>
        <Button variant="outline" onClick={() => setIsEditOpen(true)}>Edit Profile</Button>
        <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-2"><User className="h-10 w-10 text-muted-foreground" /></div>
              <h2 className="font-semibold text-lg">{s.full_name || `${s.first_name} ${s.last_name}`}</h2>
              <p className="text-sm text-muted-foreground">{s.class_name} {s.section_name && `- ${s.section_name}`}</p>
            </div>
            {[
              { icon: Calendar, label: "DOB", value: s.date_of_birth || s.dob_bs },
              { icon: User, label: "Gender", value: s.gender },
              { icon: Phone, label: "Phone", value: s.phone },
              { icon: Mail, label: "Email", value: s.email },
              { icon: MapPin, label: "Address", value: typeof s.address === 'object' && s.address ? (s.address.permanent || s.address.temporary || 'N/A') : s.address },
            ].map((item, i) => item.value && (
              <div key={i} className="flex items-center gap-3 text-sm">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <div><span className="text-muted-foreground">{item.label}:</span> {item.value}</div>
              </div>
            ))}
            {s.blood_group && <Badge variant="outline">Blood: {s.blood_group}</Badge>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Account Access</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Login ID (Student ID)</p>
              <p className="font-medium">{s.login_id || s.student_id || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Default Password Hint</p>
              <p className="font-mono text-sm bg-muted p-1.5 rounded inline-block break-all">
                {s.default_password_hint || "Not generated"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pattern: <span className="font-mono">{"{class}{section}{roll}.{first}"}</span> — parents use {"p{roll}.{first}{last4}"}
              </p>
            </div>
            {s.user_id && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resetPw.isPending}
                  onClick={() => {
                    if (!window.confirm("Reset the student's login password to the school default?")) return;
                    resetPw.mutate();
                  }}
                >
                  {resetPw.isPending ? "Resetting…" : "Reset password to default"}
                </Button>
                {resetPwData && (
                  <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-xs space-y-0.5">
                    <p><span className="text-muted-foreground">Login:</span> <span className="font-mono">{resetPwData.login}</span></p>
                    <p><span className="text-muted-foreground">Password:</span> <span className="font-mono font-semibold">{resetPwData.default_password}</span></p>
                    <p className="text-muted-foreground">Share these with the family. Shown once per reset.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
          {guardians.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Guardians</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guardians.map((g: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1">
                      <p className="font-medium">{g.full_name} <Badge variant="outline" className="ml-2">{g.relation}</Badge></p>
                      {g.phone && <p className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" /> {g.phone}</p>}
                      {g.email && <p className="text-sm flex items-center gap-1"><Mail className="h-3 w-3" /> {g.email}</p>}
                      {g.phone && (
                        <p className="text-xs text-muted-foreground">
                          Parent app login: <span className="font-mono">{g.phone}</span> · default password{" "}
                          <span className="font-mono">{parentDefaultHint(s, String(g.phone))}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Attendance</p><p className="text-2xl font-bold text-green-600">{attendanceRate !== null ? `${attendanceRate}%` : "—"}</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Fees</p><p className="text-2xl font-bold">Rs. {(fees || []).reduce((s: number, f: any) => s + (f.amount || 0), 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Due Amount</p><p className="text-2xl font-bold text-red-600">Rs. {(fees || []).reduce((s: number, f: any) => s + (f.due_amount || 0), 0).toLocaleString()}</p></CardContent></Card>
          </div>

          {(fees || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Fee Records</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Fee Type</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fees.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.fee_type}</TableCell>
                        <TableCell>Rs. {f.amount?.toLocaleString()}</TableCell>
                        <TableCell>Rs. {f.paid_amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">Rs. {f.due_amount?.toLocaleString()}</TableCell>
                        <TableCell><Badge variant={f.status === "paid" ? "default" : "destructive"}>{f.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <StudentProfileEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        student={s}
      />
    </div>
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
      toast.success("Student profile updated");
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update student profile"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Student Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class / Grade</Label>
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setSectionId("none");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {(classes || []).map((klass: any) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {(selectedClass?.sections || []).map((section: any) => (
                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="transferred_in">Transferred In</SelectItem>
                  <SelectItem value="transferred_out">Transferred Out</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="dropped_out">Dropped Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>DOB (BS)</Label>
              <Input value={dobBs} onChange={(e) => setDobBs(e.target.value)} placeholder="2065-04-15" />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. A+" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateStudent.mutate()} disabled={updateStudent.isPending}>
            {updateStudent.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
