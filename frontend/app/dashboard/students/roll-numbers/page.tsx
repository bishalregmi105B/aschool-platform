"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { ListOrdered, Save, Shuffle } from "lucide-react";
import { toast } from "sonner";

export default function RollNumbersPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [rollNumbers, setRollNumbers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/academics/classes");
      return res.data.data ?? [];
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-roll", selectedSection],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(
        `/students?section_id=${selectedSection}&per_page=500`
      );
      return res.data.data ?? [];
    },
    enabled: !!selectedSection,
  });

  // Populate roll number inputs when students load
  useEffect(() => {
    if (!students) return;
    const map: Record<string, string> = {};
    for (const s of students) {
      map[s.id] = s.roll_number != null ? String(s.roll_number) : "";
    }
    setRollNumbers(map);
  }, [students]);

  const handleAutoAssign = () => {
    if (!students?.length) return;
    const sorted = [...students].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    const map: Record<string, string> = {};
    sorted.forEach((s, i) => { map[s.id] = String(i + 1); });
    setRollNumbers(map);
    toast.success("Roll numbers auto-assigned alphabetically. Click Save to apply.");
  };

  const handleSave = async () => {
    if (!students?.length) return;
    setSaving(true);
    try {
      const updates = students.map((s: any) => ({
        student_id: s.id,
        roll_number: rollNumbers[s.id] !== "" ? Number(rollNumbers[s.id]) : null,
      }));
      await api.post("/students/batch-roll-numbers", { updates });
      toast.success("Roll numbers saved successfully.");
    } catch {
      toast.error("Failed to save roll numbers.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;

  const sectionList =
    selectedClass
      ? (classes || []).find((c: any) => c.id === selectedClass)?.sections ?? []
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListOrdered className="h-6 w-6" /> Assign Roll Numbers
        </h1>
        <p className="text-muted-foreground">Assign or auto-generate roll numbers for students</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Select Class &amp; Section</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-wrap items-center">
          <Select
            value={selectedClass}
            onValueChange={(v) => { setSelectedClass(v); setSelectedSection(""); setRollNumbers({}); }}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              {(classes || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedSection}
            onValueChange={setSelectedSection}
            disabled={!selectedClass}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              {sectionList.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSection && !studentsLoading && !!students?.length && (
            <Button variant="outline" onClick={handleAutoAssign}>
              <Shuffle className="h-4 w-4 mr-2" /> Auto-Assign (Alphabetical)
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedSection && (
        <Card>
          <CardContent className="pt-6">
            {studentsLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading students…</div>
            ) : !students?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                No students found in this section.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Roll No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Admission No.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            className="w-20 h-8"
                            value={rollNumbers[s.id] ?? ""}
                            onChange={(e) =>
                              setRollNumbers((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.first_name} {s.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.student_id || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving…" : "Save Roll Numbers"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedSection && (
        <div className="text-center py-16 text-muted-foreground">
          Select a class and section to view and assign roll numbers.
        </div>
      )}
    </div>
  );
}
