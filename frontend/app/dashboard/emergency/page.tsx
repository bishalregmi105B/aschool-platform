"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, Send, Siren, Shield, Phone } from "lucide-react";

export default function EmergencyPage() {
  return <PluginGate slug="emergency"><EmergencyContent /></PluginGate>;
}

function EmergencyContent() {
  const queryClient = useQueryClient();
  const [type, setType] = useState("earthquake");
  const [message, setMessage] = useState("");

  const { data } = useQuery({
    queryKey: ["emergency-plans"],
    queryFn: async () => { const r = await api.get("/emergency/plans"); return r.data?.data || []; },
  });

  const plans = data || [];

  const alert = useMutation({
    mutationFn: async () => (await api.post("/emergency/alerts", { type, message })).data,
    onSuccess: () => { toast.success("Emergency alert sent to all parents!"); setMessage(""); },
    onError: () => toast.error("Failed to send alert"),
  });

  const types = [
    { value: "earthquake", label: "Earthquake", icon: Siren, color: "bg-red-100 text-red-700" },
    { value: "fire", label: "Fire", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
    { value: "flood", label: "Flood", icon: AlertTriangle, color: "bg-blue-100 text-blue-700" },
    { value: "security", label: "Security Threat", icon: Shield, color: "bg-yellow-100 text-yellow-700" },
    { value: "medical", label: "Medical Emergency", icon: Phone, color: "bg-green-100 text-green-700" },
    { value: "other", label: "Other", icon: AlertTriangle, color: "bg-gray-100 text-gray-700" },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Emergency Management</h1><p className="text-muted-foreground">Emergency alerts, evacuation plans, and disaster preparedness</p></div>

      <Card className="border-red-200 bg-red-50/50">
        <CardHeader><CardTitle className="text-red-700 flex items-center gap-2"><Siren className="h-5 w-5" /> Send Emergency Alert</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {types.map(t => (
              <button key={t.value} onClick={() => setType(t.value)} className={`p-3 rounded-lg text-center text-sm transition-all ${type === t.value ? `${t.color} ring-2 ring-offset-1` : "bg-white border hover:bg-muted"}`}>
                <t.icon className="h-5 w-5 mx-auto mb-1" />{t.label}
              </button>
            ))}
          </div>
          <div className="space-y-2"><Label>Alert Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the emergency situation..." rows={3} /></div>
          <Button variant="destructive" className="w-full" onClick={() => alert.mutate()} disabled={!message || alert.isPending}>
            {alert.isPending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />} SEND EMERGENCY ALERT TO ALL PARENTS
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.length > 0 ? plans.map((p: any, i: number) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">{p.name}</h3>
              <Badge variant="outline" className="mb-2">{p.type}</Badge>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              {p.assembly_point && <p className="text-sm mt-2"><strong>Assembly Point:</strong> {p.assembly_point}</p>}
            </CardContent>
          </Card>
        )) : (
          <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">No evacuation plans configured. Add plans for earthquake, fire, and flood emergencies.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
