"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Bus, MapPin, Plus, Route } from "lucide-react";

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
    <PluginGate slug="gps_tracking">
      <TransportContent />
    </PluginGate>
  );
}

function TransportContent() {
  const [tab, setTab] = useState<"routes" | "buses">("routes");
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
  if (isLoading) return <AOSModuleLoadingState label="Loading transport…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bus className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Transport & GPS"
        subtitle={`${routes?.length || 0} routes · ${buses?.filter((b) => b.is_active).length || 0} active of ${buses?.length || 0} buses`}
      />
      <AOSPageBody>
        {/* Stats */}
        <StatGrid>
          <KpiCard
            label="Routes"
            value={routes?.length || 0}
            icon={<Route className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Buses"
            value={buses?.length || 0}
            color="#107c10"
            icon={<Bus className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Active Buses"
            value={buses?.filter((b) => b.is_active).length || 0}
            color="#d83b01"
            icon={<Bus className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="GPS Tracked"
            value={buses?.filter((b) => b.gps_device_id).length || 0}
            color="#c42b1c"
            icon={<MapPin className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
        </StatGrid>

        {/* Tabs */}
        <FilterCommandBar>
          <Button variant={tab === "routes" ? "default" : "outline"} size="sm" onClick={() => setTab("routes")}>
            Routes
          </Button>
          <Button variant={tab === "buses" ? "default" : "outline"} size="sm" onClick={() => setTab("buses")}>
            Buses
          </Button>
        </FilterCommandBar>

        {tab === "routes" && <RoutesTab routes={routes || []} />}
        {tab === "buses" && <BusesTab buses={buses || []} routes={routes || []} />}
      </AOSPageBody>
    </AOSPage>
  );
}

function RoutesTab({ routes }: { routes: TransportRoute[] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await api.post<ApiResponse>("/transport/routes", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      setOpen(false);
      toast.success("Route created");
    },
    onError: () => toast.error("Failed to create route"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Route</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Route</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMut.mutate({
                  name: fd.get("name") as string,
                  description: fd.get("description") as string,
                });
              }}
            >
              <Input name="name" placeholder="Route name" required />
              <Input name="description" placeholder="Description (e.g., stops)" />
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating..." : "Create Route"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataPanel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>No routes yet</TableCell></TableRow>
            ) : (
              routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell><StatusChip status={r.is_active ? "active" : "inactive"} /></TableCell>
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
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await api.post<ApiResponse>("/transport/buses", {
        vehicle_number: data.vehicle_number,
        capacity: parseInt(data.capacity, 10) || 40,
        gps_device_id: data.gps_device_id,
        route_id: data.route_id || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-buses"] });
      setOpen(false);
      toast.success("Bus added");
    },
    onError: () => toast.error("Failed to add bus"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Bus</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Bus</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const obj: Record<string, string> = {};
                fd.forEach((v, k) => { obj[k] = v as string; });
                createMut.mutate(obj);
              }}
            >
              <Input name="vehicle_number" placeholder="Vehicle number (e.g., Ba 2 Kha 1234)" required />
              <Input name="capacity" type="number" placeholder="Capacity" defaultValue="40" />
              {/* No driver_name input: buses.driver_id is a FK to users — pick a
                  driver from staff on the Buses page once staff accounts exist;
                  a free-text driver_name was silently dropped by the API. */}
              <Input name="gps_device_id" placeholder="GPS device ID (optional)" />
              <AdvancedSelect
                name="route_id"
                clearable
                placeholder="Assign to route (optional)"
                options={(routes || []).map((r) => ({ value: r.id, label: r.name }))}
              />
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Adding..." : "Add Bus"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataPanel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle#</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buses.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>No buses yet</TableCell></TableRow>
            ) : (
              buses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.vehicle_number}</TableCell>
                  <TableCell>{b.capacity}</TableCell>
                  <TableCell>
                    {b.gps_device_id ? (
                      <span className="win11-chip success">Tracked</span>
                    ) : (
                      <span className="win11-chip subtle">No GPS</span>
                    )}
                  </TableCell>
                  <TableCell><StatusChip status={b.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}
