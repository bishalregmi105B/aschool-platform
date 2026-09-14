"use client";

/**
 * Profile (archetype A2 single-object — plan 34 #13: ObjectHeader +
 * EditableFields + security section with MFA enable, wiring the TOTP
 * backend UI gap).
 *
 * Research notes: (1) self-service account pages should inline-edit the
 * cheap fields (name/address) and gate the dangerous ones (password, MFA)
 * behind explicit confirmations; (2) MFA enrolment is the standard
 * show-QR → verify-code ritual; the backend returns `qr_data_url` so no
 * client QR library is needed.
 *
 * MFA wiring is real: POST /auth/totp/setup (secret+QR), POST
 * /auth/totp/verify {code} (activates), POST /auth/totp/disable
 * {password}. Status reads user.permissions.mfa_enabled from /auth/me
 * (to_dict strips *_secret keys but exposes mfa_enabled).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ShieldCheck, Smartphone, KeyRound, Copy, ShieldAlert, LogOut, User as UserIcon } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader, EditableField } from "@/components/aos/kit/detail-kit";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const mfaEnabled = !!(user?.permissions as Record<string, unknown> | undefined)?.mfa_enabled;

  const saveField = async (patch: Record<string, unknown>) => {
    await api.put("/auth/me", patch);
    await refreshUser();
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<UserIcon className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Profile"
        subtitle={t("Account details, preferences and security", "खाता विवरण र सुरक्षा")}
      />
      <AOSPageBody>
        <ObjectHeader
          className="mb-4"
          name={user?.full_name || "—"}
          nameNepali={user?.full_name_nepali}
          code={user?.email || user?.phone || (user as any)?.login_id}
          codeLabel={t("Login", "लगइन")}
          status={user?.is_active === false ? "inactive" : "active"}
          avatar={<Avatar name={user?.full_name || "User"} src={user?.avatar_url} size="lg" />}
          meta={
            <div className="flex items-center gap-2">
              <StatusChip status="user" label={(user?.role || "member").replace("_", " ")} className="capitalize" />
              {mfaEnabled && <StatusChip status="active" label={t("MFA on", "MFA चालु")} />}
            </div>
          }
        />

        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">{t("Account", "खाता")}</TabsTrigger>
            <TabsTrigger value="security">{t("Security", "सुरक्षा")}</TabsTrigger>
          </TabsList>

          {/* ── Account ── */}
          <TabsContent value="account">
            <FormSection title={t("Editable details", "सम्पादनयोग्य विवरण")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Full name", "पूरा नाम")}>
                  <EditableField
                    value={user?.full_name}
                    aria-label={t("Full name", "पूरा नाम")}
                    onSave={(v) => saveField({ full_name: v })}
                  />
                </Field>
                <Field label={t("Full name (Nepali)", "पूरा नाम (नेपाली)")}>
                  <EditableField
                    value={user?.full_name_nepali}
                    aria-label={t("Full name Nepali", "पूरा नाम नेपाली")}
                    onSave={(v) => saveField({ full_name_nepali: v })}
                  />
                </Field>
                <Field label={t("Address", "ठेगाना")} full>
                  <EditableField
                    value={(user as any)?.address}
                    aria-label={t("Address", "ठेगाना")}
                    onSave={(v) => saveField({ address: v })}
                  />
                </Field>
                <Field label={t("Language", "भाषा")}>
                  <AdvancedSelect
                    className="w-40"
                    value={(user?.preferred_language as string) || "en"}
                    onChange={(v) => saveField({ preferred_language: v })}
                    options={[
                      { value: "en", label: "English" },
                      { value: "ne", label: "नेपाली" },
                    ]}
                  />
                </Field>
                <Field label={t("Gender", "लिङ्ग")}>
                  <AdvancedSelect
                    className="w-40"
                    value={((user as any)?.gender as string) || ""}
                    onChange={(v) => saveField({ gender: v })}
                    clearable
                    placeholder="—"
                    options={[
                      { value: "male", label: t("Male", "पुरुष") },
                      { value: "female", label: t("Female", "महिला") },
                      { value: "other", label: t("Other", "अन्य") },
                    ]}
                  />
                </Field>
              </div>
            </FormSection>
            <FormSection title={t("Sign-in identity (managed by admin)", "लगइन पहिचान")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Email", "इमेल")}>
                  <span>{user?.email || "—"}</span>
                </Field>
                <Field label={t("Phone", "फोन")}>
                  <span>{user?.phone || "—"}</span>
                </Field>
              </div>
            </FormSection>
          </TabsContent>

          {/* ── Security ── */}
          <TabsContent value="security" className="space-y-4">
            <ChangePasswordCard />
            <MfaCard enabled={mfaEnabled} onAfterChange={refreshUser} />
            <SessionsCard />
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <p className="text-[12px] font-medium" style={{ color: "var(--w11-text-secondary)" }}>{label}</p>
      <div className="text-sm" style={{ color: "var(--w11-text-primary)" }}>{children}</div>
    </div>
  );
}

function ChangePasswordCard() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const change = useMutation({
    mutationFn: async () => (await api.post("/auth/change-password", { current_password: current, new_password: next })).data,
    onSuccess: () => {
      toast.success(t("Password changed", "पासवर्ड परिवर्तन भयो"));
      setCurrent(""); setNext(""); setConfirmPw("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to change password", "पासवर्ड परिवर्तन असफल")),
  });

  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> {t("Password", "पासवर्ड")}
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3 max-w-2xl">
        <div className="space-y-2">
          <Label>{t("Current password", "वर्तमान पासवर्ड")}</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("New password", "नयाँ पासवर्ड")}</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} />
        </div>
        <div className="space-y-2">
          <Label>{t("Confirm", "पुष्टि")}</Label>
          <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
      </div>
      <Button
        className="mt-4"
        disabled={!current || next.length < 6 || next !== confirmPw || change.isPending}
        onClick={() => change.mutate()}
      >
        {change.isPending ? <Spinner className="mr-2" /> : null}
        {t("Change password", "पासवर्ड परिवर्तन")}
      </Button>
    </DataPanel>
  );
}

/* MFA — wired to the real /auth/totp/* endpoints (setup → verify → disable). */
function MfaCard({ enabled, onAfterChange }: { enabled: boolean; onAfterChange: () => Promise<void> }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr_data_url?: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");

  const startSetup = useMutation({
    mutationFn: async () => (await api.post("/auth/totp/setup")).data?.data,
    onSuccess: (d) => setSetup(d),
    onError: (e: any) => toast.error(e?.response?.data?.error || t("TOTP not available on this server", "MFA उपलब्ध छैन")),
  });

  const verify = useMutation({
    mutationFn: async () => (await api.post("/auth/totp/verify", { code })).data,
    onSuccess: async () => {
      setSetup(null);
      setCode("");
      await onAfterChange();
      toast.success(t("Two-factor authentication is on", "दोहोरो प्रमाणीकरण सक्रिय"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Invalid code", "गलत कोड")),
  });

  const disable = async () => {
    const ok = await confirm({
      title: t("Turn off two-factor?", "दोहोरो प्रमाणीकरण बन्द गर्ने?"),
      body: t("Your account is less protected until you re-enable it.", "खाता कम सुरक्षित हुनेछ।"),
      confirmLabel: t("Turn off", "बन्द"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.post("/auth/totp/disable", { password: disablePw });
      await onAfterChange();
      setDisablePw("");
      toast.success(t("Two-factor authentication is off", "दोहोरो प्रमाणीकरण बन्द भयो"));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t("Incorrect password", "पासवर्ड गलत छ"));
    }
  };

  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: enabled ? "#107c10" : "var(--w11-accent)" }} />
          {t("Two-factor authentication (MFA)", "दोहोरो प्रमाणीकरण")}
        </span>
      }
      actions={<StatusChip status={enabled ? "active" : "inactive"} label={enabled ? t("On", "चालु") : t("Off", "बन्द")} />}
    >
      {!enabled && !setup && (
        <>
          <p className="text-sm mb-3" style={{ color: "var(--w11-text-secondary)" }}>
            {t(
              "Protect this account with an authenticator app (Google Authenticator, Authy…). You'll scan a QR code and confirm a 6-digit code.",
              "Authenticator एपले खाता सुरक्षित बनाउनुहोस्।"
            )}
          </p>
          <Button onClick={() => startSetup.mutate()} disabled={startSetup.isPending}>
            {startSetup.isPending ? <Spinner className="mr-2" /> : <Smartphone className="h-4 w-4 mr-2" />}
            {t("Set up MFA", "MFA सेटअप")}
          </Button>
        </>
      )}

      {setup && (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          <div className="space-y-2">
            {setup.qr_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={setup.qr_data_url} alt="MFA QR code" className="h-44 w-44 rounded-lg border bg-white p-2" />
            ) : (
              <p className="text-xs font-mono break-all rounded-lg border p-3">{setup.uri}</p>
            )}
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono break-all flex-1" style={{ color: "var(--w11-text-secondary)" }}>{setup.secret}</code>
              <Button size="sm" variant="ghost" aria-label="Copy secret" onClick={() => { navigator.clipboard?.writeText(setup.secret); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <Label>{t("Enter the 6-digit code from your app", "एपको ६-अंक कोड")}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="tracking-[0.4em] font-mono w-40"
            />
            <div className="flex gap-2">
              <Button onClick={() => verify.mutate()} disabled={code.length !== 6 || verify.isPending}>
                {verify.isPending ? <Spinner className="mr-2" /> : null}
                {t("Verify & enable", "प्रमाणीकरण")}
              </Button>
              <Button variant="outline" onClick={() => { setSetup(null); setCode(""); }}>{t("Cancel", "रद्द")}</Button>
            </div>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-3">
          <div className="win11-infobar success flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-[13px]">{t("Authenticator codes are required at sign-in.", "लगइनमा कोड चाहिन्छ।")}</p>
          </div>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              type="password"
              value={disablePw}
              onChange={(e) => setDisablePw(e.target.value)}
              placeholder={t("Current password to disable", "बन्द गर्न पासवर्ड")}
            />
            <Button variant="destructive" onClick={disable} disabled={!disablePw}>
              <ShieldAlert className="h-4 w-4 mr-2" /> {t("Turn off", "बन्द")}
            </Button>
          </div>
        </div>
      )}
    </DataPanel>
  );
}

function SessionsCard() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const logoutAll = useMutation({
    mutationFn: async () => (await api.post("/auth/logout-all")).data,
    onSuccess: () => { toast.success(t("Signed out everywhere", "सबै ठाउँबाट लगआउट")); },
    onError: () => toast.error("Failed"),
  });
  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <LogOut className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
          {t("Sessions", "सत्रहरू")}
        </span>
      }
    >
      <p className="text-sm mb-3" style={{ color: "var(--w11-text-secondary)" }}>
        {t("Sign out of every device (web + mobile apps).", "सबै यन्त्रबाट लगआउट।")}
      </p>
      <Button
        variant="outline"
        disabled={logoutAll.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: t("Sign out everywhere?", "सबै ठाउँबाट लगआउट?"),
            body: t("You and everyone using this account will need to sign in again.", "फेरि लगइन गर्नुपर्नेछ।"),
            confirmLabel: t("Sign out", "लगआउट"),
            tone: "danger",
          });
          if (ok) logoutAll.mutate();
        }}
      >
        {t("Sign out everywhere", "सबै ठाउँबाट लगआउट")}
      </Button>
    </DataPanel>
  );
}
