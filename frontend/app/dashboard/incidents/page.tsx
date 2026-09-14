"use client";

/**
 * Incidents hub — the SINGLE safety surface (plan 34-37/38 federation).
 *
 * Tab 1 "Reports" is the base incident CRUD (plugin `incidents`).
 * Tab 2 "Workflow & Escalation" embeds the premium `incident_management`
 * pages' content via their own exported components (ActiveCasesContent) plus
 * a read-only escalation pipeline with StatusTimeline history. The deep routes
 * under /dashboard/incident-management/* stay live and untouched — this tab
 * federates them, it does not replace them.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import Link from "next/link";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { EntityPicker } from "@/components/ui/entity-picker";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ActiveCasesContent } from "@/app/dashboard/incident-management/active/_ActiveCases";
import { Plus, AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, TrendingUp, FileText } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

const SEVERITY_TONE: Record<string, string> = {
  high: "failed",     // error chip
  medium: "pending",  // warning chip
  low: "subtle",
};

export default function IncidentsPage() {
  return <PluginGate slug="incidents"><IncidentsContent /></PluginGate>;
}

function IncidentsContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const [tab, setTab] = useState<string>(routeParams.get("tab") === "workflow" ? "workflow" : "reports");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", type: "behavioral", severity: "low", student_id: "", description: "" });

  const { isError, refetch, data, isLoading } = useQuery({
    queryKey: ["incidents", search],
    queryFn: async () => { const r = await api.get("/incidents", { params: { search: search || undefined } }); return r.data; },
  });

  const { data: escData } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => { const r = await api.get("/incidents/management/escalations"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  const incidents = data?.data || [];
  const escalations: any[] = Array.isArray(escData) ? escData : escData?.items ?? [];

  const create = useMutation({
    // Backend contract: POST /incidents {title, incident_type, severity, description,
    // involved_student_ids: [student uuid]} — incident_type enum is
    // bullying|fighting|vandalism|theft|medical|behavioral|other.
    mutationFn: async () => (await api.post("/incidents", {
      title: form.title,
      incident_type: form.type,
      severity: form.severity,
      description: form.description,
      involved_student_ids: form.student_id.trim() ? [form.student_id.trim()] : undefined,
    })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["incidents"] }); setShowDialog(false); toast.success(t("Incident recorded", "घटना दर्ता भयो")); setForm({ title: "", type: "behavioral", severity: "low", student_id: "", description: "" }); },
    onError: () => toast.error(t("Failed to record", "दर्ता गर्न सकिएन")),
  });

  if (isLoading) return <AOSModuleLoadingState label={t("Loading incidents…", "घटनाहरू लोड हुँदै…")} />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Incidents", "घटनाहरू")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load data. Please try again.", "डाटा लोड गर्न सकिएन। पुनःप्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const INCIDENT_COLUMNS: Column<any>[] = [
    { key: "created_at", label: t("Date", "मिति"), sortable: true, value: (i) => i.created_at ?? "", render: (i) => (i.created_at ? displayBS(i.created_at) : "—") },
    { key: "title", label: t("Title", "शीर्षक"), sortable: true, value: (i) => i.title ?? "", render: (i) => <span className="font-medium">{i.title}</span> },
    { key: "incident_type", label: t("Type", "प्रकार"), sortable: true, value: (i) => i.incident_type ?? "", render: (i) => <span className="win11-chip subtle">{i.incident_type}</span> },
    { key: "severity", label: t("Severity", "गम्भीरता"), sortable: true, value: (i) => i.severity ?? "", render: (i) => <StatusChip status={SEVERITY_TONE[i.severity] ?? "subtle"} label={i.severity} /> },
    { key: "student_name", label: t("Student", "विद्यार्थी"), value: (i) => i.student_name ?? "", render: (i) => i.student_name || "—" },
    { key: "status", label: t("Status", "अवस्था"), sortable: true, value: (i) => i.status ?? "open", render: (i) => <StatusChip status={i.status === "resolved" ? "resolved" : "pending"} label={i.status || "open"} /> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<AlertCircle className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Incidents", "घटनाहरू")}
        subtitle={`${incidents.length} ${t("incidents recorded", "घटना दर्ता")} · ${t("one surface: reports + workflow", "एकै ठाउँ: रिपोर्ट र वर्कफ्लो")}`}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("Report Incident", "घटना रिपोर्ट")}
          </Button>
        }
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real counts from the loaded incident list */}
        <StatGrid>
          <KpiCard
            label={t("Total Incidents", "कुल घटना")}
            value={incidents.length}
            icon={<AlertCircle className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Open", "खुला")}
            value={incidents.filter((i: any) => (i.status ?? "open") !== "resolved").length}
            color="#d83b01"
            icon={<ShieldAlert className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label={t("High Severity", "उच्च गम्भीरता")}
            value={incidents.filter((i: any) => i.severity === "high").length}
            color="#c42b1c"
            icon={<AlertTriangle className="h-4 w-4" style={{ color: "#c42b1c" }} />}
          />
          <KpiCard
            label={t("Escalated", "एस्केलेटेड")}
            value={escalations.length}
            color="#7719aa"
            icon={<TrendingUp className="h-4 w-4" style={{ color: "#7719aa" }} />}
          />
        </StatGrid>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="reports">{t("Reports", "रिपोर्टहरू")}</TabsTrigger>
            <TabsTrigger value="workflow" badge={escalations.length || undefined}>
              {t("Workflow & Escalation", "वर्कफ्लो र एस्केलेसन")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <DataPanel bodyClassName="p-0">
              <DataTable
                columns={INCIDENT_COLUMNS}
                rows={incidents}
                rowKey={(i: any) => i.id}
                searchable
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t("Search incidents…", "घटना खोज्नुहोस्…")}
                exportFileName="incidents"
                empty={{ icon: AlertCircle, title: t("No incidents recorded", "कुनै घटना छैन"), body: t("Record incidents to build the disciplinary history.", "अनुशासन इतिहास बनाउन घटना रिपोर्ट गर्नुहोस्।"), action: { label: t("Report Incident", "घटना रिपोर्ट"), onClick: () => setShowDialog(true) } }}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="workflow">
            <WorkflowTab />
          </TabsContent>
        </Tabs>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Report Incident", "घटना रिपोर्ट")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>{t("Title", "शीर्षक")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("Brief incident title", "संक्षिप्त शीर्षक")} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Type", "प्रकार")}</Label>
                  <AdvancedSelect
                    value={form.type}
                    onChange={(v) => setForm({ ...form, type: v })}
                    options={[
                      { value: "behavioral", label: t("Behavior", "व्यवहार") },
                      { value: "bullying", label: t("Bullying", "बुलाई") },
                      { value: "fighting", label: t("Fighting", "झगडा") },
                      { value: "vandalism", label: t("Vandalism", "भङ्गुर") },
                      { value: "theft", label: t("Theft", "चोरी") },
                      { value: "medical", label: t("Medical", "चिकित्सा") },
                      { value: "other", label: t("Other", "अन्य") },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Severity", "गम्भीरता")}</Label>
                  <AdvancedSelect
                    value={form.severity}
                    onChange={(v) => setForm({ ...form, severity: v })}
                    options={[
                      { value: "low", label: t("Low", "न्यून") },
                      { value: "medium", label: t("Medium", "मध्यम") },
                      { value: "high", label: t("High", "उच्च") },
                    ]}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("Involved student (optional)", "सम्बन्धित विद्यार्थी")}</Label>
                <EntityPicker
                  value={form.student_id}
                  onChange={(id) => setForm({ ...form, student_id: id })}
                  query={{ path: "/students", searchKey: "q", perPage: 20 }}
                  getOptions={(rows) => (rows as any[]).map((s) => ({ value: s.id, label: s.full_name ?? s.name ?? s.id, hint: s.admission_number }))}
                  placeholder={t("Search by name or admission no…", "नाम/भर्ना नम्बरले खोज्नुहोस्…")}
                  nePlaceholder="नाम/भर्ना नम्बरले खोज्नुहोस्…"
                />
              </div>
              <div className="space-y-2"><Label>{t("Description", "विवरण")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t("Cancel", "रद्द")}</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
                {create.isPending ? <Spinner className="mr-2" /> : null} {t("Submit", "पेश गर्नु")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}

/**
 * Workflow tab body. Plugin-gated independently: schools without the premium
 * incident_management plugin see the standard install gate here, while the
 * Reports tab keeps working.
 */
function WorkflowTab() {
  const { t } = useI18n();
  return (
    <PluginGate slug="incident_management">
      <WorkflowContent />
    </PluginGate>
  );
}

function WorkflowContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => { const r = await api.get("/incidents/management/escalations"); return r.data?.data ?? r.data; },
    retry: 1,
  });
  const escalations: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const resolve = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) =>
      (await api.patch(`/incidents/management/${id}/resolve`, { resolution })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["escalations"] }); queryClient.invalidateQueries({ queryKey: ["active-cases"] }); toast.success(t("Case resolved", "मुद्दा समाधान भयो")); },
    onError: () => toast.error(t("Failed to resolve", "समाधान गर्न सकिएन")),
  });

  const scheduleConference = useMutation({
    mutationFn: async (id: string) => (await api.post(`/incidents/management/${id}/conference`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["escalations"] }); toast.success(t("Parent conference scheduled", "अभिभावक भेट तय भयो")); },
    onError: () => toast.error(t("Failed to schedule", "तय गर्न सकिएन")),
  });

  if (isLoading) return <AOSModuleLoadingState label={t("Loading workflow…", "वर्कफ्लो लोड हुँदै…")} />;

  return (
    <div className="space-y-4">
      <DataPanel
        title={t("Escalation pipeline", "एस्केलेसन पाइपलाइन")}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/incident-management/escalations">{t("Open full page", "पूरा पृष्ठ खोल्नु")}</Link>
          </Button>
        }
      >
        {escalations.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
            {t("Nothing escalated — high-severity cases appear here once sent to the principal.", "कुनै एस्केलेसन छैन।")}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {escalations.map((e: any) => (
              <div key={e.id} className="win11-card" style={{ margin: 0 }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{e.title}</p>
                    <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {e.student_name ?? "—"} · {t("to", "समक्ष")} {e.escalated_to ?? t("Principal", "प्रधानाध्यापक")}
                    </p>
                  </div>
                  <StatusChip status={SEVERITY_TONE[e.severity] ?? "subtle"} label={e.severity} />
                </div>
                <StatusTimeline
                  currentIndex={e.status === "resolved" ? 3 : e.conference_scheduled ? 2 : 1}
                  steps={[
                    { label: t("Reported", "रिपोर्ट"), detail: e.created_at ? displayBS(e.created_at) : undefined },
                    { label: t("Escalated", "एस्केलेट"), at: e.escalated_at ? displayBS(e.escalated_at) : undefined },
                    { label: t("Conference", "भेट"), detail: e.conference_scheduled ? t("Scheduled", "तय भएको") : t("Not yet", "हुनेछैन") },
                    { label: t("Resolved", "समाधान"), detail: e.resolved_at ? displayBS(e.resolved_at) : undefined },
                  ]}
                />
                <div className="mt-2 flex gap-2">
                  {!e.conference_scheduled && (
                    <Button size="sm" variant="outline" onClick={() => scheduleConference.mutate(e.id)}>
                      {t("Schedule conference", "भेट तय")}
                    </Button>
                  )}
                  {e.status !== "resolved" && (
                    <Button size="sm" onClick={() => resolve.mutate({ id: e.id, resolution: "resolved" })}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("Resolve", "समाधान")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>

      <DataPanel
        title={t("Active cases", "सक्रिय मुद्दाहरू")}
        actions={
          <Button size="sm" variant="ghost" asChild>
            <Link href="/dashboard/incident-management/active">
              <FileText className="mr-1 h-3.5 w-3.5" />{t("Full page", "पूरा पृष्ठ")}
            </Link>
          </Button>
        }
      >
        {/* Same component the deep route renders — no second implementation. */}
        <ActiveCasesContent bare />
      </DataPanel>
    </div>
  );
}
