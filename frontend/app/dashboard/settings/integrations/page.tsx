"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Plug, Upload, QrCode, X } from "lucide-react";
import Image from "next/image";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  updatePaymentMethods,
  uploadQrImage,
  type PaymentMethodConfig,
  type PaymentMethodKey,
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
  const [uploadingQr, setUploadingQr] = useState<PaymentMethodKey | null>(null);

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
    mutationFn: async () => {
      // State holds "***" if the key was loaded from server and not touched.
      // Any other value (including "") is sent as-is — "" clears the key.
      return updatePaymentMethods(methods);
    },
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

  const handleQrUpload = async (
    key: PaymentMethodKey,
    file: File,
  ) => {
    setUploadingQr(key);
    try {
      const result = await uploadQrImage(file, key);
      updateMethod(key, { qr_image_url: result.url });
      queryClient.invalidateQueries({ queryKey: ["settings-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["fee-payment-methods"] });
      toast.success("QR image uploaded successfully");
    } catch {
      toast.error("Failed to upload QR image");
    } finally {
      setUploadingQr(null);
    }
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
            {methods.map((method) => {
              const isOnline = method.mode === "online";
              const merchantLabel =
                method.key === "esewa"
                  ? "eSewa Product Code"
                  : method.key === "fonepay"
                    ? "FonePay Merchant Code (PID)"
                    : "Merchant Code";
              const secretLabel =
                method.key === "khalti"
                  ? "Khalti Live Secret Key"
                  : method.key === "esewa"
                    ? "eSewa HMAC Secret Key"
                    : method.key === "fonepay"
                      ? "FonePay HMAC Secret"
                      : "Secret Key";
              const merchantPlaceholder =
                method.key === "esewa"
                  ? "e.g. EPAYTEST or your product code"
                  : method.key === "fonepay"
                    ? "Your FonePay merchant PID"
                    : "Merchant code";
              const secretPlaceholder =
                method.key === "khalti"
                  ? "Key live_xxxxxxxxxxxxxxxx"
                  : "Leave blank to keep existing key";

              return (
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

                  {isOnline && (
                    <>
                      <div className="space-y-1.5">
                        <Label>{merchantLabel}</Label>
                        <Input
                          value={method.merchant_code || ""}
                          onChange={(event) =>
                            updateMethod(method.key, { merchant_code: event.target.value })
                          }
                          placeholder={merchantPlaceholder}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{secretLabel}</Label>
                        <Input
                          type="password"
                          value={method.secret_key === "***" ? "" : (method.secret_key || "")}
                          onChange={(event) =>
                            updateMethod(method.key, { secret_key: event.target.value })
                          }
                          placeholder={
                            method.secret_key === "***"
                              ? "Configured — enter new value to replace"
                              : secretPlaceholder
                          }
                          autoComplete="new-password"
                        />
                        {method.secret_key === "***" && (
                          <p className="text-xs text-emerald-600">
                            A secret key is currently configured. Leave blank to keep it.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* QR Image — upload + preview */}
                  {method.supports_qr && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <QrCode className="h-3.5 w-3.5" />
                        {method.key === "qr_pay" ? "Payment QR Code Image" : "QR Image (optional)"}
                      </Label>
                      {method.qr_image_url ? (
                        <div className="flex items-start gap-3">
                          <div className="relative h-28 w-28 flex-shrink-0 rounded border bg-white p-1">
                            <Image
                              src={method.qr_image_url}
                              alt="QR code"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleQrUpload(method.key, f);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={uploadingQr === method.key}
                                asChild
                              >
                                <span>
                                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                                  {uploadingQr === method.key ? "Uploading..." : "Replace"}
                                </span>
                              </Button>
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => updateMethod(method.key, { qr_image_url: "" })}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleQrUpload(method.key, f);
                              e.target.value = "";
                            }}
                          />
                          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-5 hover:border-primary/40 transition-colors">
                            <QrCode className="h-8 w-8 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground">
                              {uploadingQr === method.key
                                ? "Uploading..."
                                : "Click to upload QR image (PNG / JPG / WEBP)"}
                            </span>
                          </div>
                        </label>
                      )}
                      {/* Fallback URL input */}
                      <Input
                        value={method.qr_image_url || ""}
                        onChange={(event) =>
                          updateMethod(method.key, { qr_image_url: event.target.value })
                        }
                        placeholder="Or paste a direct image URL"
                        className="text-xs"
                      />
                    </div>
                  )}

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
              );
            })}
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
