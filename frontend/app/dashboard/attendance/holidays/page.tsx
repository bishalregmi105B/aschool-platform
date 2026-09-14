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
import { Spinner } from "@/components/ui/spinner";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  const { t } = useI18n();
  const confirm = useConfirm();
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
        title={t("Holiday List", "विदा सूची")}
        subtitle={t("Manage school holidays and vacation days", "विद्यालय विदा र बिदा अवधि")}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("Add Holiday", "विदा थप्नुहोस्")}
          </Button>
        }
      />
      <AOSPageBody>
        {isError ? (
          <ErrorState
            body={t("Failed to load holidays.", "विदा सूची लोड हुन सकेन।")}
            onRetry={() => void refetch()}
          />
        ) : holidays.length === 0 && !isLoading ? (
          <div className="win11-card">
            <EmptyState
              icon={CalendarOff}
              title={t("No holidays yet", "अझै विदा छैन")}
              body={t("Mark festivals and vacations so attendance skips those days.", "पर्व र बिदा यहाँ चिन्ह लगाउनुहोस्।")}
              action={{ label: t("Add Holiday", "विदा थप्नुहोस्"), onClick: () => setShowAdd(true) }}
            />
          </div>
        ) : (
        <DataPanel bodyClassName="p-0">
          {isLoading ? <div className="p-4"><SkeletonTable rows={6} columns={5} /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Holiday", "विदा")}</TableHead>
                <TableHead>{t("Date", "मिति")}</TableHead>
                <TableHead>{t("Type", "प्रकार")}</TableHead>
                <TableHead>{t("Description", "विवरण")}</TableHead>
                <TableHead>{t("Actions", " कार्य")}</TableHead>
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
                          confirm({ title: t("Delete holiday", "विदा मेटाउने"), body: t(`Delete "${h.title}"?`, `"${h.title}" मेटाउने?`) }).then((ok) => {
                            if (ok) deleteMutation.mutate(h.id);
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </DataPanel>
        )}

        <Dialog open={showAdd || !!editing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditing(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t("Edit Holiday", "विदा सम्पादन") : t("Add Holiday", "विदा थप्नुहोस्")}</DialogTitle></DialogHeader>
            <form key={editing?.id || "new-holiday"} onSubmit={handleSubmit} className="space-y-4">
              <FormSection title={t("Holiday Details", "विदा विवरण")}>
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
