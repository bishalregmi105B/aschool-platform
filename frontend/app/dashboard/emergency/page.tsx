"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { AlertTriangle, Layers, MapPin, Send, Siren, Shield, Phone } from "lucide-react";

export default function EmergencyPage() {
  return <AppGate slug="emergency"><EmergencyContent /></AppGate>;
}

function EmergencyContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [type, setType] = useState("earthquake");
  const [message, setMessage] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);

  const { data: alerts } = useQuery<any>({
    queryKey: ["emergency-alerts"],
    queryFn: async () => (await api.get("/emergency/alerts")).data?.data || [],
  });
  const recentAlerts: any[] = Array.isArray(alerts) ? alerts : [];

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => (await api.post(`/emergency/alerts/${id}/resolve`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency-alerts"] }); toast.success(t("Alert resolved", "अलर्ट समाधान भयो")); },
    onError: () => toast.error(t("Failed to resolve alert", "समाधान गर्न असफल")),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["emergency-plans"],
    queryFn: async () => { const r = await api.get("/emergency/plans"); return r.data?.data || []; },
  });

  const plans = data || [];

  const types = [
    { value: "earthquake", label: "Earthquake", icon: Siren, active: { background: "rgba(196,43,28,0.12)", color: "#c42b1c" } },
    { value: "fire", label: "Fire", icon: AlertTriangle, active: { background: "rgba(216,59,1,0.12)", color: "#d83b01" } },
    { value: "flood", label: "Flood", icon: AlertTriangle, active: { background: "var(--w11-accent-light)", color: "var(--w11-accent)" } },
    { value: "security", label: "Security Threat", icon: Shield, active: { background: "rgba(255,185,0,0.15)", color: "#8a6116" } },
    { value: "medical", label: "Medical Emergency", icon: Phone, active: { background: "rgba(16,124,16,0.12)", color: "#107c10" } },
    { value: "other", label: "Other", icon: AlertTriangle, active: { background: "var(--w11-control-hover)", color: "var(--w11-text-primary)" } },
  ];

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
    onSuccess: () => {
      toast.success(t("Emergency alert broadcast to all parents!", "आपत अलर्ट पठाइयो!"));
      queryClient.invalidateQueries({ queryKey: ["emergency-alerts"] });
      setMessage("");
      setShowBroadcast(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to send alert", "अलर्ट पठाउन असफल")),
  });

  // Danger-tone confirm before broadcasting to every parent.
  const fireAlert = async () => {
    const label = types.find((x) => x.value === type)?.label ?? type;
    const ok = await confirm({
      title: t("Broadcast emergency alert?", "आपत अलर्ट प्रसारण गर्ने?"),
      body: t(
        `This sends an instant ${label} alert (SMS + push) to EVERY parent and staff member. Use only for real emergencies — drills must use the "Drill" type.`,
        `यसले सबै अभिभावकलाई तत्काल सूचित गर्छ।`
      ),
      confirmLabel: t("Broadcast now", "अहिले प्रसारण"),
      tone: "danger",
      requireText: "BROADCAST",
    });
    if (ok) alert.mutate();
  };

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

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Siren className="h-5 w-5" style={{ color: "#c42b1c" }} />}
        title="Emergency Management"
        subtitle={`${plans.length} evacuation ${plans.length === 1 ? "plan" : "plans"} · emergency alerts and disaster preparedness`}
        actions={
          <Button variant="destructive" onClick={() => setShowBroadcast(true)}>
            <Siren className="h-4 w-4 mr-2" /> {t("Send Alert", "अलर्ट पठाउनुहोस्")}
          </Button>
        }
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
            <span className="flex items-center gap-2">
              <Send className="h-5 w-5" style={{ color: "#c42b1c" }} /> {t("Recent alerts", "पछिल्ला अलर्टहरू")}
            </span>
          }
          bodyClassName="p-0"
        >
          <DataTable
            columns={[
              { key: "title", label: t("Alert", "अलर्ट"), value: (a: any) => a.title ?? "", render: (a: any) => (
                <div>
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-xs truncate max-w-sm" style={{ color: "var(--w11-text-secondary)" }}>{a.description}</p>}
                </div>
              ) },
              { key: "alert_type", label: t("Type", "प्रकार"), value: (a: any) => a.alert_type ?? "", render: (a: any) => <span className="win11-chip error capitalize">{a.alert_type}</span> },
              { key: "triggered_at", label: t("Sent", "पठाइएको"), value: (a: any) => a.triggered_at ?? "", render: (a: any) => <span className="text-sm">{a.triggered_at ? new Date(a.triggered_at).toLocaleString() : "—"}</span> },
              { key: "status", label: t("Status", "अवस्था"), value: (a: any) => a.status ?? "", render: (a: any) => <StatusChip status={a.status === "resolved" ? "resolved" : "escalated"} label={a.status ?? "active"} /> },
              {
                key: "actions",
                label: "",
                noExport: true,
                render: (a: any) =>
                  a.status !== "resolved" ? (
                    <Button size="sm" variant="outline" onClick={() => resolveAlert.mutate(a.id)}>
                      {t("Resolve", "समाधान")}
                    </Button>
                  ) : null,
              },
            ]}
            rows={recentAlerts}
            rowKey={(a: any) => a.id}
            exportFileName="emergency-alerts"
            empty={{ icon: Send, title: t("No alerts sent", "कुनै अलर्ट छैन"), body: t("Use Send Alert to broadcast to all parents.", "पठाउन Send Alert प्रयोग गर्नुहोस्।") }}
          />
        </DataPanel>

        {/* Broadcast dialog — danger tone; fireAlert adds a type-confirm step. */}
        <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <span className="flex items-center gap-2" style={{ color: "#c42b1c" }}>
                  <Siren className="h-5 w-5" /> {t("Send Emergency Alert", "आपत अलर्ट पठाउनुहोस्")}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {types.map((t2: any) => (
                  <button
                    key={t2.value}
                    onClick={() => setType(t2.value)}
                    className="p-3 rounded-lg text-center text-sm transition-all border"
                    style={
                      type === t2.value
                        ? { ...t2.active, borderColor: "currentColor", boxShadow: "inset 0 0 0 1px currentColor" }
                        : { background: "var(--w11-card-bg)", borderColor: "var(--w11-border-default)", color: "var(--w11-text-primary)" }
                    }
                  >
                    <t2.icon className="h-5 w-5 mx-auto mb-1" />{t2.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>{t("Alert Message", "अलर्ट सन्देश")}</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("Describe the emergency situation…", "अवस्था वर्णन गर्नुहोस्…")} rows={3} />
              </div>
              <div className="win11-infobar error flex items-start gap-2" role="alert">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#c42b1c" }} />
                <p className="text-[13px]">{t("This reaches every parent device instantly. For practice, schedule a Drill instead.", "यो सबै फोनमा तत्काल पुग्छ। अभ्यासका लागि Drill तालिकाबद्ध गर्नुहोस्।")}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBroadcast(false)}>{t("Cancel", "रद्द")}</Button>
              <Button variant="destructive" onClick={fireAlert} disabled={!message || alert.isPending}>
                {alert.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {t("Review & Broadcast", "समीक्षा र प्रसारण")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
