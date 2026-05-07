"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageLoader } from "@/components/ui/spinner";
import { Plug } from "lucide-react";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  updatePaymentMethods,
  type PaymentMethodConfig,
} from "@/lib/services/payment-methods.service";

const integrations = [
  { name: "WhatsApp Cloud API", description: "Send automated messages to parents", connected: true, icon: "💬", category: "Communication" },
  { name: "Sparrow SMS", description: "SMS gateway for Nepal", connected: true, icon: "📱", category: "Communication" },
  { name: "Facebook Page", description: "Auto-post notices and events", connected: false, icon: "📘", category: "Social" },
  { name: "Instagram", description: "Share school gallery and events", connected: false, icon: "📷", category: "Social" },
  { name: "TikTok", description: "Short video content", connected: false, icon: "🎵", category: "Social" },
  { name: "YouTube", description: "Video channel management", connected: false, icon: "🎬", category: "Social" },
  { name: "Google Meet", description: "Video conferencing for classes", connected: false, icon: "📹", category: "Meeting" },
  { name: "Jitsi Meet", description: "Self-hosted video calls", connected: true, icon: "🎥", category: "Meeting" },
];

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);

  const { data: paymentConfig, isLoading } = useQuery({
    queryKey: ["settings-payment-methods"],
    queryFn: async () => {
      try {
        return await fetchPaymentMethods();
      } catch {
        return EMPTY_PAYMENT_METHODS_RESPONSE;
      }
    },
  });

  useEffect(() => {
    setMethods(paymentConfig?.methods || []);
  }, [paymentConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => updatePaymentMethods(methods),
    onSuccess: (updated) => {
      setMethods(updated.methods);
      queryClient.invalidateQueries({ queryKey: ["settings-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["fee-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-payment-methods"] });
      toast.success("Payment methods updated");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update payment methods");
    },
  });

  const categories = Array.from(new Set(integrations.map((i) => i.category)));

  const enabledCount = useMemo(
    () => methods.filter((method) => method.enabled).length,
    [methods],
  );

  const updateMethod = (
    key: PaymentMethodConfig["key"],
    patch: Partial<PaymentMethodConfig>,
  ) => {
    setMethods((prev) =>
      prev.map((method) =>
        method.key === key ? { ...method, ...patch } : method,
      ),
    );
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6" />Integrations</h1>
        <p className="text-muted-foreground">Connect external services to your school</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure enabled payment options and QR details used across fees and marketplace checkout.
              </p>
            </div>
            <Button
              onClick={() => {
                if (enabledCount === 0) {
                  toast.error("Enable at least one payment method.");
                  return;
                }
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Payment Methods"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {methods.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Payment methods could not be loaded. Check the backend connection, then refresh this page.
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {methods.map((method) => (
              <Card key={method.key} className={method.enabled ? "border-emerald-200" : ""}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{method.label}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {method.key} • {method.mode}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={method.enabled ? "success" : "outline"}>
                        {method.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={(checked) =>
                          updateMethod(method.key, { enabled: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Display Label</Label>
                    <Input
                      value={method.label}
                      onChange={(event) =>
                        updateMethod(method.key, { label: event.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>QR Image URL</Label>
                    <Input
                      value={method.qr_image_url || ""}
                      onChange={(event) =>
                        updateMethod(method.key, { qr_image_url: event.target.value })
                      }
                      placeholder="https://files.example/your-qr.png"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>QR ID / Payment Handle</Label>
                    <Input
                      value={method.qr_payload || ""}
                      onChange={(event) =>
                        updateMethod(method.key, { qr_payload: event.target.value })
                      }
                      placeholder="Merchant ID or payment handle"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Instructions</Label>
                    <Textarea
                      rows={2}
                      value={method.instructions || ""}
                      onChange={(event) =>
                        updateMethod(method.key, { instructions: event.target.value })
                      }
                      placeholder="Any payment instructions shown to users"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Require Reference</span>
                    <Switch
                      checked={method.requires_reference}
                      onCheckedChange={(checked) =>
                        updateMethod(method.key, { requires_reference: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {categories.map((cat) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-lg font-semibold">{cat}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.filter((i) => i.category === cat).map((int) => (
              <Card key={int.name}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{int.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{int.name}</h3>
                        <Badge variant={int.connected ? "success" : "outline"} className="text-xs">
                          {int.connected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{int.description}</p>
                    </div>
                  </div>
                  <Button variant={int.connected ? "outline" : "default"} size="sm" className="w-full mt-4">
                    {int.connected ? "Configure" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
