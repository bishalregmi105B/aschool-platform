"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { AlertTriangle, Layers, MapPin, Send, Siren, Shield, Phone } from "lucide-react";

export default function EmergencyPage() {
  return <PluginGate slug="emergency"><EmergencyContent /></PluginGate>;
}

function EmergencyContent() {
  const queryClient = useQueryClient();
  const [type, setType] = useState("earthquake");
  const [message, setMessage] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["emergency-plans"],
    queryFn: async () => { const r = await api.get("/emergency/plans"); return r.data?.data || []; },
  });

  const plans = data || [];

  // Backend contract: POST /emergency/alerts {alert_type, title, description}
  // (alert_type enum: earthquake|fire|flood|lockdown|medical|drill|other).
  // The old payload {type, message} never mapped — every alert 500'd.
  // Hooks must run unconditionally — before any early return below.
  const alert = useMutation({
    mutationFn: async () => (await api.post("/emergency/alerts", {
      alert_type: type === "security" ? "lockdown" : type,
      title: (message || `${type} alert`).slice(0, 120),
      description: message,
    })).data,
    onSuccess: () => { toast.success("Emergency alert sent to all parents!"); setMessage(""); },
    onError: () => toast.error("Failed to send alert"),
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Emergency Management" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  if (isLoading) return <AOSModuleLoadingState label="Loading emergency plans…" />;

  const types = [
    { value: "earthquake", label: "Earthquake", icon: Siren, active: { background: "rgba(196,43,28,0.12)", color: "#c42b1c" } },
    { value: "fire", label: "Fire", icon: AlertTriangle, active: { background: "rgba(216,59,1,0.12)", color: "#d83b01" } },
    { value: "flood", label: "Flood", icon: AlertTriangle, active: { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } },
    { value: "security", label: "Security Threat", icon: Shield, active: { background: "rgba(255,185,0,0.15)", color: "#8a6116" } },
    { value: "medical", label: "Medical Emergency", icon: Phone, active: { background: "rgba(16,124,16,0.12)", color: "#107c10" } },
    { value: "other", label: "Other", icon: AlertTriangle, active: { background: "var(--w11-control-hover)", color: "var(--w11-text-primary)" } },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Siren className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title="Emergency Management"
        subtitle={`${plans.length} evacuation ${plans.length === 1 ? "plan" : "plans"} · emergency alerts and disaster preparedness`}
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real counts from the loaded evacuation plans */}
        <StatGrid>
          <KpiCard
            label="Evacuation Plans"
            value={plans.length}
            color="#c42b1c"
            icon={<Siren className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
          <KpiCard
            label="Emergency Types"
            value={new Set(plans.map((p: any) => p.emergency_type).filter(Boolean)).size}
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Assembly Points"
            value={plans.reduce(
              (n: number, p: any) =>
                n + (Array.isArray(p.assembly_points) ? p.assembly_points.length : p.assembly_points ? 1 : 0),
              0,
            )}
            color="#107c10"
            icon={<MapPin className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
        </StatGrid>

        <DataPanel
          className="mb-4"
          title={
            <span className="flex items-center gap-2" style={{ color: "#c42b1c" }}>
              <Siren className="h-5 w-5" /> Send Emergency Alert
            </span>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {types.map((t: any) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className="p-3 rounded-lg text-center text-sm transition-all border"
                  style={
                    type === t.value
                      ? { ...t.active, borderColor: "currentColor", boxShadow: "inset 0 0 0 1px currentColor" }
                      : {
                          background: "var(--w11-card-bg)",
                          borderColor: "var(--w11-border-default)",
                          color: "var(--w11-text-primary)",
                        }
                  }
                >
                  <t.icon className="h-5 w-5 mx-auto mb-1" />{t.label}
                </button>
              ))}
            </div>
            <div className="space-y-2"><Label>Alert Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the emergency situation..." rows={3} /></div>
            <Button variant="destructive" className="w-full" onClick={() => alert.mutate()} disabled={!message || alert.isPending}>
              {alert.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />} SEND EMERGENCY ALERT TO ALL PARENTS
            </Button>
          </div>
        </DataPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.length > 0 ? plans.map((p: any, i: number) => (
            <div key={p.id || i} className="win11-card">
              <h3 className="font-semibold mb-2" style={{ color: "var(--w11-text-primary)" }}>{p.name}</h3>
              <span className="win11-chip subtle mb-2 capitalize">{p.emergency_type}</span>
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{p.instructions}</p>
              {Array.isArray(p.assembly_points) && p.assembly_points.length > 0 && <p className="text-sm mt-2" style={{ color: "var(--w11-text-primary)" }}><strong>Assembly Point:</strong> {p.assembly_points.join(", ")}</p>}
              {!Array.isArray(p.assembly_points) && p.assembly_points && <p className="text-sm mt-2" style={{ color: "var(--w11-text-primary)" }}><strong>Assembly Point:</strong> {p.assembly_points}</p>}
            </div>
          )) : (
            <DataPanel className="col-span-full">
              <AOSEmptyState
                title="No evacuation plans configured"
                description="Add plans for earthquake, fire, and flood emergencies."
              />
            </DataPanel>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
