"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { CalendarOff, Plus, Pencil, Trash2 } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  date_bs?: string;
  description?: string;
  event_type: string;
}

export default function HolidaysPage() {
  return (
    <PluginGate slug="notices">
      <HolidaysContent />
    </PluginGate>
  );
}

function HolidaysContent() {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Holiday[]>>("/notices/events");
      return res.data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/notices/events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday added");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put(`/notices/events/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday updated");
      setEditing(null);
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        <p className="text-sm text-destructive">Failed to load holidays. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  const holidays = data || [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startDate = fd.get("date");
    const payload = {
      title: fd.get("title"),
      start_date: startDate,
      end_date: startDate,
      event_type: fd.get("type") || "holiday",
      is_holiday: fd.get("type") === "holiday",
      description: fd.get("description"),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarOff className="h-6 w-6" /> Holiday List</h1>
          <p className="text-muted-foreground">Manage school holidays and vacation days</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Holiday</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.title}</TableCell>
                  <TableCell>{h.date_bs || h.start_date}</TableCell>
                  <TableCell><Badge variant="secondary">{h.event_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{h.description || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${h.title}`}
                        onClick={() => setEditing(h)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${h.title}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Delete "${h.title}"?`))
                            deleteMutation.mutate(h.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {holidays.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No holidays added yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd || !!editing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
          <form key={editing?.id || "new-holiday"} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Holiday name" defaultValue={editing?.title} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label><BSDateInput name="date" required value={editing?.start_date || undefined} /></div>
              <div className="space-y-2"><Label>Type</Label>
                <select name="type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editing?.event_type || "holiday"}>
                  <option value="holiday">Holiday</option>
                  <option value="vacation">Vacation</option>
                  <option value="festival">Festival</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" placeholder="Optional description" defaultValue={editing?.description} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner className="mr-2" /> : editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
