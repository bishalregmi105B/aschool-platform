"use client";

/**
 * Hostel — rebuilt per plan 34-32 (Part 32 archetype A1/A8 hybrid):
 * tabs [Rooms | Occupants | Rules]. Rooms tab = hostel occupancy meters
 * (MetricCard) + room card grid; Occupants = allocation table + the new
 * Allocate dialog with a CLIENT-SIDE duplicate-student guard (backend also
 * validates 422 on overlap + room-full — flagged in the wave report for the
 * board-level checks ASchool lacks); Rules = the enforced business rules,
 * read-only (no rules API exists — enforcement is server-side in
 * app/api/v1/hostel.py).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { EntityPicker } from "@/components/ui/entity-picker";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  Building2, BedDouble, Users, Plus, UserX, ShieldAlert, ScrollText, Info,
} from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

// Backend GET /hostel/summary returns per-hostel stats:
// {hostel_id, hostel_name, type, total_rooms, total_capacity, occupied, available, occupancy_pct}
interface HostelStat { hostel_id: string; hostel_name: string; type: string; total_rooms: number; total_capacity: number; occupied: number; available: number; occupancy_pct: number; }
interface HostelSummary { total_hostels: number; total_capacity: number; total_occupied: number; total_available: number; occupancy_rate: number; hostels: HostelStat[]; }
interface HostelRoom { id: string; hostel_id: string; room_number: string; floor?: number | string; room_type?: string; capacity: number; occupied_count: number; is_full: boolean; monthly_fee?: number; }
interface HostelAllocation { id: string; student_id: string; room_id: string; student_name: string; student_roll?: number; hostel_name?: string; room_number?: string; check_in_date?: string; check_out_date?: string; status?: string; monthly_fee?: number; }

function deriveSummary(stats: HostelStat[] | null | undefined): HostelSummary | null {
  if (!stats) return null;
  const total_capacity = stats.reduce((s, h) => s + (h.total_capacity || 0), 0);
  const total_occupied = stats.reduce((s, h) => s + (h.occupied || 0), 0);
  const total_available = stats.reduce((s, h) => s + (h.available || 0), 0);
  return {
    total_hostels: stats.length,
    total_capacity,
    total_occupied,
    total_available,
    occupancy_rate: total_capacity ? (total_occupied / total_capacity) * 100 : 0,
    hostels: stats,
  };
}

function fmt(v?: number) { return v != null ? `Rs. ${v.toLocaleString()}` : "—"; }
const isActive = (a: HostelAllocation) => !(a.status === "checked_out" || a.check_out_date);

export default function HostelPage() {
  return (
    <PluginGate slug="hostel">
      <HostelContent />
    </PluginGate>
  );
}

function HostelContent() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [tab, setTab] = useState("rooms");
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [selHostel, setSelHostel] = useState("");

  const { data: rawSummary, isLoading: sl, isError: se, refetch: srefetch } = useQuery({
    queryKey: ["hostel-summary"],
    queryFn: async () => { const r = await api.get("/hostel/summary"); return (r.data?.data ?? []) as HostelStat[]; },
    retry: 1,
  });
  const summary = deriveSummary(rawSummary);
  const hostels = summary?.hostels ?? [];

  const { data: rooms, isLoading: rl, isError: re, refetch: rrefetch } = useQuery({
    queryKey: ["hostel-rooms", selHostel],
    queryFn: async () => { const p = selHostel ? `?hostel_id=${selHostel}` : ""; const r = await api.get(`/hostel/rooms${p}`); return (r.data?.data ?? []) as HostelRoom[]; },
    retry: 1,
  });

  const { data: allocs, isLoading: al, isError: ae, refetch: arefetch } = useQuery({
    queryKey: ["hostel-allocations"],
    queryFn: async () => { const r = await api.get("/hostel/allocations?per_page=200"); return (r.data?.data ?? []) as HostelAllocation[]; },
    retry: 1,
  });

  const activeAllocs = useMemo(() => (allocs || []).filter(isActive), [allocs]);
  // Client-side duplicate guard set (the backend re-validates — belt & braces).
  const allocatedStudentIds = useMemo(
    () => new Set(activeAllocs.map((a) => a.student_id)),
    [activeAllocs]
  );

  const checkout = useMutation({
    mutationFn: (id: string) => api.post(`/hostel/allocations/${id}/checkout`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostel-allocations"] }); qc.invalidateQueries({ queryKey: ["hostel-summary"] }); qc.invalidateQueries({ queryKey: ["hostel-rooms"] }); toast.success(t("Checked out", "चेकआउट भयो")); },
    onError: () => toast.error(t("Checkout failed", "चेकआउट असफल")),
  });

  if (sl) return <AOSModuleLoadingState label={t("Loading hostel…", "होस्टल लोड हुँदै…")} />;
  if (se) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Hostel", "होस्टल")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load hostel data.", "होस्टल डाटा लोड गर्न सकिएन।")}</p>
              <Button variant="outline" size="sm" onClick={() => srefetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const OCCUPANT_COLUMNS: Column<HostelAllocation>[] = [
    {
      key: "student_name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (a) => a.student_name,
      render: (a) => (
        <div>
          <p className="font-medium">{a.student_name}</p>
          {a.student_roll != null && <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Roll: {a.student_roll}</p>}
        </div>
      ),
    },
    {
      key: "room",
      label: t("Hostel / Room", "होस्टल / कोठा"),
      sortable: true,
      value: (a) => `${a.hostel_name ?? ""} ${a.room_number ?? ""}`,
      render: (a) => (
        <div>
          <p>{a.hostel_name || "—"}</p>
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{t("Room", "कोठा")} {a.room_number || "—"}</p>
        </div>
      ),
    },
    {
      key: "check_in_date",
      label: t("Allocated", "छुट्टिएको मिति"),
      sortable: true,
      value: (a) => a.check_in_date ?? "",
      render: (a) => (
        <span style={{ color: "var(--w11-text-secondary)" }}>
          {a.check_in_date ? displayBS(a.check_in_date) : "—"}
        </span>
      ),
    },
    { key: "monthly_fee", label: t("Fee", "शुल्क"), align: "right", sortable: true, value: (a) => a.monthly_fee ?? 0, render: (a) => <span className="font-medium" style={{ color: "#107c10" }}>{fmt(a.monthly_fee)}</span> },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (a) => (isActive(a) ? "active" : "inactive"),
      render: (a) =>
        isActive(a) ? <StatusChip status="active" label={t("Active", "सक्रिय")} /> : (
          <span className="win11-chip subtle text-xs">{t("Checked Out", "चेकआउट")}</span>
        ),
    },
    {
      key: "action",
      label: t("Action", "कार्य"),
      noExport: true,
      render: (a) =>
        isActive(a) ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            style={{ color: "#c42b1c", borderColor: "rgba(196,43,28,0.3)" }}
            onClick={() => {
              confirm({
                title: t("Check out?", "चेकआउट गर्ने?"),
                body: t(`${a.student_name} will be released from their room.`, `${a.student_name} को कोठा खाली हुनेछ।`),
                confirmLabel: t("Checkout", "चेकआउट"),
                tone: "danger",
              }).then((ok) => { if (ok) checkout.mutate(a.id); });
            }}
          >
            <UserX className="mr-1 h-3 w-3" />{t("Checkout", "चेकआउट")}
          </Button>
        ) : null,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Building2 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Hostel", "होस्टल")}
        subtitle={summary ? `${summary.total_hostels} ${t("hostels", "होस्टल")} · ${summary.total_occupied}/${summary.total_capacity} ${t("beds occupied", "ओगटेको बेड")}` : t("Manage hostels, rooms and students", "होस्टल, कोठा र विद्यार्थी व्यवस्थापन")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddHostel(true)}>
              <Plus className="mr-2 h-4 w-4" />{t("Hostel", "होस्टल")}
            </Button>
            <Button onClick={() => setShowAllocate(true)} disabled={hostels.length === 0}>
              <Users className="mr-2 h-4 w-4" />{t("Allocate", "छुट्टाउनु")}
            </Button>
          </div>
        }
      />
      <AOSPageBody>
        {summary && (
          <StatGrid>
            <MetricCard
              label={t("Occupancy", "अधिकरण दर")}
              value={`${summary.occupancy_rate.toFixed(0)}%`}
              denominator={`/ ${summary.total_capacity}`}
              footnote={`${summary.total_occupied} ${t("beds occupied", "ओगटेको बेड")}`}
            />
            <MetricCard label={t("Hostels", "होस्टल")} value={summary.total_hostels} footnote={`${hostels.filter((h) => h.available > 0).length} ${t("with free beds", "खाली बेडसहित")}`} />
            <MetricCard label={t("Available Beds", "खाली बेड")} value={summary.total_available} footnote={t("Ready to allocate", "छुट्टाउन तयार")} />
            <MetricCard label={t("Residents", "निवासी")} value={activeAllocs.length} footnote={t("Students currently checked in", "अहिले बस्दै आएका विद्यार्थी")} />
          </StatGrid>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="rooms">{t("Rooms", "कोठाहरू")}</TabsTrigger>
            <TabsTrigger value="occupants" badge={activeAllocs.length || undefined}>{t("Occupants", "निवासीहरू")}</TabsTrigger>
            <TabsTrigger value="rules">{t("Rules", "नियमहरू")}</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="mt-4 space-y-4">
            {hostels.length === 0 ? (
              <DataPanel>
                <AOSEmptyState
                  icon={<Building2 className="h-10 w-10" />}
                  title={t("No hostels yet", "अझै होस्टल छैन")}
                  description={t("Add your first hostel to start managing accommodation.", "आयोजना सुरु गर्न पहिलो होस्टल थप्नुहोस्।")}
                  action={{ label: t("Add Hostel", "होस्टल थप्नुहोस्"), onClick: () => setShowAddHostel(true) }}
                />
              </DataPanel>
            ) : (
              <>
                {/* Per-hostel occupancy meters, clickable as room filters. */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hostels.map((h) => (
                    <button
                      key={h.hostel_id}
                      type="button"
                      className="win11-card text-left"
                      style={{ margin: 0, borderColor: selHostel === h.hostel_id ? "var(--w11-accent)" : undefined }}
                      onClick={() => setSelHostel(selHostel === h.hostel_id ? "" : h.hostel_id)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold truncate" style={{ color: "var(--w11-text-primary)" }}>{h.hostel_name}</p>
                        <span className="win11-chip subtle capitalize">{h.type}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full mb-1" style={{ background: "var(--w11-control-hover)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, h.occupancy_pct || 0)}%`,
                            background: (h.occupancy_pct || 0) >= 100 ? "#c42b1c" : (h.occupancy_pct || 0) >= 85 ? "#d83b01" : "var(--w11-accent)",
                          }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                        {h.occupied}/{h.total_capacity} · {h.available} {t("free", "खाली")} · {h.total_rooms} {t("rooms", "कोठा")}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <AdvancedSelect className="w-44" value={selHostel} onChange={(v) => setSelHostel(v)} clearable placeholder={t("All Hostels", "सबै होस्टल")}
                    options={hostels.map((h) => ({ value: h.hostel_id, label: h.hostel_name }))} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddRoom(true)} disabled={hostels.length === 0}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />{t("Add Room", "कोठा थप्नुहोस्")}
                    </Button>
                    <Button size="sm" onClick={() => setShowAllocate(true)}>
                      <Users className="mr-1.5 h-3.5 w-3.5" />{t("Allocate Student", "विद्यार्थी छुट्टाउनु")}
                    </Button>
                  </div>
                </div>

                {rl ? <AOSModuleLoadingState label={t("Loading rooms…", "कोठा लोड हुँदै…")} /> : re ? (
                  <DataPanel className="max-w-2xl mx-auto">
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load rooms.", "कोठा लोड गर्न सकिएन।")}</p>
                      <Button size="sm" variant="outline" onClick={() => rrefetch()}>{t("Retry", "पुनःप्रयास")}</Button>
                    </div>
                  </DataPanel>
                ) : !rooms?.length ? (
                  <DataPanel>
                    <AOSEmptyState icon={<BedDouble className="h-10 w-10" />} title={t("No rooms", "कोठा छैन")} description={t("Add rooms to this hostel.", "यो होस्टलमा कोठा थप्नुहोस्।")} />
                  </DataPanel>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rooms.map((r) => (
                      <div key={r.id} className="win11-card" style={r.is_full ? { borderColor: "#c42b1c", margin: 0 } : { margin: 0 }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{t("Room", "कोठा")} {r.room_number}</p>
                          <span className={`win11-chip text-xs ${r.is_full ? "error" : "success"}`}>{r.is_full ? t("Full", "भरिएको") : t("Available", "खाली")}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full mb-1" style={{ background: "var(--w11-control-hover)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.occupied_count / Math.max(1, r.capacity)) * 100)}%`, background: r.is_full ? "#c42b1c" : "var(--w11-accent)" }} />
                        </div>
                        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{r.occupied_count}/{r.capacity} {t("beds", "बेड")}</p>
                        {r.room_type && <p className="text-xs capitalize mt-1" style={{ color: "var(--w11-text-secondary)" }}>{r.room_type}{r.floor != null && Number(r.floor) > 0 ? ` · ${t("Floor", "तलाइ")} ${r.floor}` : ""}</p>}
                        {r.monthly_fee != null && <p className="text-xs font-medium mt-1" style={{ color: "#107c10" }}>{fmt(r.monthly_fee)}/{t("mo", "महिना")}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="occupants" className="mt-4">
            {al ? <AOSModuleLoadingState label={t("Loading occupants…", "निवासी लोड हुँदै…")} /> : ae ? (
              <DataPanel className="max-w-2xl mx-auto">
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load allocations.", "छुट्टाई लोड गर्न सकिएन।")}</p>
                  <Button size="sm" variant="outline" onClick={() => arefetch()}>{t("Retry", "पुनःप्रयास")}</Button>
                </div>
              </DataPanel>
            ) : !allocs?.length ? (
              <DataPanel>
                <AOSEmptyState
                  icon={<Users className="h-10 w-10" />}
                  title={t("No allocations", "छुट्टाई छैन")}
                  description={t("Allocate a student to an available room.", "खाली कोठामा विद्यार्थी छुट्टाउनुहोस्।")}
                  action={{ label: t("Allocate Student", "विद्यार्थी छुट्टाउनु"), onClick: () => setShowAllocate(true) }}
                />
              </DataPanel>
            ) : (
              <DataPanel bodyClassName="p-0">
                <DataTable
                  columns={OCCUPANT_COLUMNS}
                  rows={allocs}
                  rowKey={(a) => a.id}
                  searchable
                  searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
                  exportFileName="hostel-occupants"
                  dense
                />
              </DataPanel>
            )}
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <RulesTab />
          </TabsContent>
        </Tabs>

        <AddHostelDialog open={showAddHostel} onClose={() => setShowAddHostel(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-summary"] }); setShowAddHostel(false); }} />
        <AddRoomDialog open={showAddRoom} hostels={hostels} defaultHostelId={selHostel} onClose={() => setShowAddRoom(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["hostel-rooms"] }); qc.invalidateQueries({ queryKey: ["hostel-summary"] }); setShowAddRoom(false); }} />
        <AllocateDialog
          open={showAllocate}
          rooms={(rooms || [])}
          hostels={hostels}
          allocatedStudentIds={allocatedStudentIds}
          onClose={() => setShowAllocate(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["hostel-allocations"] });
            qc.invalidateQueries({ queryKey: ["hostel-summary"] });
            qc.invalidateQueries({ queryKey: ["hostel-rooms"] });
            setShowAllocate(false);
            setTab("occupants");
          }}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

/* ── Rules (read-only; enforcement is server-side) ──────────────────────── */

function RulesTab() {
  const { t } = useI18n();
  const rules = [
    { en: "One active room per student — allocating a second room is rejected (422) until checkout.", ne: "एक विद्यार्थीको एक मात्र सक्रिय कोठा — दोस्रो कोठा चेकआउटसम्म अस्वीकार हुन्छ।" },
    { en: "A room cannot exceed its bed capacity; full rooms block new allocations.", ne: "कोठाले आफ्नो बेड क्षमता नाघ्न पाउँदैन; भरिएको कोठामा नयाँ छुट्टाई रोकिन्छ।" },
    { en: "Hostel gender type (boys/girls/mixed) governs which students may be allocated.", ne: "होस्टलको लिङ्ग प्रकारले कुन विद्यार्थी बस्न मिल्छ तोक्छ।" },
    { en: "Monthly room fee feeds the hostel bill cycle; checkout defaults to today's date.", ne: "मासिक कोठा शुल्कले होस्टल महसुल चक्र चलाउँछ; चेकआउट आजैबाट हुन्छ।" },
    { en: "Only school admins can create, allocate, or check out (role_required on the API).", ne: "विद्यालय प्रशासकले मात्र सिर्जना/छुट्टाई/चेकआउट गर्न मिल्छ।" },
  ];
  return (
    <div className="space-y-4">
      <p className="win11-infobar info rounded-md px-3 py-2 text-[12px] inline-flex items-center gap-2">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {t(
          "These rules are enforced server-side (backend plugin `hostel`). There is no editable rules API yet — see the wave-E report for the flagged backend gap.",
          "यी नियम सर्भर-साइड लागू हुन् (ब्याकएन्ड `hostel` प्लगिन)। नियम सम्पादन गर्ने API अहिले छैन।"
        )}
      </p>
      <DataPanel title={t("Enforced business rules", "लागू व्यावसायिक नियम")}>
        <ul className="space-y-2">
          {rules.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--w11-accent)" }} />
              <span style={{ color: "var(--w11-text-primary)" }}>{t(r.en, r.ne)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          <ScrollText className="mr-1 inline h-3.5 w-3.5" />
          {t("Parents can see their child's room + warden in the mobile app:", "अभिभावकले मोबाइलमा सन्तानको कोठा/वार्डेन देख्न सक्छन्:")}{" "}
          <Link className="underline" style={{ color: "var(--w11-accent)" }} href="/dashboard/parents">{t("Parents module", "अभिभावक मोड्युल")}</Link>
        </p>
      </DataPanel>
    </div>
  );
}

/* ── Allocate dialog (duplicate-student guard) ─────────────────────────── */

function AllocateDialog({
  open,
  rooms,
  hostels,
  allocatedStudentIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  rooms: HostelRoom[];
  hostels: HostelStat[];
  allocatedStudentIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const hostelNameById = useMemo(() => Object.fromEntries(hostels.map((h) => [h.hostel_id, h.hostel_name])), [hostels]);
  const [studentId, setStudentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [saving, setSaving] = useState(false);

  const duplicate = studentId && allocatedStudentIds.has(studentId);
  const freeRooms = (rooms || []).filter((r) => !r.is_full);

  const save = async () => {
    if (!studentId || !roomId || !checkIn || duplicate) return;
    setSaving(true);
    try {
      await api.post("/hostel/allocations", { student_id: studentId, room_id: roomId, check_in_date: checkIn });
      toast.success(t("Student allocated", "विद्यार्थी छुट्टाइयो"));
      setStudentId(""); setRoomId(""); setCheckIn("");
      onSaved();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || t("Allocation failed", "छुट्टाई असफल"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Allocate Student to Room", "कोठामा विद्यार्थी छुट्टाउनुहोस्")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("Student", "विद्यार्थी")} *</Label>
            <EntityPicker
              value={studentId}
              onChange={(id) => setStudentId(id)}
              query={{ path: "/students", searchKey: "q", perPage: 20 }}
              getOptions={(rows) =>
                (rows as any[])
                  .filter((s) => !allocatedStudentIds.has(s.id)) // duplicate guard at the source
                  .map((s) => ({ value: s.id, label: s.full_name ?? s.id, hint: s.admission_number }))
              }
              placeholder={t("Search student (already-allocated students are hidden)…", "विद्यार्थी खोज्नुहोस्…")}
              nePlaceholder="विद्यार्थी खोज्नुहोस्…"
            />
            {duplicate && (
              <p className="text-[12px]" style={{ color: "#c42b1c" }}>
                {t("This student already has an active room — check them out first.", "यस विद्यार्थीको पहिले नै सक्रिय कोठा छ — पहिले चेकआउट गर्नुहोस्।")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("Room (free beds only)", "कोठा (खाली बेड मात्र)")} *</Label>
            {freeRooms.length === 0 ? (
              <p className="text-[12px]" style={{ color: "#d83b01" }}>{t("No room has free beds. Add rooms or check someone out.", "कुनै कोठामा खाली बेड छैन।")}</p>
            ) : (
              <AdvancedSelect
                value={roomId}
                onChange={setRoomId}
                searchable
                placeholder={t("Select room", "कोठा छान्नुहोस्")}
                options={freeRooms.map((r) => ({
                  value: r.id,
                  label: `${hostelNameById[r.hostel_id] ?? "?"} · ${t("Room", "कोठा")} ${r.room_number}`,
                  hint: `${r.occupied_count}/${r.capacity}`,
                }))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("Check-in date", "प्रवेश मिति")} *</Label>
            <BSDateInput emit="ad" value={checkIn} onChange={setCheckIn} placeholder={t("Pick date", "मिति छान्नुहोस्")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Cancel", "रद्द")}</Button>
          <Button onClick={save} disabled={!studentId || !roomId || !checkIn || duplicate || saving}>
            {saving ? t("Saving…", "सुरक्षित हुँदै…") : t("Allocate", "छुट्टाउनु")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Existing dialogs (kept) ───────────────────────────────────────────── */

function AddHostelDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", gender: "male", warden_name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) { toast.error(t("Name required", "नाम आवश्यक")); return; }
    setSaving(true);
    // Backend contract: POST /hostel {name, type(boys|girls|mixed), warden_name, warden_phone, description}
    try { await api.post("/hostel", { name: f.name.trim(), type: f.gender === "male" ? "boys" : f.gender === "female" ? "girls" : "mixed", warden_name: f.warden_name || undefined, warden_phone: f.phone || undefined, description: f.address || undefined }); onSaved(); toast.success(t("Hostel added", "होस्टल थपियो")); setF({ name: "", gender: "male", warden_name: "", phone: "", address: "" }); }
    catch { toast.error(t("Failed to add hostel", "होस्टल थप्न सकिएन")); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent><DialogHeader><DialogTitle>{t("Add Hostel", "होस्टल थप्नुहोस्")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>{t("Name", "नाम")} *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("e.g. Boys Hostel Block A", "जस्तै किडानी होस्टल")} /></div>
          <div className="space-y-1.5"><Label>{t("Gender", "लिङ्ग")}</Label><AdvancedSelect
            value={f.gender}
            onChange={(v) => setF({ ...f, gender: v })}
            options={[{ value: "male", label: t("Boys", "छोरा") }, { value: "female", label: t("Girls", "छोरी") }, { value: "mixed", label: t("Mixed", "मिश्रित") }]}
          /></div>
          <div className="space-y-1.5"><Label>{t("Warden name", "वार्डेन नाम")}</Label><Input value={f.warden_name} onChange={(e) => setF({ ...f, warden_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("Warden phone", "वार्डेन फोन")}</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("Address", "ठेगाना")}</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t("Cancel", "रद्द")}</Button><Button onClick={save} disabled={saving}>{saving ? t("Saving…", "सुरक्षित हुँदै…") : t("Add", "थप्नुहोस्")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRoomDialog({ open, hostels, defaultHostelId, onClose, onSaved }: { open: boolean; hostels: HostelStat[]; defaultHostelId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ hostel_id: defaultHostelId || hostels[0]?.hostel_id || "", room_number: "", capacity: "4", room_type: "standard", floor: "0", monthly_fee: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.hostel_id) { toast.error(t("Select hostel", "होस्टल छान्नुहोस्")); return; }
    if (!f.room_number.trim()) { toast.error(t("Room number required", "कोठा नम्बर आवश्यक")); return; }
    setSaving(true);
    try { await api.post("/hostel/rooms", { ...f, capacity: parseInt(f.capacity) || 4, floor: parseInt(f.floor) || 0, monthly_fee: f.monthly_fee ? parseFloat(f.monthly_fee) : undefined }); onSaved(); toast.success(t("Room added", "कोठा थपियो")); setF({ ...f, room_number: "", monthly_fee: "" }); }
    catch { toast.error(t("Failed to add room", "कोठा थप्न सकिएन")); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent><DialogHeader><DialogTitle>{t("Add Room", "कोठा थप्नुहोस्")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>{t("Hostel", "होस्टल")} *</Label><AdvancedSelect value={f.hostel_id} onChange={(v) => setF({ ...f, hostel_id: v })}
            options={hostels.map((h) => ({ value: h.hostel_id, label: h.hostel_name }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("Room Number", "कोठा नम्बर")} *</Label><Input value={f.room_number} onChange={(e) => setF({ ...f, room_number: e.target.value })} placeholder="101" /></div>
            <div className="space-y-1.5"><Label>{t("Capacity (beds)", "क्षमता (बेड)")}</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} min={1} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("Floor", "तलाइ")}</Label><Input type="number" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("Monthly Fee (Rs)", "मासिक शुल्क")}</Label><Input type="number" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: e.target.value })} placeholder="3000" /></div>
          </div>
          <div className="space-y-1.5"><Label>{t("Room Type", "कोठा प्रकार")}</Label><AdvancedSelect
            value={f.room_type}
            onChange={(v) => setF({ ...f, room_type: v })}
            options={[{ value: "standard", label: t("Standard", "सामान्य") }, { value: "premium", label: t("Premium", "प्रिमियम") }, { value: "dormitory", label: t("Dormitory", "डर्मिटरी") }, { value: "single", label: t("Single", "एकल") }]}
          /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t("Cancel", "रद्द")}</Button><Button onClick={save} disabled={saving}>{saving ? t("Saving…", "सुरक्षित हुँदै…") : t("Add", "थप्नुहोस्")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
