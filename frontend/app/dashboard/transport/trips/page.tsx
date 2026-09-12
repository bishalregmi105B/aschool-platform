"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { CalendarClock, Clock, Pencil, Plus, Route as RouteIcon, Trash2, Archive, ArchiveRestore } from "lucide-react";

interface Trip {
  id: string;
  name: string | null;
  route_id: string;
  route_name: string | null;
  bus_id: string | null;
  bus: string | null;
  driver_id: string | null;
  direction: "morning" | "afternoon";
  effective_date_bs: string | null;
  weekdays: number[];
  first_stop_time: string | null;
  stop_to_stop_avg_mins: number | null;
  status: "active" | "retired";
}

interface RouteOption { id: string; name: string; is_active: boolean }
interface BusOption { id: string; vehicle_number: string }
interface StaffOption { id: string; full_name: string }

// ISO weekday ints, Mon=0 … Sun=6 (the backend contract).
const WEEKDAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

interface TripForm {
  name: string;
  route_id: string;
  direction: "morning" | "afternoon";
  bus_id: string;
  driver_id: string;
  weekdays: number[];
  first_stop_time: string;
  stop_to_stop_avg_mins: string;
  effective_date_bs: string;
}

const EMPTY_FORM: TripForm = {
  name: "",
  route_id: "",
  direction: "morning",
  bus_id: "",
  driver_id: "",
  weekdays: [0, 1, 2, 3, 4],
  first_stop_time: "",
  stop_to_stop_avg_mins: "5",
  effective_date_bs: "",
};

function errMessage(err: unknown): string | null {
  const raw = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  if (typeof raw === "string") return raw;
  return raw?.message ?? (err instanceof Error ? err.message : null);
}

export default function TripsPage() {
  return (
    <PluginGate slug="gps_tracking">
      <TripsContent />
    </PluginGate>
  );
}

function TripsContent() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"" | "morning" | "afternoon">("");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Trip | null>(null);
  const [form, setForm] = useState<TripForm>(EMPTY_FORM);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["transport-trips"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ trips: Trip[] }>>("/transport/trips", {
        params: { per_page: 100 },
      });
      return res.data?.data?.trips || [];
    },
  });

  const { data: routes } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RouteOption[]>>("/transport/routes");
      return (res.data?.data || []) as RouteOption[];
    },
  });

  const { data: buses } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BusOption[]>>("/transport/buses");
      return (res.data?.data || []) as BusOption[];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["transport-trip-staff"],
    queryFn: async () => {
      const res = await api.get("/staff", { params: { per_page: 100 } });
      return (res.data?.data || []) as StaffOption[];
    },
  });

  const trips: Trip[] = useMemo(
    () =>
      (data || []).filter((t) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          (t.name || "").toLowerCase().includes(q) ||
          (t.route_name || "").toLowerCase().includes(q) ||
          (t.bus || "").toLowerCase().includes(q);
        const matchesDirection = !directionFilter || t.direction === directionFilter;
        return matchesSearch && matchesDirection;
      }),
    [data, search, directionFilter]
  );

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, route_id: (routes || [])[0]?.id || "" });
    setEditItem(null);
    setShowDialog(true);
  };

  const openEdit = (t: Trip) => {
    setForm({
      name: t.name || "",
      route_id: t.route_id || "",
      direction: t.direction || "morning",
      bus_id: t.bus_id || "",
      driver_id: t.driver_id || "",
      weekdays: t.weekdays || [],
      first_stop_time: t.first_stop_time ? t.first_stop_time.slice(0, 5) : "",
      stop_to_stop_avg_mins: String(t.stop_to_stop_avg_mins ?? 5),
      effective_date_bs: t.effective_date_bs || "",
    });
    setEditItem(t);
    setShowDialog(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        route_id: form.route_id,
        direction: form.direction,
        name: form.name.trim() || undefined,
        bus_id: form.bus_id || undefined,
        driver_id: form.driver_id || undefined,
        weekdays: form.weekdays,
        first_stop_time: form.first_stop_time || undefined,
        stop_to_stop_avg_mins: parseInt(form.stop_to_stop_avg_mins, 10) || 5,
        effective_date_bs: form.effective_date_bs || undefined,
      };
      if (editItem) return (await api.put(`/transport/trips/${editItem.id}`, payload)).data;
      return (await api.post("/transport/trips", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-trips"] });
      setShowDialog(false);
      toast.success(editItem ? "Trip updated" : "Trip added");
    },
    onError: (err) => toast.error(errMessage(err) || "Failed to save trip"),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "retired" }) =>
      api.put(`/transport/trips/${id}`, { status }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["transport-trips"] });
      toast.success(vars.status === "retired" ? "Trip retired" : "Trip reactivated");
    },
    onError: () => toast.error("Failed to update trip status"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/transport/trips/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-trips"] });
      toast.success("Trip deleted");
    },
    onError: () => toast.error("Failed to delete trip"),
  });

  const handleRetire = async (t: Trip) => {
    const retiring = t.status === "active";
    const ok = await confirm({
      title: retiring ? "Retire this trip?" : "Reactivate this trip?",
      body: retiring
        ? `“${t.name || t.route_name || "Trip"}” will stop generating daily runs. Existing runs are kept.`
        : `“${t.name || t.route_name || "Trip"}” will generate daily runs again.`,
      confirmLabel: retiring ? "Retire" : "Reactivate",
      tone: retiring ? "danger" : "default",
    });
    if (ok) setStatus.mutate({ id: t.id, status: retiring ? "retired" : "active" });
  };

  const handleDelete = async (t: Trip) => {
    const ok = await confirm({
      title: "Delete this trip?",
      body: `“${t.name || t.route_name || "Trip"}” and its schedule will be removed permanently.`,
      confirmLabel: "Delete",
      tone: "danger",
      requireText: "DELETE",
    });
    if (ok) remove.mutate(t.id);
  };

  const toggleWeekday = (day: number) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(day)
        ? f.weekdays.filter((d) => d !== day)
        : [...f.weekdays, day].sort((a, b) => a - b),
    }));
  };

  const TRIP_COLUMNS: Column<Trip>[] = [
    {
      key: "route_name",
      label: "Route",
      sortable: true,
      value: (t) => t.route_name ?? "",
      render: (t) => (
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 shrink-0" style={{ color: "var(--w11-text-secondary)" }} />
          <div className="min-w-0">
            <div className="font-medium truncate">{t.name || t.route_name || "—"}</div>
            {t.name && t.route_name && (
              <div className="text-xs truncate" style={{ color: "var(--w11-text-secondary)" }}>{t.route_name}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "direction",
      label: "Direction",
      sortable: true,
      value: (t) => t.direction ?? "",
      render: (t) => (
        <span className="win11-chip subtle capitalize">
          {t.direction === "morning" ? "Morning" : "Afternoon"}
        </span>
      ),
    },
    {
      key: "bus",
      label: "Bus",
      sortable: true,
      value: (t) => t.bus ?? "",
      render: (t) => t.bus || <span style={{ color: "var(--w11-text-secondary)" }}>Unassigned</span>,
    },
    {
      key: "weekdays",
      label: "Days",
      value: (t) => (t.weekdays || []).map((d) => WEEKDAYS[d]?.label ?? "").join(" "),
      render: (t) =>
        (t.weekdays || []).length === 0 ? (
          <span style={{ color: "var(--w11-text-secondary)" }}>Daily off</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <span
                key={d.value}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-semibold"
                style={
                  t.weekdays.includes(d.value)
                    ? { background: "var(--w11-accent-light)", color: "var(--w11-accent)" }
                    : { background: "var(--w11-control-hover)", color: "var(--w11-text-tertiary)" }
                }
              >
                {d.label[0]}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: "first_stop_time",
      label: "First Stop",
      align: "right",
      sortable: true,
      value: (t) => t.first_stop_time ?? "",
      render: (t) =>
        t.first_stop_time ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3.5 w-3.5" style={{ color: "var(--w11-text-secondary)" }} />
            {t.first_stop_time.slice(0, 5)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (t) => t.status ?? "",
      render: (t) => (
        <StatusChip status={t.status} className="capitalize" />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      noExport: true,
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            title="Edit trip"
            onClick={(e) => { e.stopPropagation(); openEdit(t); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title={t.status === "active" ? "Retire trip" : "Reactivate trip"}
            onClick={(e) => { e.stopPropagation(); handleRetire(t); }}
          >
            {t.status === "active" ? (
              <Archive className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
            ) : (
              <ArchiveRestore className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Delete trip"
            onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
          >
            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
          </Button>
        </div>
      ),
    },
  ];

  const errorMessage = errMessage(error);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<CalendarClock className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Trip Schedules"
        subtitle={`${trips.length} recurring ${trips.length === 1 ? "trip" : "trips"} — morning and afternoon runs`}
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add Trip
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable<Trip>
            columns={TRIP_COLUMNS}
            rows={trips}
            rowKey={(t) => t.id}
            loading={isLoading}
            error={errorMessage}
            onRetry={() => refetch()}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search trips…"
            exportFileName="transport-trips"
            toolbar={
              <div className="flex items-center gap-1">
                {(["", "morning", "afternoon"] as const).map((d) => (
                  <Button
                    key={d || "all"}
                    size="sm"
                    variant={directionFilter === d ? "default" : "outline"}
                    onClick={() => setDirectionFilter(d)}
                    className="capitalize"
                  >
                    {d || "All"}
                  </Button>
                ))}
              </div>
            }
            empty={{
              icon: CalendarClock,
              title: search || directionFilter ? "No trips match" : "No trip schedules yet",
              body: search || directionFilter
                ? "Try a different search or direction filter."
                : "Add a trip schedule so runs appear on the daily monitor.",
              action: search || directionFilter ? undefined : { label: "Add Trip", onClick: openAdd },
            }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Trip" : "Add Trip"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Route</Label>
                <AdvancedSelect
                  value={form.route_id}
                  onChange={(v) => setForm({ ...form, route_id: v })}
                  options={(routes || []).map((r) => ({ value: r.id, label: r.name }))}
                  placeholder="Select route"
                  searchable
                />
              </div>

              <div className="space-y-2">
                <Label>Direction</Label>
                <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--w11-control-border)] p-1">
                  {(["morning", "afternoon"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm({ ...form, direction: d })}
                      className={cn("rounded px-3 py-1.5 text-[13px] font-medium capitalize transition-colors")}
                      style={
                        form.direction === d
                          ? { background: "var(--w11-accent)", color: "#fff" }
                          : { color: "var(--w11-text-secondary)" }
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Runs on</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWeekday(d.value)}
                      className="h-8 w-10 rounded-md border text-[12px] font-medium transition-colors"
                      style={
                        form.weekdays.includes(d.value)
                          ? {
                              borderColor: "var(--w11-accent)",
                              background: "var(--w11-accent-light)",
                              color: "var(--w11-accent)",
                            }
                          : {
                              borderColor: "var(--w11-control-border)",
                              color: "var(--w11-text-secondary)",
                            }
                      }
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First stop time</Label>
                  <TimePicker
                    value={form.first_stop_time}
                    onChange={(v) => setForm({ ...form, first_stop_time: v })}
                    placeholder="HH:MM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stop-to-stop avg (mins)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.stop_to_stop_avg_mins}
                    onChange={(e) => setForm({ ...form, stop_to_stop_avg_mins: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bus (optional)</Label>
                  <AdvancedSelect
                    value={form.bus_id}
                    onChange={(v) => setForm({ ...form, bus_id: v })}
                    options={(buses || []).map((b) => ({ value: b.id, label: b.vehicle_number }))}
                    placeholder="Select bus"
                    clearable
                    searchable
                  />
                </div>
                <div className="space-y-2">
                  <Label>Driver (optional)</Label>
                  <AdvancedSelect
                    value={form.driver_id}
                    onChange={(v) => setForm({ ...form, driver_id: v })}
                    options={(staff || []).map((s) => ({ value: s.id, label: s.full_name }))}
                    placeholder="Select driver"
                    clearable
                    searchable
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trip name (optional)</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ring Road Morning"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective from (BS)</Label>
                  <BSDateInput
                    emit="bs"
                    value={form.effective_date_bs}
                    onChange={(v) => setForm({ ...form, effective_date_bs: v })}
                    placeholder="Pick date"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!form.route_id || save.isPending}>
                  {save.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                  {editItem ? "Update" : "Add Trip"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
