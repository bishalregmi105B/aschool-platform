"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plug, QrCode, X, FolderOpen } from "lucide-react";
import Image from "next/image";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  updatePaymentMethods,
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
  const [showQrPicker, setShowQrPicker] = useState(false);
  const [qrPickerMethod, setQrPickerMethod] = useState<PaymentMethodKey | null>(null);

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

  const handleQrSelect = (files: ManagedFile[]) => {
    const selected = files[0];
    if (!selected || !qrPickerMethod) return;
    updateMethod(qrPickerMethod, { qr_image_url: selected.url });
    toast.success("QR image selected from the file manager");
  };

  const openQrPicker = (key: PaymentMethodKey) => {
    setQrPickerMethod(key);
    setShowQrPicker(true);
  };

  if (isLoading) return <AOSModuleLoadingState label="Loading integrations…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Plug className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Integrations"
        subtitle="Connect external services to your school"
      />
      <AOSPageBody>
        <div className="space-y-4">
          <DataPanel
            title="Payment Methods"
            actions={
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
            }
          >
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                Configure enabled payment options and QR details used across fees and marketplace checkout.
              </p>
              {methods.length === 0 ? (
                <div className="win11-infobar warning">
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
                    <div
                      key={method.key}
                      className="win11-card"
                      style={{
                        borderColor: method.enabled
                          ? "var(--w11-accent)"
                          : undefined,
                      }}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{method.label}</p>
                            <p
                              className="text-xs uppercase tracking-wide"
                              style={{ color: "var(--w11-text-tertiary)" }}
                            >
                              {method.key} • {method.mode}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip
                              status={method.enabled ? "active" : "inactive"}
                              label={method.enabled ? "Enabled" : "Disabled"}
                            />
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
                                <p className="text-xs" style={{ color: "var(--w11-accent)" }}>
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
                                <div
                                  className="relative h-28 w-28 flex-shrink-0 rounded p-1"
                                  // QR codes need a pure-white backing to stay scannable.
                                  style={{ border: "1px solid var(--w11-border-default)", background: "#ffffff" }}
                                >
                                  <Image
                                    src={method.qr_image_url}
                                    alt="QR code"
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openQrPicker(method.key)}
                                  >
                                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                                    Replace from Vault
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateMethod(method.key, { qr_image_url: "" })}
                                  >
                                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 transition-colors cursor-pointer"
                                style={{ borderColor: "var(--w11-border-default)" }}
                                onClick={() => openQrPicker(method.key)}
                              >
                                <QrCode className="h-8 w-8" style={{ color: "var(--w11-text-tertiary)" }} />
                                <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                                  Choose a QR image from the file manager (PNG / JPG / WEBP)
                                </span>
                              </div>
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

                        <div
                          className="flex items-center justify-between rounded px-3 py-2"
                          style={{
                            background: "var(--w11-control-hover)",
                            borderRadius: "var(--w11-radius-md)",
                          }}
                        >
                          <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>Require Reference</span>
                          <Switch
                            checked={method.requires_reference}
                            onCheckedChange={(checked) =>
                              updateMethod(method.key, { requires_reference: checked })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DataPanel>

          {categories.map((cat) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--w11-text-primary)" }}>{cat}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.filter((i) => i.category === cat).map((int) => (
                  <div key={int.name} className="win11-card">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{int.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm" style={{ color: "var(--w11-text-primary)" }}>{int.name}</h3>
                          <StatusChip
                            status={int.connected ? "active" : "inactive"}
                            label={int.connected ? "Connected" : "Disconnected"}
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>{int.description}</p>
                      </div>
                    </div>
                    <Button variant={int.connected ? "outline" : "default"} size="sm" className="w-full mt-4">
                      {int.connected ? "Configure" : "Connect"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AOSPageBody>

      <FilePicker
        open={showQrPicker}
        onOpenChange={setShowQrPicker}
        onSelect={handleQrSelect}
        fileType="image"
        title="Select QR Code Image"
      />
    </AOSPage>
  );
}
