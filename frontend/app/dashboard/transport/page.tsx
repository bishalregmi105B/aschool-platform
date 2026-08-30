"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
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
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transport & GPS</h1>
          <p className="text-muted-foreground">Routes, buses, and live tracking</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Route className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{routes?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bus className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{buses?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Buses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bus className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {buses?.filter((b) => b.is_active).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Buses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {buses?.filter((b) => b.gps_device_id).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">GPS Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button variant={tab === "routes" ? "default" : "ghost"} size="sm" onClick={() => setTab("routes")}>
          Routes
        </Button>
        <Button variant={tab === "buses" ? "default" : "ghost"} size="sm" onClick={() => setTab("buses")}>
          Buses
        </Button>
      </div>

      {tab === "routes" && <RoutesTab routes={routes || []} />}
      {tab === "buses" && <BusesTab buses={buses || []} routes={routes || []} />}
    </div>
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

      <Card>
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
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No routes yet</TableCell></TableRow>
            ) : (
              routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
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
              <select name="route_id" className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">Assign to route (optional)</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Adding..." : "Add Bus"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
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
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No buses yet</TableCell></TableRow>
            ) : (
              buses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.vehicle_number}</TableCell>
                  <TableCell>{b.capacity}</TableCell>
                  <TableCell>
                    {b.gps_device_id ? (
                      <Badge variant="default" className="bg-green-600">Tracked</Badge>
                    ) : (
                      <Badge variant="secondary">No GPS</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
