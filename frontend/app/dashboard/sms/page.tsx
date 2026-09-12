"use client";
import { AdvancedSelect } from "@/components/ui/advanced-select";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import {
  MessageSquare,
  Send,
  FileText,
  History,
  Wallet,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

const inputStyle = {
  background: "var(--w11-control-bg)",
  color: "var(--w11-text-primary)",
  border: "1px solid var(--w11-border-default)",
  borderRadius: "var(--w11-radius-md)",
};

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

// ── Tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "send", label: "Send SMS", icon: Send },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "history", label: "History", icon: History },
  { id: "credits", label: "Credits", icon: Wallet },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Page ───────────────────────────────────────────────────────────────────
export default function SmsPage() {
  return (
    <PluginGate slug="sms_notifications">
      <SmsPageContent />
    </PluginGate>
  );
}

function SmsPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>("send");
  const { user } = useAuth();
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";

  return (
    <AOSPage>
      <AOSPageHeader
        icon={
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--w11-accent-light)" }}>
            <MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
          </div>
        }
        title="SMS Notifications"
        subtitle="Send SMS to parents, students and staff via Sparrow SMS"
      />
      <AOSPageBody>
        {/* Tabs */}
        <div className="border-b border-[color:var(--w11-border-subtle)] mb-4">
          <nav className="-mb-px flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderColor: activeTab === tab.id ? "var(--w11-accent)" : "transparent",
                  color: activeTab === tab.id ? "var(--w11-accent)" : "var(--w11-text-secondary)",
                }}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "send" && <SendSmsTab isAdmin={isAdmin} />}
          {activeTab === "templates" && <TemplatesTab isAdmin={isAdmin} />}
          {activeTab === "history" && <HistoryTab />}
          {activeTab === "credits" && <CreditsTab />}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

// ── Send SMS Tab ───────────────────────────────────────────────────────────
function SendSmsTab({ isAdmin }: { isAdmin: boolean }) {
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [result, setResult] = useState<{
    success?: string;
    error?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsTemplate[] }>(
        "/sms/templates",
      );
      return res.data.data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toList = recipients
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return api.post("/sms/send", { to: toList, message });
    },
    onSuccess: () => {
      setResult({ success: `SMS sent successfully!` });
      queryClient.invalidateQueries({ queryKey: ["sms-history"] });
      queryClient.invalidateQueries({ queryKey: ["sms-stats"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to send SMS. Please try again.";
      setResult({ error: msg });
    },
  });

  const charsUsed = message.length;
  const smsCount = Math.ceil(charsUsed / 160) || 1;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates?.find((t) => t.id === templateId);
    if (tpl) setMessage(tpl.content);
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Recipients */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Recipients
          <span className="font-normal ml-1 text-[color:var(--w11-text-secondary)]">
            (phone numbers, comma or newline separated)
          </span>
        </label>
        <textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="9841234567&#10;9851234567&#10;..."
          rows={4}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none font-mono"
          style={inputStyle}
        />
        <p className="text-xs text-[color:var(--w11-text-secondary)]">
          {
            recipients
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean).length
          }{" "}
          number(s)
        </p>
      </div>

      {/* Template picker */}
      {templates && templates.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Use Template (optional)</label>
          <AdvancedSelect
            value={selectedTemplate}
            onChange={(v) => handleTemplateSelect(v)}
            clearable
            searchable
            placeholder="— Select a template —"
            options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))}
          />
        </div>
      )}

      {/* Message */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          rows={5}
          maxLength={960}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none"
          style={inputStyle}
        />
        <div className="flex justify-between text-xs text-[color:var(--w11-text-secondary)]">
          <span>{charsUsed}/160 chars</span>
          <span>
            {smsCount} SMS credit{smsCount > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Result feedback */}
      {result && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${result.success ? "win11-infobar success" : "win11-infobar error"}`}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {result.success || result.error}
        </div>
      )}

      {/* Actions */}
      {isAdmin && (
        <button
          onClick={() => {
            setResult(null);
            sendMutation.mutate();
          }}
          disabled={
            sendMutation.isPending || !message.trim() || !recipients.trim()
          }
          className="win11-btn accent flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sendMutation.isPending ? "Sending…" : "Send SMS"}
        </button>
      )}
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────────────────────
function TemplatesTab({ isAdmin }: { isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    category: "general",
  });
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsTemplate[] }>(
        "/sms/templates",
      );
      return res.data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/sms/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
      setShowForm(false);
      setFormData({ name: "", content: "", category: "general" });
    },
  });

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="win11-btn accent flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Template
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <div className="win11-card p-5 space-y-4">
          <h3 className="font-semibold text-[color:var(--w11-text-primary)]">New Template</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <input
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value }))
                }
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <AdvancedSelect
                value={formData.category}
                onChange={(v) => setFormData((d) => ({ ...d, category: v }))}
                options={[
                  { value: "general", label: "General" },
                  { value: "attendance", label: "Attendance" },
                  { value: "fees", label: "Fees" },
                  { value: "exam", label: "Exam" },
                  { value: "notice", label: "Notice" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData((d) => ({ ...d, content: e.target.value }))
              }
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={inputStyle}
              placeholder="SMS message content…"
            />
            <p className="text-xs text-[color:var(--w11-text-secondary)]">
              {formData.content.length}/160 chars
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(formData)}
              disabled={
                createMutation.isPending ||
                !formData.name.trim() ||
                !formData.content.trim()
              }
              className="win11-btn accent flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Save Template
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="win11-btn px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
        </div>
      ) : templates && templates.length > 0 ? (
        <DataPanel bodyClassName="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--w11-border-subtle)]" style={{ background: "var(--w11-control-hover)" }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Content</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--w11-border-subtle)]">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className="win11-chip accent capitalize">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-sm truncate text-[color:var(--w11-text-secondary)]">
                    {t.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      ) : (
        <DataPanel>
          <AOSEmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No templates yet"
            description="Create a template to reuse common SMS messages"
          />
        </DataPanel>
      )}
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────
function HistoryTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sms-history"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsLog[] }>(
        "/sms/history?per_page=50",
      );
      return res.data.data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--w11-text-secondary)]">Recent SMS logs</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-[color:var(--w11-text-secondary)]"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
        </div>
      ) : data && data.length > 0 ? (
        <DataPanel bodyClassName="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--w11-border-subtle)]" style={{ background: "var(--w11-control-hover)" }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Message</th>
                <th className="text-left px-4 py-3 font-medium">Recipient</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--w11-border-subtle)]">
              {data.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-[color:var(--w11-text-secondary)]">
                    {displayBS(log.created_at)}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{log.message}</td>
                  <td className="px-4 py-3 text-[color:var(--w11-text-secondary)]">
                    {log.to_phone}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      ) : (
        <DataPanel>
          <AOSEmptyState
            icon={<History className="h-10 w-10" />}
            title="No SMS history"
            description="Sent messages will appear here"
          />
        </DataPanel>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SmsLog["status"] }) {
  // "queued" is the state every /sms/send row starts in (Celery flips it to
  // sent/failed) — a missing entry here crashed the whole history table.
  const config: Record<string, { label: string; tone: string }> = {
    sent: { label: "Sent", tone: "success" },
    failed: { label: "Failed", tone: "error" },
    queued: { label: "Queued", tone: "warning" },
    pending: { label: "Pending", tone: "warning" },
  };
  const badge = config[status] ?? { label: status, tone: "" };
  return (
    <span className={`win11-chip ${badge.tone}`}>
      {badge.label}
    </span>
  );
}

// ── Credits Tab ────────────────────────────────────────────────────────────
function CreditsTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsStats }>(
        "/sms/stats",
      );
      return res.data.data;
    },
    retry: 1,
  });

  if (isError) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="win11-infobar error rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">
            Couldn&apos;t load SMS credits
          </p>
          <p className="text-xs">
            {error instanceof axios.AxiosError && error.response?.status === 403
              ? "The SMS Notifications plugin is not active for your school. Activate it under Installed Plugins."
              : "The SMS service didn't respond. Check your connection and try again."}
          </p>
          <button
            onClick={() => refetch()}
            className="win11-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <StatGrid min={200} className="mb-0">
            <KpiCard label="Credits Available" value={data?.credits_available ?? "—"} />
            <KpiCard label="This Month Sent" value={data?.this_month_sent ?? "—"} />
            <KpiCard label="Total Sent" value={data?.total_sent ?? "—"} />
            <KpiCard label="Total Failed" value={data?.total_failed ?? "—"} color={!!data?.total_failed ? "#c42b1c" : undefined} />
          </StatGrid>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="win11-btn flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Checking…" : "Check Balance"}
          </button>

          <p className="text-xs text-[color:var(--w11-text-secondary)]">
            Credits are provided by Sparrow SMS. Contact your administrator to
            top up credits.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <KpiCard label={label} value={typeof value === "number" ? value.toLocaleString() : value} />
  );
}
