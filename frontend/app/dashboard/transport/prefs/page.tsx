"use client";

/**
 * Geofence Alerts (per-student) — the SBT v2.3 "radius picker dialog" steal.
 *
 * One row per transport-allocated student; the row opens a dialog with the
 * radius picker (Off / 100 m / 300 m / 1 km / 2 km — the backend clamps to
 * 50–2000 m) and the seven notification toggles from
 * `transport_notification_prefs`. "Off" writes notify_near_* = false; picking
 * a radius re-enables it. Endpoints: GET/PUT /transport/notification-prefs.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Bell, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useDebounced } from "@/components/ui/filter-bar";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, FilterCommandBar, StatusChip,
} from "@/components/aos/kit/page-kit";
import { ListView } from "@/components/aos/kit/detail-kit";

interface Pref {
  student_id: string;
  near_pickup_radius_m: number | null;
  near_dropoff_radius_m: number | null;
  notify_next_stop_pickup: boolean;
  notify_near_pickup: boolean;
  notify_arrived_pickup: boolean;
  notify_picked_up: boolean;
  notify_missed_pickup: boolean;
  notify_near_dropoff: boolean;
  notify_arrived_dropoff: boolean;
}

interface StopLite { id: string; route_id: string; name: string; student_ids: string[] }
interface RouteLite { id: string; name: string }
interface StudentLite { id: string; full_name: string; admission_number?: string; class_name?: string; section_name?: string }

/** SBT's per-student radius choices; null = alerts off for that hop. */
const RADIUS_OPTIONS: { value: string; label: string; labelNe: string; m: number | null }[] = [
  { value: "off", label: "Off", labelNe: "बन्द", m: null },
  { value: "100", label: "100 m", labelNe: "१०० मि", m: 100 },
  { value: "300", label: "300 m", labelNe: "३०० मि", m: 300 },
  { value: "1000", label: "1 km", labelNe: "१ कि.मी.", m: 1000 },
  { value: "2000", label: "2 km", labelNe: "२ कि.मी.", m: 2000 },
];

function radiusLabel(m: number | null, on: boolean, t: (e: string, n: string) => string): string {
  if (!on || m == null) return t("Off", "बन्द");
  const opt = RADIUS_OPTIONS.find((o) => o.m === m);
  return opt ? t(opt.label, opt.labelNe) : `${m} m`;
}

const DEFAULT_PREF: Omit<Pref, "student_id"> = {
  near_pickup_radius_m: 150,
  near_dropoff_radius_m: 150,
  notify_next_stop_pickup: true,
  notify_near_pickup: true,
  notify_arrived_pickup: true,
  notify_picked_up: true,
  notify_missed_pickup: true,
  notify_near_dropoff: true,
  notify_arrived_dropoff: true,
};

function errMessage(err: unknown): string | null {
  const raw = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  if (typeof raw === "string") return raw;
  return raw?.message ?? (err instanceof Error ? err.message : null);
}

export default function TransportPrefsPage() {
  return <AppGate slug="gps_tracking"><PrefsContent /></AppGate>;
}

function PrefsContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const [editStudent, setEditStudent] = useState<StudentLite | null>(null);

  const { data: stops } = useQuery({
    queryKey: ["transport-stops"],
    queryFn: async () => (await api.get<ApiResponse<StopLite[]>>("/transport/stops")).data?.data || [],
  });
  const { data: routes } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => (await api.get<ApiResponse<RouteLite[]>>("/transport/routes")).data?.data || [],
  });
  const { data: students } = useQuery({
    queryKey: ["transport-prefs-students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentLite[]>>("/students?limit=500");
      return res.data?.data || [];
    },
  });
  const { data: prefData, isLoading } = useQuery({
    queryKey: ["transport-notification-prefs"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ prefs: Pref[]; defaults: { near_pickup_radius_m: number; near_dropoff_radius_m: number } }>>(
        "/transport/notification-prefs"
      );
      return res.data?.data;
    },
  });

  const prefByStudent = useMemo(
    () => new Map((prefData?.prefs || []).map((p) => [p.student_id, p])),
    [prefData]
  );
  const routeNameById = useMemo(
    () => Object.fromEntries((routes || []).map((r) => [r.id, r.name])),
    [routes]
  );
  const stopsByStudent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of stops || []) {
      for (const sid of s.student_ids || []) {
        m.set(sid, [...(m.get(sid) || []), s.name]);
      }
    }
    return m;
  }, [stops]);

  // Rows = students allocated to a stop (that is who gets bus alerts at all).
  const rows = useMemo(() => {
    const allocated = [...stopsByStudent.keys()];
    const byId = new Map((students || []).map((s) => [s.id, s]));
    return allocated
      .map((id) => byId.get(id))
      .filter((s): s is StudentLite => Boolean(s))
      .filter((s) =>
        !q ||
        (s.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
        (s.admission_number || "").toLowerCase().includes(q.toLowerCase())
      )
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [stopsByStudent, students, q]);

  const totalAllocated = stopsByStudent.size;

  const COLUMNS: Column<StudentLite>[] = [
    {
      key: "name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (s) => s.full_name ?? "",
      render: (s) => (
        <div>
          <div className="font-medium">{s.full_name}</div>
          <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {[s.admission_number, s.class_name && `${s.class_name} ${s.section_name || ""}`.trim()].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    {
      key: "stops",
      label: t("Pickup stop", "पिकअप स्टप"),
      value: (s) => (stopsByStudent.get(s.id) || []).join(", "),
      render: (s) => (
        <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          <MapPin className="h-3.5 w-3.5" />
          {(stopsByStudent.get(s.id) || []).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "pickup",
      label: t("Near-pickup alert", "नजिकै-पिकअप अलर्ट"),
      value: (s) => {
        const p = prefByStudent.get(s.id);
        return p && p.notify_near_pickup ? String(p.near_pickup_radius_m ?? 150) : "off";
      },
      render: (s) => {
        const p = prefByStudent.get(s.id);
        const on = !p || p.notify_near_pickup;
        return <StatusChip status={on ? "active" : "inactive"} label={radiusLabel(p?.near_pickup_radius_m ?? 150, on, t)} />;
      },
    },
    {
      key: "dropoff",
      label: t("Near-dropoff alert", "नजिकै-ड्रपअफ अलर्ट"),
      value: (s) => {
        const p = prefByStudent.get(s.id);
        return p && p.notify_near_dropoff ? String(p.near_dropoff_radius_m ?? 150) : "off";
      },
      render: (s) => {
        const p = prefByStudent.get(s.id);
        const on = !p || p.notify_near_dropoff;
        return <StatusChip status={on ? "active" : "inactive"} label={radiusLabel(p?.near_dropoff_radius_m ?? 150, on, t)} />;
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      noExport: true,
      render: (s) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditStudent(s); }}>
          {t("Edit alerts", "अलर्ट सम्पादन")}
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AOSPage>
        <AOSPageHeader icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} title={t("Geofence Alerts", "जियोफेन्स अलर्ट")} />
        <AOSPageBody>
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Geofence Alerts", "जियोफेन्स अलर्ट")}
        subtitle={t(
          `${totalAllocated} students on transport — per-student bus-approach radius`,
          `${totalAllocated} विद्यार्थी ट्रान्स्पोर्टमा — प्रति-विद्यार्थी बस-निकट radius`
        )}
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="relative w-[260px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--w11-text-tertiary)" }} />
            <Input
              className="pl-8"
              placeholder={t("Search student…", "विद्यार्थी खोज्नुहोस्…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FilterCommandBar>

        <DataPanel bodyClassName="p-0">
          <DataTable<StudentLite>
            columns={COLUMNS}
            rows={rows}
            rowKey={(s) => s.id}
            exportFileName="geofence-alerts"
            empty={{
              icon: Bell,
              title: q ? t("No student matches", "कुनै विद्यार्थी भेटिएन") : t("No students allocated yet", "अझै विद्यार्थी छुट्याइएको छैन"),
              body: q
                ? t("Try a different name or admission number.", "अर्को नाम वा भर्ना नम्बर प्रयास गर्नुहोस्।")
                : t("Allocate students to stops on the Transport Allocation page; alert settings unlock per allocated student.", "Transport Allocation मा स्टपमा विद्यार्थी छान्नुहोस्।"),
            }}
          />
        </DataPanel>
      </AOSPageBody>

      {editStudent && (
        <AlertRadiusDialog
          student={editStudent}
          routeHint={(stopsByStudent.get(editStudent.id) || []).join(", ")}
          pref={prefByStudent.get(editStudent.id)}
          onClose={() => setEditStudent(null)}
          onSaved={() => {
            setEditStudent(null);
            queryClient.invalidateQueries({ queryKey: ["transport-notification-prefs"] });
          }}
        />
      )}
    </AOSPage>
  );
}

/** The radius picker dialog: 5-option list + near switches + event toggles. */
function AlertRadiusDialog({
  student,
  routeHint,
  pref,
  onClose,
  onSaved,
}: {
  student: StudentLite;
  routeHint: string;
  pref?: Pref;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const current: Pref = { ...(DEFAULT_PREF as Pref), student_id: student.id, ...(pref || {}) };
  const [pickupOn, setPickupOn] = useState(pref ? pref.notify_near_pickup : true);
  const [dropoffOn, setDropoffOn] = useState(pref ? pref.notify_near_dropoff : true);
  const [pickupRadius, setPickupRadius] = useState(String(pref?.near_pickup_radius_m ?? 150));
  const [dropoffRadius, setDropoffRadius] = useState(String(pref?.near_dropoff_radius_m ?? 150));
  const [events, setEvents] = useState({
    notify_next_stop_pickup: current.notify_next_stop_pickup,
    notify_arrived_pickup: current.notify_arrived_pickup,
    notify_picked_up: current.notify_picked_up,
    notify_missed_pickup: current.notify_missed_pickup,
    notify_arrived_dropoff: current.notify_arrived_dropoff,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const save = useMutation({
    mutationFn: async () =>
      api.put("/transport/notification-prefs", {
        student_id: student.id,
        near_pickup_radius_m: parseInt(pickupRadius, 10) || 150,
        near_dropoff_radius_m: parseInt(dropoffRadius, 10) || 150,
        notify_near_pickup: pickupOn,
        notify_near_dropoff: dropoffOn,
        ...events,
      }),
    onSuccess: () => {
      toast.success(t("Alert settings saved", "अलर्ट सेभिङ भयो"));
      onSaved();
    },
    onError: (err) => toast.error(errMessage(err) || t("Failed to save", "सुरक्षित गर्न सकिएन")),
  });

  const pickRadius = (which: "pickup" | "dropoff", value: string) => {
    if (value === "off") {
      if (which === "pickup") setPickupOn(false);
      else setDropoffOn(false);
      return;
    }
    if (which === "pickup") {
      setPickupRadius(value);
      setPickupOn(true);
    } else {
      setDropoffRadius(value);
      setDropoffOn(true);
    }
  };

  const toggleRows: { key: keyof typeof events; label: string; labelNe: string }[] = [
    { key: "notify_next_stop_pickup", label: "Next stop is the pickup point", labelNe: "अर्को स्टप पिकअप हो" },
    { key: "notify_arrived_pickup", label: "Bus arrived at pickup stop", labelNe: "बस पिकअप स्टपमा पुग्यो" },
    { key: "notify_picked_up", label: "Student boarded", labelNe: "विद्यार्थी चढ्यो" },
    { key: "notify_missed_pickup", label: "Student missed pickup", labelNe: "विद्यार्थी छुट्यो" },
    { key: "notify_arrived_dropoff", label: "Bus arrived at drop-off stop", labelNe: "बस ड्रपअफ स्टपमा पुग्यो" },
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("Bus alerts for", "बस अलर्ट:") + " " + student.full_name}
          </DialogTitle>
        </DialogHeader>
        {routeHint && (
          <p className="-mt-2 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Stop", "स्टप")}: {routeHint}
          </p>
        )}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Near pickup (approach radius)", "पिकअप नजिकिको दूरी")}
              </p>
              <ListView
                aria-label={t("Pickup radius", "पिकअप radius")}
                selectedId={pickupOn ? pickupRadius : "off"}
                onSelect={(v) => pickRadius("pickup", v)}
                items={RADIUS_OPTIONS.map((o) => ({
                  id: o.value,
                  primary: t(o.label, o.labelNe),
                  secondary:
                    o.value === "off"
                      ? t("No approach alert", "नजिकैको अलर्ट छैन")
                      : undefined,
                }))}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Near drop-off (approach radius)", "ड्रपअफ नजिकिको दूरी")}
              </p>
              <ListView
                aria-label={t("Dropoff radius", "ड्रपअफ radius")}
                selectedId={dropoffOn ? dropoffRadius : "off"}
                onSelect={(v) => pickRadius("dropoff", v)}
                items={RADIUS_OPTIONS.map((o) => ({
                  id: o.value,
                  primary: t(o.label, o.labelNe),
                  secondary:
                    o.value === "off"
                      ? t("No approach alert", "नजिकैको अलर्ट छैन")
                      : undefined,
                }))}
              />
            </div>
          </div>

          {/* Advanced ▾ — the remaining per-event toggles stay collapsed. */}
          <div>
            <button
              type="button"
              className="text-[12px] font-medium"
              style={{ color: "var(--w11-accent)" }}
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? "▾" : "▸"} {t("Advanced — other alert events", "Advanced — अन्य अलर्ट इभेन्टहरू")}
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2">
                {toggleRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <span className="text-[13px]" style={{ color: "var(--w11-text-primary)" }}>
                      {t(row.label, row.labelNe)}
                    </span>
                    <Switch
                      checked={events[row.key]}
                      onCheckedChange={(v) => setEvents((e) => ({ ...e, [row.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("Cancel", "रद्द")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? t("Saving…", "सुरक्षित हुँदै…") : t("Save", "सुरक्षित")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
