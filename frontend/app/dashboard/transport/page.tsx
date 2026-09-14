"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useAOSRouteParams, useAOSRouterNavigate } from "@/lib/aos-window-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { Bus, Pencil, Plus, MapPin, Route, Trash2 } from "lucide-react";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

interface TransportRoute {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface BusItem {
  id: string;
  vehicle_number: string;
  capacity: number;
  driver_name?: string;
  gps_device_id?: string;
  route_id?: string;
  is_active: boolean;
}

export default function TransportPage() {
  return (
    <AppGate slug="gps_tracking">
      <TransportContent />
    </AppGate>
  );
}

function TransportContent() {
  const { t } = useI18n();
  // Tab is window-route state (`?tab=`) — deep-linkable inside the AOS shell.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const tabParam = routeParams.get("tab");
  const [tab, setTab] = useState<"routes" | "buses">(
    tabParam === "buses" ? "buses" : "routes"
  );
  const setTabUrl = (v: "routes" | "buses") => {
    setTab(v);
    const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (v === "buses") next.set("tab", "buses"); else next.delete("tab");
    navigate(`/dashboard/transport${next.toString() ? `?${next}` : ""}`);
  };
  const queryClient = useQueryClient();

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/transport/routes");
      return (Array.isArray(res.data.data) ? res.data.data : []) as TransportRoute[];
    },
  });

  const { data: buses, isLoading: busesLoading } = useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/transport/buses");
      return (Array.isArray(res.data.data) ? res.data.data : []) as BusItem[];
    },
  });

  const isLoading = routesLoading || busesLoading;
  if (isLoading) return <AOSModuleLoadingState label={t("Loading transport…", "ट्रान्स्पोर्ट लोड हुँदै…")} />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bus className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Transport & GPS", "ट्रान्स्पोर्ट र जीपीएस")}
        subtitle={`${routes?.length || 0} ${t("routes", "बाटो")} · ${buses?.filter((b) => b.is_active).length || 0}/${buses?.length || 0} ${t("buses active", "बस सक्रिय")}`}
      />
      <AOSPageBody>
        {/* Stats */}
        <StatGrid>
          <KpiCard
            label={t("Routes", "बाटोहरू")}
            value={routes?.length || 0}
            icon={<Route className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Buses", "बसहरू")}
            value={buses?.length || 0}
            color="#107c10"
            icon={<Bus className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("Active Buses", "सक्रिय बस")}
            value={buses?.filter((b) => b.is_active).length || 0}
            color="#d83b01"
            icon={<Bus className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label={t("GPS Tracked", "जीपीएस ट्र्याक")}
            value={buses?.filter((b) => b.gps_device_id).length || 0}
            color="#c42b1c"
            icon={<MapPin className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
        </StatGrid>

        {/* Quick links — every transport subpage from the plugin manifest */}
        <QuickLinks
          section="Operations"
          links={[
            { label: t("Live Map", "लाइभ म्याप"), href: "/dashboard/transport/map", icon: "MapPin" },
            { label: t("Monitor", "मनिटर"), href: "/dashboard/transport/monitor", icon: "Monitor" },
            { label: t("Trips", "ट्रिपहरू"), href: "/dashboard/transport/trips", icon: "ArrowRightLeft" },
            { label: t("Routes", "बाटोहरू"), href: "/dashboard/transport/routes", icon: "Route" },
            { label: t("Buses", "बसहरू"), href: "/dashboard/transport/buses", icon: "Bus" },
            { label: t("Stops", "स्टपहरू"), href: "/dashboard/transport/stops", icon: "ListOrdered" },
            { label: t("Pickup Points", "पिकअप पोइन्ट"), href: "/dashboard/transport/pickup-points", icon: "Tag" },
            { label: t("Transport Allocation", "छुट्टाई"), href: "/dashboard/transport/allocation", icon: "UserCheck" },
            { label: t("Geofence Alerts", "जियोफेन्स अलर्ट"), href: "/dashboard/transport/prefs", icon: "Bell" },
            { label: t("GPS Logs", "जीपीएस लग"), href: "/dashboard/transport/logs", icon: "Database" },
            { label: t("Reports", "रिपोर्ट"), href: "/dashboard/transport/reports", icon: "BarChart3" },
          ]}
        />

        {/* Sub-navigation: same registry data, two light views → Tabs (plan 33-1). */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTabUrl(v as "routes" | "buses")}
        >
          <TabsList className="mb-3">
            <TabsTrigger value="routes" badge={routes?.length}>
              {t("Routes", "बाटोहरू")}
            </TabsTrigger>
            <TabsTrigger value="buses" badge={buses?.length}>
              {t("Buses", "बसहरू")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="routes">
            <RoutesTab routes={routes || []} />
          </TabsContent>
          <TabsContent value="buses">
            <BusesTab buses={buses || []} routes={routes || []} />
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

function RoutesTab({ routes }: { routes: TransportRoute[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<TransportRoute | null>(null);
  const queryClient = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      if (editItem) return (await api.put(`/transport/routes/${editItem.id}`, data)).data;
      return (await api.post<ApiResponse>("/transport/routes", data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      setOpen(false);
      setEditItem(null);
      toast.success(editItem ? t("Route updated", "बाटो अद्यावधिक भयो") : t("Route created", "बाटो बन्यो"));
    },
    onError: () => toast.error(t("Failed to save route", "बाटो सुरक्षित गर्न सकिएन")),
  });

  // Optimistic delete + 5s undo (plan 35.4) — no confirm dialog needed.
  const removeRoute = (r: TransportRoute) => {
    undoableDelete({
      label: t(`route “${r.name}”`, `बाटो “${r.name}”`),
      commit: async () => {
        await api.delete(`/transport/routes/${r.id}`);
        queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditItem(null);
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> {t("Add Route", "बाटो थप्नुहोस्")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? t("Edit Route", "बाटो सम्पादन") : t("New Route", "नयाँ बाटो")}</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveMut.mutate({
                  name: fd.get("name") as string,
                  description: (fd.get("description") as string) || "",
                });
              }}
            >
              <div className="space-y-2">
                <Label>{t("Route name", "बाटोको नाम")}</Label>
                <Input name="name" defaultValue={editItem?.name} placeholder={t("e.g. Ring Road Express", "जस्तै रिङरोड एक्सप्रेस")} required />
              </div>
              <div className="space-y-2">
                <Label>{t("Description (e.g. areas covered)", "विवरण (जस्तै क्षेत्रहरू)")}</Label>
                <Input name="description" defaultValue={editItem?.description} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditItem(null); }}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={saveMut.isPending} className="win11-btn accent">
                  {saveMut.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                  {saveMut.isPending ? t("Saving…", "सुरक्षित हुँदै…") : t("Save", "सुरक्षित")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataPanel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Name", "नाम")}</TableHead>
              <TableHead>{t("Description", "विवरण")}</TableHead>
              <TableHead>{t("Status", "अवस्था")}</TableHead>
              <TableHead className="text-right">{t("Actions", "कार्य")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>
                  {t("No routes yet — add the first one above.", "अझै बाटो छैन — माथिबाट थप्नुहोस्।")}
                </TableCell>
              </TableRow>
            ) : (
              routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell><StatusChip status={r.is_active ? "active" : "inactive"} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" title={t("Edit", "सम्पादन")} onClick={() => { setEditItem(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title={t("Delete", "मेटाउनुहोस्")} onClick={() => removeRoute(r)}>
                      <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}

function BusesTab({ buses, routes }: { buses: BusItem[]; routes: TransportRoute[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<BusItem | null>(null);
  const [form, setForm] = useState({ vehicle_number: "", capacity: "40", gps_device_id: "", route_id: "", is_active: true });
  const queryClient = useQueryClient();

  const openAdd = () => {
    setEditItem(null);
    setForm({ vehicle_number: "", capacity: "40", gps_device_id: "", route_id: "", is_active: true });
    setOpen(true);
  };
  const openEdit = (b: BusItem) => {
    setEditItem(b);
    setForm({
      vehicle_number: b.vehicle_number || "",
      capacity: String(b.capacity ?? 40),
      gps_device_id: b.gps_device_id || "",
      route_id: b.route_id || "",
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        vehicle_number: form.vehicle_number,
        capacity: parseInt(form.capacity, 10) || 40,
        gps_device_id: form.gps_device_id || undefined,
        route_id: form.route_id || undefined,
      };
      if (editItem) return (await api.put(`/transport/buses/${editItem.id}`, payload)).data;
      return (await api.post<ApiResponse>("/transport/buses", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-buses"] });
      setOpen(false);
      setEditItem(null);
      toast.success(editItem ? t("Bus updated", "बस अद्यावधिक भयो") : t("Bus added", "बस थपियो"));
    },
    onError: () => toast.error(t("Failed to save bus", "बस सुरक्षित गर्न सकिएन")),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> {t("Add Bus", "बस थप्नुहोस्")}</Button>
      </div>

      <DataPanel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Vehicle#", "साधन नं.")}</TableHead>
              <TableHead>{t("Route", "बाटो")}</TableHead>
              <TableHead>{t("Capacity", "क्षमता")}</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>{t("Status", "अवस्था")}</TableHead>
              <TableHead className="text-right">{t("Actions", "कार्य")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>{t("No buses yet", "अझै बस छैन")}</TableCell></TableRow>
            ) : (
              buses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.vehicle_number}</TableCell>
                  <TableCell>{routes.find((r) => r.id === b.route_id)?.name || "—"}</TableCell>
                  <TableCell>{b.capacity}</TableCell>
                  <TableCell>
                    {b.gps_device_id ? (
                      <span className="win11-chip success">{t("Tracked", "ट्र्याक गरिएको")}</span>
                    ) : (
                      <span className="win11-chip subtle">{t("No GPS", "जीपीएस छैन")}</span>
                    )}
                  </TableCell>
                  <TableCell><StatusChip status={b.is_active ? "active" : "inactive"} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" title={t("Edit", "सम्पादन")} onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataPanel>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? t("Edit Bus", "बस सम्पादन") : t("New Bus", "नयाँ बस")}</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>{t("Vehicle number", "साधन नम्बर")}</Label>
              <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder={t("e.g. Ba 2 Kha 1234", "जस्तै बा २ ख १२३४")} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Capacity", "क्षमता")}</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("GPS device ID (optional)", "जीपीएस यन्त्र आईडी")}</Label>
                <Input value={form.gps_device_id} onChange={(e) => setForm({ ...form, gps_device_id: e.target.value })} />
              </div>
            </div>
            {/* No driver_name input: buses.driver_id is a FK to users — assign the
                driver from the Buses page under staff accounts (a free-text value
                was silently dropped by the API). */}
            <div className="space-y-2">
              <Label>{t("Assign to route (optional)", "बाटो तोक्नुहोस्")}</Label>
              <AdvancedSelect
                clearable
                value={form.route_id}
                onChange={(v) => setForm({ ...form, route_id: v })}
                options={(routes || []).map((r) => ({ value: r.id, label: r.name }))}
                placeholder={t("Select route", "बाटो छान्नुहोस्")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditItem(null); }}>
                {t("Cancel", "रद्द")}
              </Button>
              <Button type="submit" disabled={!form.vehicle_number || createMut.isPending}>
                {createMut.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                {createMut.isPending ? t("Saving…", "सुरक्षित हुँदै…") : t("Save", "सुरक्षित")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
