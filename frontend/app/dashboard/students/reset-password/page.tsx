"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/ui/spinner";
import { KeyRound, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  login_id?: string;
  class_name?: string;
  status: string;
}

export default function ResetPasswordPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resetRows, setResetRows] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

  const { data: classes, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/academics/classes");
      return res.data.data;
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-reset-password", selectedClass],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentRow[]>>("/students", {
        params: { class_id: selectedClass, per_page: 500 },
      });
      return res.data.data ?? [];
    },
    enabled: !!selectedClass,
  });

  useEffect(() => {
    setSelected(new Set());
    setResetRows({});
  }, [selectedClass]);

  const visible = (students || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.student_id || "").toLowerCase().includes(q)
    );
  });

  async function handleReset() {
    if (selected.size === 0) return;
    setResetting(true);
    try {
      const res = await api.post("/students/bulk-reset-passwords", {
        student_ids: Array.from(selected),
      });
      const data = res.data?.data;
      const map: Record<string, string> = {};
      for (const p of data?.passwords || []) {
        map[p.student_id] = p.password;
      }
      setResetRows(map);
      toast.success(`Reset ${data?.reset ?? 0} password(s) to the school default`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || "Failed to reset passwords");
    } finally {
      setResetting(false);
    }
  }

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load class list. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6" /> Students Reset Password
        </h1>
        <p className="text-muted-foreground">Bulk reset student login passwords to the school default</p>
      </div>

      <div className="flex gap-4">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" disabled>Select a class</SelectItem>
            {(classes || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search students..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Students</CardTitle>
          <Button
            variant="destructive"
            size="sm"
            disabled={selected.size === 0 || resetting}
            onClick={handleReset}
          >
            <KeyRound className="h-4 w-4 mr-2" /> {resetting ? "Resetting…" : `Reset Selected (${selected.size})`}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={visible.length > 0 && visible.every((s) => selected.has(s.id))}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? new Set(visible.map((s) => s.id)) : new Set())
                    }
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Login ID</TableHead>
                <TableHead>New Password</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedClass ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Select a class to view students
                  </TableCell>
                </TableRow>
              ) : studentsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading students…</TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No students found in this class.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            checked ? next.add(s.id) : next.delete(s.id);
                            return next;
                          })
                        }
                        aria-label={`Select ${s.first_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                    <TableCell>{s.class_name || "—"}</TableCell>
                    <TableCell>{s.student_id || s.login_id || "—"}</TableCell>
                    <TableCell>
                      {/* backend keys each password by the student's code (or the
                          student uuid when no code is set) */}
                      {resetRows[s.student_id || s.id] ? (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{resetRows[s.student_id || s.id]}</code>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Password Format:</strong> new passwords are generated as <code className="bg-blue-100 px-1 rounded">{`{class}{section}{roll}.{first}`}</code> (e.g. 7a12.ram — built from the student&apos;s class, section, roll and first name, never from EMIS) — the same school default issued at enrollment. Hand the new password to the student after resetting.
      </div>
    </div>
  );
}
