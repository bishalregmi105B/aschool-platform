"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
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
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
} from "@/components/aos/kit/page-kit";
import { CalendarOff, Plus, Pencil, Trash2 } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
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
      <div className="win11-card p-6 text-center space-y-3">
        <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load holidays. Please try again.</p>
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
    <AOSPage>
      <AOSPageHeader
        icon={<CalendarOff className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Holiday List"
        subtitle="Manage school holidays and vacation days"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Holiday
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
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
                        <Trash2 className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {holidays.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-[color:var(--w11-text-secondary)]">No holidays added yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DataPanel>

        <Dialog open={showAdd || !!editing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditing(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
            <form key={editing?.id || "new-holiday"} onSubmit={handleSubmit} className="space-y-4">
              <FormSection title="Holiday Details">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Holiday name" defaultValue={editing?.title} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Date</Label><BSDateInput name="date" required value={editing?.start_date || undefined} /></div>
                    <div className="space-y-2"><Label>Type</Label>
                      <AdvancedSelect
                        name="type"
                        defaultValue={editing?.event_type || "holiday"}
                        options={[
                          { value: "holiday", label: "Holiday" },
                          { value: "vacation", label: "Vacation" },
                          { value: "festival", label: "Festival" },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Input name="description" placeholder="Optional description" defaultValue={editing?.description} /></div>
                </div>
              </FormSection>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Spinner className="mr-2" /> : editing ? "Update" : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
