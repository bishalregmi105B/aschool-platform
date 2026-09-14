"use client";
import { AdvancedSelect } from "@/components/ui/advanced-select";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useUrlFilters } from "@/components/ui/filter-bar";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import {
  MessageSquare,
  Send,
  FileText,
  History,
  Wallet,
  Plus,
  RefreshCw,
  Radio,
} from "lucide-react";

/**
 * SMS — credits + templates + direct send (plan 34-15/16, §7 merge context).
 *
 * The route stays (the AOS route table is owned by the navigation step), but
 * the page no longer federates the whole Communications family — that job
 * belongs to /dashboard/communications, which is where the first quick link
 * now goes. Bulk audience sends live in Broadcast (one A3 composer with
 * EntityPicker recipients); this Send tab is kept for ad-hoc one-off phone
 * lists, with the same character/credit meter so cost is never a surprise.
 */

// ── Types ──────────────────────────────────────────────────────────────────
interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  created_at: string;
}

interface SmsLog {
  // Matches GET /sms/history serializer: one row per recipient phone.
  id: string;
  to_phone: string;
  message: string;
  status: "sent" | "failed" | "queued";
  provider?: string;
  cost?: number;
  sent_at?: string | null;
  created_at: string;
}

interface SmsStats {
  credits_available: number;
  total_sent: number;
  total_failed: number;
  this_month_sent: number;
}

export default function SmsPage() {
  return (
    <AppGate slug="sms_notifications">
      <SmsPageContent />
    </AppGate>
  );
}

function SmsPageContent() {
  const { t } = useI18n();
  const { values, setValues } = useUrlFilters(["tab"]);
  const activeTab = values.tab || "send";
  const { user } = useAuth();
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";

  // Hub KPIs — same queryKeys/endpoints the tabs already use (react-query
  // dedupes, so opening a tab never refetches what's shown here).
  const { data: stats } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsStats }>("/sms/stats");
      return res.data.data;
    },
    retry: 1,
  });

  const { data: templates } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsTemplate[] }>("/sms/templates");
      return res.data.data || [];
    },
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("SMS Notifications", "SMS सूचना")}
        subtitle={t(
          "Sparrow SMS balance, templates and direct sends",
          "Sparrow SMS ब्यालेन्स, टेम्प्लेट र प्रत्यक्ष पठाइ"
        )}
        actions={
          <Link href="/dashboard/communications">
            <Button variant="outline" size="sm">
              <Radio className="h-4 w-4 mr-2" />
              {t("Communications Hub", "सञ्चार हब")}
            </Button>
          </Link>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard
            label={t("Credits Available", "बाँकी क्रेडिट")}
            value={stats?.credits_available ?? "—"}
            icon={<Wallet className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Sent This Month", "यस महिना")}
            value={stats?.this_month_sent ?? "—"}
            icon={<Send className="h-4 w-4" style={{ color: "#107c10" }} />}
            color="#107c10"
          />
          <KpiCard
            label={t("Total Sent", "कुल पठाइएको")}
            value={stats?.total_sent ?? "—"}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Total Failed", "कुल असफल")}
            value={stats?.total_failed ?? "—"}
            color={(stats?.total_failed ?? 0) > 0 ? "#c42b1c" : "var(--w11-text-secondary)"}
          />
        </StatGrid>

        <QuickLinks
          section="Communication"
          links={[
            { label: t("Communications Hub", "सञ्चार हब"), icon: "Radio", href: "/dashboard/communications" },
            { label: t("Broadcast", "प्रसारण"), icon: "Send", href: "/dashboard/communications/broadcast" },
            { label: t("WhatsApp Bot", "WhatsApp बोट"), icon: "MessageCircle", href: "/dashboard/communications/whatsapp" },
          ]}
        />

        <Tabs value={activeTab} onValueChange={(v) => setValues({ tab: v })}>
          <TabsList>
            <TabsTrigger value="send">
              <Send className="h-3.5 w-3.5 mr-1.5" /> {t("Send SMS", "SMS पठाउनुहोस्")}
            </TabsTrigger>
            <TabsTrigger value="templates" badge={(templates?.length || 0) || undefined}>
              <FileText className="h-3.5 w-3.5 mr-1.5" /> {t("Templates", "टेम्प्लेटहरू")}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-3.5 w-3.5 mr-1.5" /> {t("History", "इतिहास")}
            </TabsTrigger>
            <TabsTrigger value="credits">
              <Wallet className="h-3.5 w-3.5 mr-1.5" /> {t("Credits", "क्रेडिट")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-4">
            <SendSmsTab isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="templates" className="mt-4">
            <TemplatesTab isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="credits" className="mt-4">
            <CreditsTab />
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

// ── Send SMS Tab ───────────────────────────────────────────────────────────
function SendSmsTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsTemplate[] }>("/sms/templates");
      return res.data.data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toList = recipients.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      return api.post("/sms/send", { to: toList, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-history"] });
      queryClient.invalidateQueries({ queryKey: ["sms-stats"] });
      toast.success(t("SMS queued for delivery", "SMS पठाइको लाइनमा छ"));
      setRecipients("");
      setMessage("");
      setSelectedTemplate("");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        t("Failed to send SMS", "SMS पठाउन असफल");
      toast.error(msg);
    },
  });

  const charsUsed = message.length;
  const smsCount = Math.ceil(charsUsed / 160) || 1;
  const recipientCount = recipients.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length;

  if (!isAdmin) {
    return (
      <DataPanel>
        <p className="text-[12px] py-4 text-center" style={{ color: "var(--w11-text-secondary)" }}>
          {t("Only school admins can send SMS from here.", "यहाँबाट SMS केवल विद्यालय एडमिनले पठाउन सक्छन्।")}
        </p>
      </DataPanel>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <p className="text-[11px] mb-3" style={{ color: "var(--w11-text-secondary)" }}>
          {t(
            "For audience-based sends (all parents, one class, defaulters) use Broadcast — it picks recipients for you.",
            "श्रोता-आधारित पठाइका लागि (सबै अभिभावक, एक कक्षा, असुली) Broadcast प्रयोग गर्नुहोस्।"
          )}{" "}
          <Link href="/dashboard/communications/broadcast" style={{ color: "var(--w11-accent)" }} className="underline">
            {t("Open Broadcast", "Broadcast खोल्नुहोस्")}
          </Link>
        </p>
        <div className="space-y-2">
          <Label htmlFor="sms-recipients">
            {t("Recipients", "प्राप्तकर्ता")}{" "}
            <span className="font-normal" style={{ color: "var(--w11-text-secondary)" }}>
              ({t("comma or newline separated", "कomma वा newline ले छुट्याइएको")})
            </span>
          </Label>
          <Textarea
            id="sms-recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder={"9841234567\n9851234567"}
            rows={4}
            className="font-mono"
          />
          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {t(`${recipientCount} valid-looking number(s)`, `${recipientCount} नम्बर`)}
          </p>
        </div>
      </div>

      {templates && templates.length > 0 && (
        <div className="space-y-2">
          <Label>{t("Use Template (optional)", "टेम्प्लेट प्रयोग (वैकल्पिक)")}</Label>
          <AdvancedSelect
            value={selectedTemplate}
            onChange={(v) => {
              setSelectedTemplate(v);
              const tpl = templates.find((x) => x.id === v);
              if (tpl) setMessage(tpl.content);
            }}
            clearable
            searchable
            placeholder={t("— Select a template —", "— टेम्प्लेट छान्नुहोस् —")}
            options={templates.map((x) => ({ value: x.id, label: `${x.name} (${x.category})` }))}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sms-message">{t("Message", "सन्देश")}</Label>
        <Textarea
          id="sms-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={960}
        />
        <div className="flex justify-between text-xs" style={{ color: "var(--w11-text-secondary)" }}>
          <span>{charsUsed}/160 {t("chars", "अक्षर")}</span>
          <span>
            {t("Estimated cost", "अनुमानित लागत")}: {smsCount * Math.max(recipientCount, 1)}{" "}
            {t("credits", "क्रेडिट")} ({smsCount} {t("SMS", "SMS")} × {recipientCount})
          </span>
        </div>
      </div>

      <Button
        onClick={() => sendMutation.mutate()}
        disabled={sendMutation.isPending || !message.trim() || !recipients.trim()}
      >
        {sendMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        {sendMutation.isPending ? t("Sending…", "पठाउँदै…") : t("Send SMS", "SMS पठाउनुहोस्")}
      </Button>
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────────────────────
function TemplatesTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", content: "", category: "general" });
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsTemplate[] }>("/sms/templates");
      return res.data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/sms/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
      setShowForm(false);
      setFormData({ name: "", content: "", category: "general" });
      toast.success(t("Template saved", "टेम्प्लेट सेभ भयो"));
    },
    onError: () => toast.error(t("Could not save template", "टेम्प्लेट सेभ गर्न सकिएन")),
  });

  const columns: Column<SmsTemplate>[] = [
    { key: "name", label: t("Name", "नाम"), render: (x) => <span className="font-medium">{x.name}</span>, value: (x) => x.name },
    {
      key: "category",
      label: t("Category", "श्रेणी"),
      width: 130,
      render: (x) => <span className="win11-chip accent capitalize">{x.category}</span>,
      value: (x) => x.category,
    },
    {
      key: "content",
      label: t("Content", "सन्देश"),
      render: (x) => (
        <span className="text-[12px] block max-w-sm truncate" style={{ color: "var(--w11-text-secondary)" }}>
          {x.content}
        </span>
      ),
      value: (x) => x.content,
    },
  ];

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("Add Template", "टेम्प्लेट थप्नुहोस्")}
        </Button>
      )}

      {showForm && (
        <DataPanel title={t("New Template", "नयाँ टेम्प्लेट")}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">{t("Name", "नाम")}</Label>
                <Input
                  id="tpl-name"
                  value={formData.name}
                  onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                  placeholder={t("Template name", "टेम्प्लेट नाम")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Category", "श्रेणी")}</Label>
                <AdvancedSelect
                  value={formData.category}
                  onChange={(v) => setFormData((d) => ({ ...d, category: v }))}
                  options={[
                    { value: "general", label: t("General", "साधारण") },
                    { value: "attendance", label: t("Attendance", "उपस्थिति") },
                    { value: "fees", label: t("Fees", "शुल्क") },
                    { value: "exam", label: t("Exam", "परीक्षा") },
                    { value: "notice", label: t("Notice", "सूचना") },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-content">{t("Content", "सन्देश")}</Label>
              <Textarea
                id="tpl-content"
                value={formData.content}
                onChange={(e) => setFormData((d) => ({ ...d, content: e.target.value }))}
                rows={3}
                placeholder={t("SMS message content…", "SMS सन्देश…")}
              />
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                {formData.content.length}/160
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.name.trim() || !formData.content.trim()}
              >
                {createMutation.isPending && <Spinner size="sm" className="mr-2" />}
                {t("Save Template", "टेम्प्लेट सेभ")}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                {t("Cancel", "रद्द")}
              </Button>
            </div>
          </div>
        </DataPanel>
      )}

      <DataPanel>
        <DataTable
          columns={columns}
          rows={templates || []}
          rowKey={(x) => x.id}
          loading={isLoading}
          searchable
          empty={{
            icon: FileText,
            title: t("No templates yet", "अझै टेम्प्लेट छैन"),
            body: t("Create a template to reuse common SMS messages.", "बारम्बार आउने SMS सन्देश टेम्प्लेटमा राख्नुहोस्।"),
            action: isAdmin
              ? { label: t("Add Template", "टेम्प्लेट थप्नुहोस्"), onClick: () => setShowForm(true) }
              : undefined,
          }}
        />
      </DataPanel>
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────
function HistoryTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sms-history"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsLog[] }>("/sms/history?per_page=50");
      return res.data.data || [];
    },
  });

  const columns: Column<SmsLog>[] = [
    {
      key: "created_at",
      label: t("Date (BS)", "मिति (बि.सं.)"),
      width: 140,
      render: (l) => (
        <span className="text-[12px] whitespace-nowrap" style={{ color: "var(--w11-text-secondary)" }}>
          {displayBS(l.created_at)}
        </span>
      ),
      value: (l) => l.created_at,
    },
    {
      key: "message",
      label: t("Message", "सन्देश"),
      render: (l) => <span className="text-[12px] block max-w-xs truncate">{l.message}</span>,
      value: (l) => l.message,
    },
    {
      key: "to_phone",
      label: t("Recipient", "प्राप्तकर्ता"),
      width: 140,
      render: (l) => <span className="font-mono text-[12px]">{l.to_phone}</span>,
      value: (l) => l.to_phone,
    },
    {
      key: "status",
      label: t("Status", "स्थिति"),
      width: 110,
      // "queued" is the state every /sms/send row starts in (Celery flips it
      // to sent/failed) — the chip map covers sent/queued/failed honestly.
      render: (l) => (
        <StatusChip
          status={l.status === "sent" ? "completed" : l.status === "failed" ? "failed" : "pending"}
          label={
            l.status === "sent"
              ? t("Sent", "पठित")
              : l.status === "failed"
                ? t("Failed", "असफल")
                : t("Queued", "लाइनमा")
          }
        />
      ),
      value: (l) => l.status,
    },
  ];

  return (
    <DataPanel
      title={t("Recent SMS logs", "पछिल्ला SMS लगहरू")}
      actions={
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          {t("Refresh", "ताजा")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={data || []}
        rowKey={(l) => l.id}
        loading={isLoading}
        error={isError ? t("Could not load SMS history", "SMS इतिहास लोड गर्न सकिएन") : null}
        onRetry={() => refetch()}
        exportFileName="sms-history"
        empty={{
          icon: History,
          title: t("No SMS history", "SMS इतिहास छैन"),
          body: t("Sent messages will appear here.", "पठाएका सन्देश यहाँ देखिन्छन्।"),
        }}
      />
    </DataPanel>
  );
}

// ── Credits Tab ────────────────────────────────────────────────────────────
function CreditsTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsStats }>("/sms/stats");
      return res.data.data;
    },
    retry: 1,
  });

  if (isError) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="win11-infobar error rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">{t("Couldn't load SMS credits", "SMS क्रेडिट लोड गर्न सकिएन")}</p>
          <p className="text-xs">
            {error instanceof axios.AxiosError && error.response?.status === 403
              ? t(
                  "The SMS Notifications plugin is not active for your school. Activate it under Installed Plugins.",
                  "तपाईंको विद्यालयमा SMS प्लगइभ सक्रिय छैन।"
                )
              : t(
                  "The SMS service didn't respond. Check your connection and try again.",
                  "SMS सेवाले जवाफ दिएन। पुन: प्रयास गर्नुहोस्।"
                )}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("Retry", "पुन: प्रयास")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "var(--w11-control-hover)" }} />
          ))}
        </div>
      ) : (
        <>
          <StatGrid min={200} className="mb-0">
            <KpiCard label={t("Credits Available", "बाँकी क्रेडिट")} value={data?.credits_available ?? "—"} />
            <KpiCard label={t("This Month Sent", "यस महिना")} value={data?.this_month_sent ?? "—"} />
            <KpiCard label={t("Total Sent", "कुल पठित")} value={data?.total_sent ?? "—"} />
            <KpiCard
              label={t("Total Failed", "कुल असफल")}
              value={data?.total_failed ?? "—"}
              color={data?.total_failed ? "#c42b1c" : undefined}
            />
          </StatGrid>

          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? t("Checking…", "जाँचदै…") : t("Check Balance", "ब्यालेन्स जाँच")}
          </Button>

          <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
            {t(
              "Credits are provided by Sparrow SMS. Contact your administrator to top up credits.",
              "क्रेडिट Sparrow SMS बाट आउँछ। टाप-अपका लागि एडमिनसँग सम्पर्क गर्नुहोस्।"
            )}
          </p>
        </>
      )}
    </div>
  );
}
