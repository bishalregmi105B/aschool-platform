"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import {
import { displayBS } from "@/lib/nepali_date";
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

// ── Types ──────────────────────────────────────────────────────────────────
interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  created_at: string;
}

interface SmsLog {
  id: string;
  to: string[];
  message: string;
  status: "sent" | "failed" | "pending";
  sent_count: number;
  failed_count: number;
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SMS Notifications</h1>
        </div>
        <p className="text-muted-foreground">
          Send SMS to parents, students and staff via Sparrow SMS
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
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
    </div>
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
          <span className="text-muted-foreground font-normal ml-1">
            (phone numbers, comma or newline separated)
          </span>
        </label>
        <textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="9841234567&#10;9851234567&#10;..."
          rows={4}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
        />
        <p className="text-xs text-muted-foreground">
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
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">— Select a template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
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
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{charsUsed}/160 chars</span>
          <span>
            {smsCount} SMS credit{smsCount > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Result feedback */}
      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            result.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
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
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Template
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-5 space-y-4 bg-muted/30">
          <h3 className="font-semibold">New Template</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <input
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value }))
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Template name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, category: e.target.value }))
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="general">General</option>
                <option value="attendance">Attendance</option>
                <option value="fees">Fees</option>
                <option value="exam">Exam</option>
                <option value="notice">Notice</option>
              </select>
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
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="SMS message content…"
            />
            <p className="text-xs text-muted-foreground">
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
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Save Template
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Content</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium capitalize">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">
                    {t.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">
            Create a template to reuse common SMS messages
          </p>
        </div>
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
        <p className="text-sm text-muted-foreground">Recent SMS logs</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data && data.length > 0 ? (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Message</th>
                <th className="text-left px-4 py-3 font-medium">Recipients</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {displayBS(log.created_at)}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{log.message}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.sent_count + log.failed_count}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No SMS history</p>
          <p className="text-sm mt-1">Sent messages will appear here</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "sent" | "failed" | "pending" }) {
  const config = {
    sent: { label: "Sent", cls: "bg-green-100 text-green-700" },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
  }[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

// ── Credits Tab ────────────────────────────────────────────────────────────
function CreditsTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SmsStats }>(
        "/sms/stats",
      );
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6 max-w-xl">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Credits Available"
              value={data?.credits_available ?? "—"}
              highlight
            />
            <StatCard
              label="This Month Sent"
              value={data?.this_month_sent ?? "—"}
            />
            <StatCard label="Total Sent" value={data?.total_sent ?? "—"} />
            <StatCard
              label="Total Failed"
              value={data?.total_failed ?? "—"}
              danger={!!data?.total_failed}
            />
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 border px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Checking…" : "Check Balance"}
          </button>

          <p className="text-xs text-muted-foreground">
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
  highlight,
  danger,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "bg-primary/5 border-primary/20"
          : danger
            ? "bg-red-50 border-red-100"
            : "bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          highlight ? "text-primary" : danger ? "text-red-600" : ""
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
