"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plug, QrCode, X, FolderOpen, MessageSquare, Info } from "lucide-react";
import Image from "next/image";
import { FilePicker } from "@/components/files/FilePicker";
import type { ManagedFile } from "@/lib/services/files.service";
import { PluginGate, useInstalledPlugins } from "@/lib/plugins";
import { DataPanel, StatusChip, AOSModuleLoadingState } from "@/components/aos/kit/page-kit";
import { SettingsPage } from "../settings-page";
import { SettingsSection, SettingField, useSectionSave } from "../settings-section";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  updatePaymentMethods,
  type PaymentMethodConfig,
  type PaymentMethodKey,
} from "@/lib/services/payment-methods.service";

/**
 * Integrations (A8). Real, tenant-scoped configuration only:
 *  • Payment methods — gateway credentials + QR, saved via PUT
 *    /fees/payment-methods. There is NO backend "test connection" endpoint,
 *    so cards are display/edit only (no fake "Test" button — plan 31.0).
 *  • Communication channels — WhatsApp / SMS are driven by their own plugins,
 *    so this section links to the REAL config pages (via useInstalledPlugins)
 *    instead of showing hardcoded fake "connected" toggles.
 */

interface PaymentMethodsState {
  methods: PaymentMethodConfig[];
}

function PaymentMethodCard({
  method,
  onPatch,
}: {
  method: PaymentMethodConfig;
  onPatch: (patch: Partial<PaymentMethodConfig>) => void;
}) {
  const [showQrPicker, setShowQrPicker] = useState(false);
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

  const handleQrSelect = (files: ManagedFile[]) => {
    const selected = files[0];
    if (!selected) return;
    onPatch({ qr_image_url: selected.url });
    toast.success("QR image selected — remember to Save this section");
  };

  return (
    <div
      className="win11-card"
      style={{ borderColor: method.enabled ? "var(--w11-accent)" : undefined }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{method.label}</p>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--w11-text-tertiary)" }}>
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
              onCheckedChange={(checked) => onPatch({ enabled: checked })}
              aria-label={`Enable ${method.label}`}
            />
          </div>
        </div>

        <SettingField label="Display Label" help="Name parents see at the fee collection counter.">
          <Input value={method.label} onChange={(e) => onPatch({ label: e.target.value })} />
        </SettingField>

        {isOnline && (
          <>
            <SettingField label={merchantLabel} help="Identifies your merchant account to the gateway.">
              <Input
                value={method.merchant_code || ""}
                onChange={(e) => onPatch({ merchant_code: e.target.value })}
                placeholder={merchantPlaceholder}
                autoComplete="off"
              />
            </SettingField>
            <SettingField
              label={secretLabel}
              help="Write-only. Shown as *** when set; leave blank to keep the current key."
            >
              <Input
                type="password"
                value={method.secret_key === "***" ? "" : (method.secret_key || "")}
                onChange={(e) => onPatch({ secret_key: e.target.value })}
                placeholder={
                  method.secret_key === "***" ? "Configured — enter new value to replace" : secretPlaceholder
                }
                autoComplete="new-password"
              />
              {method.secret_key === "***" && (
                <p className="text-xs mt-1" style={{ color: "var(--w11-accent)" }}>
                  A secret key is currently configured. Leave blank to keep it.
                </p>
              )}
            </SettingField>
          </>
        )}

        {method.supports_qr && (
          <SettingField
            label={method.key === "qr_pay" ? "Payment QR Code Image" : "QR Image (optional)"}
            help="Shown to parents at checkout so they can pay by scanning."
          >
            {method.qr_image_url ? (
              <div className="flex items-start gap-3">
                <div
                  className="relative h-28 w-28 flex-shrink-0 rounded p-1"
                  style={{ border: "1px solid var(--w11-border-default)", background: "#ffffff" }}
                >
                  <Image src={method.qr_image_url} alt="QR code" fill className="object-contain" unoptimized />
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowQrPicker(true)}>
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                    Replace from Vault
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onPatch({ qr_image_url: "" })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 transition-colors cursor-pointer"
                style={{ borderColor: "var(--w11-border-default)" }}
                onClick={() => setShowQrPicker(true)}
              >
                <QrCode className="h-8 w-8" style={{ color: "var(--w11-text-tertiary)" }} />
                <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                  Choose a QR image from the file manager (PNG / JPG / WEBP)
                </span>
              </div>
            )}
            <Input
              value={method.qr_image_url || ""}
              onChange={(e) => onPatch({ qr_image_url: e.target.value })}
              placeholder="Or paste a direct image URL"
              className="text-xs mt-2"
            />
          </SettingField>
        )}

        <SettingField label="QR ID / Payment Handle" help="The merchant ID or mobile handle embedded in the QR.">
          <Input
            value={method.qr_payload || ""}
            onChange={(e) => onPatch({ qr_payload: e.target.value })}
            placeholder="Merchant ID or payment handle"
          />
        </SettingField>

        <SettingField label="Instructions" help="Any payment note shown to the user for this method.">
          <Textarea
            rows={2}
            value={method.instructions || ""}
            onChange={(e) => onPatch({ instructions: e.target.value })}
            placeholder="Any payment instructions shown to users"
          />
        </SettingField>

        <div
          className="flex items-center justify-between rounded px-3 py-2"
          style={{ background: "var(--w11-control-hover)", borderRadius: "var(--w11-radius-md)" }}
        >
          <div>
            <span className="text-sm" style={{ color: "var(--w11-text-primary)" }}>Require Reference</span>
            <p className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
              Force the cashier to record a transaction/reference number.
            </p>
          </div>
          <Switch
            checked={method.requires_reference}
            onCheckedChange={(checked) => onPatch({ requires_reference: checked })}
          />
        </div>
      </div>

      <FilePicker
        open={showQrPicker}
        onOpenChange={setShowQrPicker}
        onSelect={handleQrSelect}
        fileType="image"
        title="Select QR Code Image"
      />
    </div>
  );
}

function IntegrationsContent() {
  const queryClient = useQueryClient();
  const { isPluginInstalled } = useInstalledPlugins();

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

  const initial = useMemo<PaymentMethodsState>(
    () => ({ methods: paymentConfig?.methods || [] }),
    [paymentConfig],
  );

  const form = useSectionSave<PaymentMethodsState>(
    initial,
    async (v) => {
      if (v.methods.filter((m) => m.enabled).length === 0) {
        throw new Error("Enable at least one payment method.");
      }
      const updated = await updatePaymentMethods(v.methods);
      queryClient.setQueryData(["settings-payment-methods"], updated);
      queryClient.invalidateQueries({ queryKey: ["fee-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-payment-methods"] });
    },
  );

  if (isLoading) return <AOSModuleLoadingState label="Loading integrations…" />;

  const updateMethod = (key: PaymentMethodKey, patch: Partial<PaymentMethodConfig>) => {
    form.setField({
      methods: form.values.methods.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    });
  };

  const channels = [
    { slug: "whatsapp_bot", label: "WhatsApp Business", desc: "Automated parent messages via the WhatsApp plugin.", href: "/dashboard/communications/whatsapp" },
    { slug: "sms_notifications", label: "SMS Gateway", desc: "Text alerts via the SMS plugin (Nepal gateways).", href: "/dashboard/sms" },
  ];

  return (
    <SettingsPage
      active="integrations"
      icon={<Plug className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
      title="Integrations"
      subtitle="Connect payment gateways and communication services to your school"
    >
      <div className="space-y-4">
        <SettingsSection
          title="Payment Methods"
          description="Configure enabled payment options used across fee and marketplace checkout."
          form={form}
          saveLabel="Save Payment Methods"
        >
          {form.values.methods.length === 0 ? (
            <div className="win11-infobar warning">
              Payment methods could not be loaded. Check the backend connection, then refresh this page.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {form.values.methods.map((method) => (
                <PaymentMethodCard
                  key={method.key}
                  method={method}
                  onPatch={(patch) => updateMethod(method.key, patch)}
                />
              ))}
            </div>
          )}
        </SettingsSection>

        <DataPanel
          title={
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Communication Channels
            </span>
          }
        >
          <div className="flex items-start gap-2 text-[12px] mb-3" style={{ color: "var(--w11-text-secondary)" }}>
            <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--w11-accent)" }} />
            <p>
              WhatsApp and SMS are provided by their own plugins. Enable the plugin
              in the marketplace, then configure credentials on its settings page.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {channels.map((ch) => {
              const installed = isPluginInstalled(ch.slug);
              return (
                <div key={ch.slug} className="win11-card flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm" style={{ color: "var(--w11-text-primary)" }}>{ch.label}</h3>
                      <StatusChip
                        status={installed ? "active" : "inactive"}
                        label={installed ? "Plugin active" : "Not installed"}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--w11-text-secondary)" }}>{ch.desc}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild disabled={!installed}>
                    <Link href={ch.href}>Configure</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </DataPanel>
      </div>
    </SettingsPage>
  );
}

export default function IntegrationsPage() {
  return (
    <PluginGate slug="settings_core">
      <IntegrationsContent />
    </PluginGate>
  );
}
