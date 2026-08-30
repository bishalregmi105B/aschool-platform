"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Wand2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

interface TimetableSlot {
  id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetablePage() {
  return (
    <PluginGate slug="timetable">
      <TimetableContent />
    </PluginGate>
  );
}

function TimetableContent() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [showAddSlot, setShowAddSlot] = useState(false);

  const { data: classes, isError: classesError, refetch: refetchClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/academics/classes");
      return (res.data.data as Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>) || [];
    },
    retry: 1,
  });

  const selectedClass = classes?.find((c: any) => c.id === classId);

  const { data: slots, isLoading, isError, refetch } = useQuery({
    queryKey: ["timetable", classId, sectionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);
      const res = await api.get<ApiResponse>(`/timetable?${params}`);
      return (res.data.data as TimetableSlot[]) || [];
    },
    enabled: !!classId,
    retry: 1,
  });

  const deleteSlotMut = useMutation({
    mutationFn: async (slotId: string) => api.delete(`/timetable/slots/${slotId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Slot removed");
    },
    onError: () => toast.error("Failed to remove slot"),
  });

  // Group slots by day
  const grouped: Record<string, TimetableSlot[]> = {};
  DAYS.forEach((d: any) => { grouped[d] = []; });
  slots?.forEach((s: any) => {
    if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
  });

  const maxPeriods = Math.max(8, ...Object.values(grouped).map((arr: any) => arr.length));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">View, edit and auto-generate class timetables</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddSlot(true)} disabled={!classId}>
            <Plus className="h-4 w-4 mr-2" /> Add Slot
          </Button>
          <Link href="/dashboard/timetable/generate">
            <Button>
              <Wand2 className="h-4 w-4 mr-2" /> Auto Generate
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>
            {classes?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClass && (
          <Select value={sectionId || "all"} onValueChange={(v) => setSectionId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {selectedClass.sections?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {classesError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">Failed to load classes.</p>
            <Button variant="outline" size="sm" onClick={() => refetchClasses()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">Failed to load the timetable.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? <PageLoader /> : classId && (
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted text-left">Day / Period</th>
                  {Array.from({ length: maxPeriods }, (_, i) => (
                    <th key={i} className="border p-2 bg-muted text-center">P{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day: any) => (
                  <tr key={day}>
                    <td className="border p-2 font-medium bg-muted/50">{day}</td>
                    {Array.from({ length: maxPeriods }, (_, i) => {
                      const slot = grouped[day]?.find((s: any) => s.period_number === i + 1);
                      return (
                        <td key={i} className="border p-2 text-center text-xs">
                          {slot ? (
                            <div className="group relative">
                              <p className="font-medium pr-4">{slot.subject_name || "Unassigned"}</p>
                              <p className="text-muted-foreground">{slot.teacher_name || ""}</p>
                              {(slot.start_time || slot.end_time) && (
                                <p className="text-[10px] text-muted-foreground">
                                  {slot.start_time?.slice(0, 5) || ""}{slot.end_time ? ` - ${slot.end_time.slice(0, 5)}` : ""}
                                </p>
                              )}
                              <button
                                aria-label={`Remove slot ${day} P${slot.period_number}`}
                                className="absolute top-0 right-0 hidden group-hover:block text-destructive"
                                disabled={deleteSlotMut.isPending}
                                onClick={() => {
                                  if (confirm(`Remove ${slot.subject_name || "this slot"} on ${day} (P${slot.period_number})?`))
                                    deleteSlotMut.mutate(slot.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <AddSlotDialog
        open={showAddSlot}
        onOpenChange={setShowAddSlot}
        classId={classId}
        classes={classes || []}
      />
    </div>
  );
}

function AddSlotDialog({
  open,
  onOpenChange,
  classId,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  classes: Array<{ id: string; name: string; sections?: Array<{ id: string; name: string }> }>;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedClass = classes.find((c) => c.id === classId);

  const { data: subjects } = useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/academics/classes/${classId}/subjects`);
      return (res.data.data as Array<{ id: string; name: string }>) || [];
    },
    enabled: open && !!classId,
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/users?role=teacher");
      return (res.data.data as Array<{ id: string; full_name: string }>) || [];
    },
    enabled: open,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        class_id: classId,
        section_id: fd.get("section_id") || undefined,
        subject_id: fd.get("subject_id") || undefined,
        teacher_id: fd.get("teacher_id") || undefined,
        day_of_week: fd.get("day_of_week"),
        period_number: Number(fd.get("period_number")),
      };
      const start = fd.get("start_time");
      const end = fd.get("end_time");
      if (start) payload.start_time = start;
      if (end) payload.end_time = end;
      await api.post("/timetable/slots", payload);
      toast.success("Slot added");
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    } catch (err: unknown) {
      // Backend returns 409 with a specific clash message — show it directly.
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || "Failed to add slot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Timetable Slot</DialogTitle>
        </DialogHeader>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <select name="subject_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— None —</option>
                {(subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Teacher</Label>
              <select name="teacher_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— None —</option>
                {(teachers || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <select name="section_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">All sections</option>
                {(selectedClass?.sections || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Input name="period_number" type="number" min={1} max={12} defaultValue={1} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Day</Label>
              <select name="day_of_week" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input name="start_time" type="time" placeholder="10:00" />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input name="end_time" type="time" placeholder="10:45" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !classId}>
              {saving ? "Saving…" : "Add Slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
