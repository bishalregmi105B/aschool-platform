"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { DateTimeField } from "@/components/ui/datetime-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { PaginationMeta } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { undoableDelete } from "@/components/ui/confirm-dialog";
import { useUrlFilters, useDebounced } from "@/components/ui/filter-bar";
import { SimpleSelect } from "@/components/ui/advanced-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Bell,
  Calendar,
  Megaphone,
  Pin,
  Send,
  Trash2,
  ChevronDown,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { displayBS } from "@/lib/nepali_date";

import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  StatusChip,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface Notice {
  id: string;
  title: string;
  title_nepali?: string | null;
  content: string;
  notice_type: string;
  is_pinned: boolean;
  is_published: boolean;
  target_roles: string[];
  created_at: string;
  author_name?: string;
}

interface EventItem {
  id: string;
  title: string;
  title_nepali?: string | null;
  description?: string;
  event_type?: string;
  start_date: string;
  end_date?: string;
  start_date_bs?: string;
  end_date_bs?: string;
  location?: string;
  is_holiday?: boolean;
}

interface ClassRow {
  id: string;
  name: string;
  name_nepali?: string | null;
  sections?: { id: string; name: string }[];
}

/**
 * Notices & Events — A1 registry with Tabs (plan 34-9, 16.1).
 *
 * The create dialog gained real audience targeting: role chips + a
 * "also notify parents" switch post to `target_roles` (the API maps it to
 * Notice.target_audience), and a class/section MultiSelect posts a
 * best-effort `target_class_ids` array. The column exists on the model but
 * `_populate_notice` does not read it yet, so the picker is honest: it
 * shows a "requires backend update" infobar instead of silently pretending
 * the scoping applied. Channel fan-out text routes to the Notification
 * Matrix (A-02), which owns per-channel rules.
 */

const ROLE_OPTIONS: { value: string; en: string; ne: string }[] = [
  { value: "school_admin", en: "Admins", ne: "प्रशासन" },
  { value: "teacher", en: "Teachers", ne: "शिक्षक" },
  { value: "student", en: "Students", ne: "विद्यार्थी" },
];

const TYPE_OPTIONS = [
  { value: "general", en: "General", ne: "साधारण" },
  { value: "academic", en: "Academic", ne: "शैक्षिक" },
  { value: "event", en: "Event", ne: "कार्यक्रम" },
  { value: "holiday", en: "Holiday", ne: "बिदा" },
  { value: "urgent", en: "Urgent", ne: "अत्यावश्यक" },
];

interface Pagination extends PaginationMeta {}

export default function NoticesPage() {
  return (
    <AppGate slug="notices">
      <NoticesContent />
    </AppGate>
  );
}

function emptyNoticeForm() {
  return {
    title: "",
    title_nepali: "",
    content: "",
    content_nepali: "",
    notice_type: "general",
    roles: ["school_admin", "teacher", "student"] as string[],
    notify_parents: true,
    class_ids: [] as string[],
    is_pinned: false,
    is_published: true,
    publish_at: "",
    expires_at: "",
  };
}

function NoticesContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { values, setValues } = useUrlFilters(["tab", "type", "status"]);
  const tab = values.tab === "events" ? "events" : "notices";
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);

  const [noticeDialog, setNoticeDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [form, setForm] = useState(emptyNoticeForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    title_nepali: "",
    description: "",
    start_date: "",
    end_date: "",
    location: "",
    is_holiday: false,
  });
  const [page, setPage] = useState(1);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(new Set());

  const { data: noticePage, isLoading, isError, refetch } = useQuery({
    queryKey: ["notices", page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notice[]>>("/notices", {
        params: { page, per_page: 25 },
      });
      return {
        rows: res.data.data || [],
        pagination: res.data.meta?.pagination as Pagination | undefined,
      };
    },
    retry: 1,
  });

  const { data: events, isLoading: loadingEvents, isError: errorEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<EventItem[]>>("/notices/events", {
        params: { per_page: 200 },
      });
      return res.data.data || [];
    },
    retry: 1,
  });

  // Class options for the audience picker — same endpoint the roster pages use.
  const { data: classes } = useQuery({
    queryKey: ["academics-classes-options"],
    queryFn: async () => {
      const res = await api.get("/academics/classes", { params: { per_page: 200 } });
      return (res.data?.data || []) as ClassRow[];
    },
    staleTime: 5 * 60_000,
  });
  const classOptions = useMemo(
    () =>
      (classes || []).map((c) => ({
        value: c.id,
        label: c.name,
        ne: c.name_nepali || undefined,
        hint: (c.sections || []).map((s) => s.name).join(", "),
      })),
    [classes]
  );

  const createNotice = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/notices", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success(t("Notice published", "सूचना प्रकाशित भयो"));
      setNoticeDialog(false);
      setForm(emptyNoticeForm());
    },
    onError: () => toast.error(t("Failed to create notice", "सूचना बनाउन असफल")),
  });

  const createEvent = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post("/notices/events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("Event created", "कार्यक्रम बन्यो"));
      setEventDialog(false);
    },
    onError: () => toast.error(t("Failed to create event", "कार्यक्रम बनाउन असफल")),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.put(`/notices/${id}`, { is_published: published }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
    onError: () => toast.error(t("Update failed", "अपडेट असफल")),
  });

  const deleteNotice = async (n: Notice) => {
    undoableDelete({
      label: t(`notice "${n.title}"`, `सूचना "${n.title}"`),
      optimistic: () => setHiddenIds((p) => new Set(p).add(n.id)),
      rollback: () => setHiddenIds((p) => {
        const next = new Set(p);
        next.delete(n.id);
        return next;
      }),
      commit: async () => {
        await api.delete(`/notices/${n.id}`);
        queryClient.invalidateQueries({ queryKey: ["notices"] });
      },
    });
  };

  const deleteEvent = (e: EventItem) => {
    undoableDelete({
      label: t(`event "${e.title}"`, `कार्यक्रम "${e.title}"`),
      optimistic: () => setHiddenEventIds((p) => new Set(p).add(e.id)),
      rollback: () => setHiddenEventIds((p) => {
        const next = new Set(p);
        next.delete(e.id);
        return next;
      }),
      commit: async () => {
        await api.delete(`/notices/events/${e.id}`);
        queryClient.invalidateQueries({ queryKey: ["events"] });
      },
    });
  };

  const allNotices = (noticePage?.rows || []).filter((n) => !hiddenIds.has(n.id));
  const notices = allNotices.filter((n) => {
    if (values.type && n.notice_type !== values.type) return false;
    if (values.status === "published" && !n.is_published) return false;
    if (values.status === "draft" && n.is_published) return false;
    if (dq && !`${n.title} ${n.content}`.toLowerCase().includes(dq.toLowerCase())) return false;
    return true;
  });
  const allEvents = (events || []).filter((e) => !hiddenEventIds.has(e.id));

  const draftCount = allNotices.filter((n) => !n.is_published).length;

  const submitNotice = (e: React.FormEvent) => {
    e.preventDefault();
    const roles = [...form.roles];
    if (form.notify_parents && !roles.includes("parent")) roles.push("parent");
    createNotice.mutate({
      title: form.title,
      title_nepali: form.title_nepali || undefined,
      content: form.content,
      content_nepali: form.content_nepali || undefined,
      notice_type: form.notice_type,
      is_pinned: form.is_pinned,
      is_published: form.is_published,
      target_roles: roles,
      publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
      // Best-effort until _populate_notice reads it (see report flag).
      ...(form.class_ids.length ? { target_class_ids: form.class_ids } : {}),
    });
  };

  const noticeColumns: Column<Notice>[] = [
    {
      key: "title",
      label: t("Title", "शीर्षक"),
      render: (n) => (
        <div className="flex items-center gap-2 min-w-0">
          {n.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0" style={{ color: "#9d5d00" }} />}
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: "var(--w11-text-primary)" }}>
              {t(n.title, n.title_nepali || n.title)}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--w11-text-secondary)" }}>
              {n.content.replace(/<[^>]*>/g, "").slice(0, 90)}
            </p>
          </div>
        </div>
      ),
      value: (n) => n.title,
    },
    {
      key: "notice_type",
      label: t("Type", "प्रकार"),
      width: 110,
      render: (n) => {
        const opt = TYPE_OPTIONS.find((o) => o.value === n.notice_type);
        return <span className="win11-chip">{opt ? t(opt.en, opt.ne) : n.notice_type || "—"}</span>;
      },
      value: (n) => n.notice_type || "",
    },
    {
      key: "target_roles",
      label: t("Audience", "श्रोता"),
      render: (n) => (
        <div className="flex flex-wrap gap-1">
          {(n.target_roles || []).length === 0 ? (
            <span style={{ color: "var(--w11-text-tertiary)" }}>—</span>
          ) : (
            (n.target_roles || []).map((r) => (
              <span key={r} className="win11-chip subtle text-[10px]">
                {r.replace("_", " ")}
              </span>
            ))
          )}
        </div>
      ),
      value: (n) => (n.target_roles || []).join(" "),
    },
    {
      key: "is_published",
      label: t("Status", "स्थिति"),
      width: 110,
      render: (n) => (
        <StatusChip
          status={n.is_published ? "published" : "pending"}
          label={n.is_published ? t("Published", "प्रकाशित") : t("Draft", "ड्राफ्ट")}
        />
      ),
      value: (n) => (n.is_published ? "published" : "draft"),
    },
    {
      key: "created_at",
      label: t("Date", "मिति"),
      width: 120,
      render: (n) => (
        <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {displayBS(n.created_at)}
        </span>
      ),
      value: (n) => n.created_at,
    },
    {
      key: "actions",
      label: "",
      width: 150,
      noExport: true,
      render: (n) => (
        <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => togglePublish.mutate({ id: n.id, published: !n.is_published })}
          >
            {n.is_published ? t("Unpublish", "अप्रकाशित") : t("Publish", "प्रकाशित")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#c42b1c]"
            aria-label={t("Delete notice", "सूचना मेटाउनुहोस्")}
            onClick={() => deleteNotice(n)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const eventColumns: Column<EventItem>[] = [
    {
      key: "title",
      label: t("Title", "शीर्षक"),
      render: (e) => (
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium">{t(e.title, e.title_nepali || e.title)}</p>
          {e.is_holiday && <StatusChip status="on_leave" label={t("Holiday", "बिदा")} />}
        </div>
      ),
      value: (e) => e.title,
    },
    {
      key: "dates",
      label: t("Date (BS)", "मिति (बि.सं.)"),
      width: 200,
      render: (e) => (
        <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {e.start_date_bs || e.start_date}
          {e.end_date && e.end_date !== e.start_date ? ` — ${e.end_date_bs || e.end_date}` : ""}
        </span>
      ),
      value: (e) => e.start_date,
    },
    {
      key: "location",
      label: t("Location", "स्थान"),
      width: 160,
      render: (e) => <span className="text-[12px]">{e.location || "—"}</span>,
      value: (e) => e.location || "",
    },
    {
      key: "actions",
      label: "",
      width: 60,
      noExport: true,
      render: (e) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#c42b1c]"
          aria-label={t("Delete event", "कार्यक्रम मेटाउनुहोस्")}
          onClick={() => deleteEvent(e)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Notices & Events", "सूचना तथा कार्यक्रम")}
        subtitle={t(
          "Publish to the right audience — one notice, every channel",
          "सही श्रोतालाई सूचना — एक सूचना, सबै माध्यम"
        )}
        actions={
          <Button
            onClick={() =>
              tab === "notices" ? setNoticeDialog(true) : setEventDialog(true)
            }
          >
            <Send className="h-4 w-4 mr-2" />
            {tab === "notices" ? t("New Notice", "नयाँ सूचना") : t("New Event", "नयाँ कार्यक्रम")}
          </Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard
            label={t("Total Notices", "कुल सूचना")}
            value={noticePage?.pagination?.total ?? allNotices.length}
            icon={<Bell className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Published", "प्रकाशित")}
            value={allNotices.filter((n) => n.is_published).length}
            color="#107c10"
            icon={<Megaphone className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("Drafts", "ड्राफ्ट")}
            value={draftCount}
            color="#9d5d00"
            icon={<Pin className="h-4 w-4" style={{ color: "#9d5d00" }} />}
          />
          <KpiCard
            label={t("Events", "कार्यक्रम")}
            value={allEvents.length}
            icon={<Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
        </StatGrid>

        <Tabs
          value={tab}
          onValueChange={(v) => setValues({ tab: v })}
        >
          <TabsList>
            <TabsTrigger value="notices">
              <Bell className="h-3.5 w-3.5 mr-1.5" /> {t("Notices", "सूचना")}
            </TabsTrigger>
            <TabsTrigger value="events">
              <Calendar className="h-3.5 w-3.5 mr-1.5" /> {t("Events", "कार्यक्रम")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notices">
            <div className="flex flex-wrap items-center gap-2 mt-3 mb-2">
              <div className="win11-searchbox w-[220px]">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("Search notices…", "सूचना खोज्नुहोस्…")}
                  className="h-8 border-transparent bg-transparent px-3 text-[12px] focus-visible:ring-0"
                />
              </div>
              <SimpleSelect
                className="h-8 text-[12px] w-[150px]"
                value={values.type}
                onChange={(v) => setValues({ type: v })}
                options={[
                  { value: "", label: t("All types", "सबै प्रकार") },
                  ...TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.en, o.ne) })),
                ]}
              />
              <SimpleSelect
                className="h-8 text-[12px] w-[150px]"
                value={values.status}
                onChange={(v) => setValues({ status: v })}
                options={[
                  { value: "", label: t("All statuses", "सबै स्थिति") },
                  { value: "published", label: t("Published", "प्रकाशित") },
                  { value: "draft", label: t("Drafts", "ड्राफ्ट") },
                ]}
              />
            </div>
            <DataPanel>
              <DataTable
                columns={noticeColumns}
                rows={notices}
                rowKey={(n) => n.id}
                loading={isLoading}
                error={isError ? t("Failed to load notices", "सूचना लोड गर्न असफल") : null}
                onRetry={() => refetch()}
                pagination={noticePage?.pagination}
                onPageChange={setPage}
                exportFileName="notices"
                empty={
                  dq || values.type || values.status ? (
                    {
                      icon: Bell,
                      title: t("No notices match the filters", "फिल्टरसँग मिल्ने सूचना छैन"),
                      body: t("Clear the search or filters to see all notices.", "सबै सूचना हेर्न खोज/फिल्टर हटाउनुहोस्।"),
                      action: {
                        label: t("Clear filters", "फिल्टर हटाउनुहोस्"),
                        onClick: () => {
                          setQ("");
                          setValues({ type: "", status: "" });
                        },
                      },
                    }
                  ) : (
                    {
                      icon: Bell,
                      title: t("No notices yet", "अझै सूचना छैन"),
                      body: t("Publish your first notice — it reaches every audience and channel.", "पहिलो सूचना प्रकाशित गर्नुहोस् — यो सबै श्रोता र माध्यममा पुग्छ।"),
                      action: {
                        label: t("New Notice", "नयाँ सूचना"),
                        onClick: () => setNoticeDialog(true),
                      },
                    }
                  )
                }
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="events">
            <div className="mt-3">
              {loadingEvents ? (
                <DataPanel>
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-10 rounded animate-pulse" style={{ background: "var(--w11-control-hover)" }} />
                    ))}
                  </div>
                </DataPanel>
              ) : errorEvents ? (
                <DataPanel>
                  <ErrorState
                    title={t("Failed to load events", "कार्यक्रम लोड गर्न असफल")}
                    onRetry={() => refetchEvents()}
                  />
                </DataPanel>
              ) : (
                <DataPanel>
                  <DataTable
                    columns={eventColumns}
                    rows={allEvents}
                    rowKey={(e) => e.id}
                    exportFileName="events"
                    empty={{
                      icon: Calendar,
                      title: t("No events yet", "अझै कार्यक्रम छैन"),
                      body: t("Add holidays, exams and school programs to the calendar.", "पात्रोमा बिदा, परीक्षा र कार्यक्रम थप्नुहोस्।"),
                      action: {
                        label: t("New Event", "नयाँ कार्यक्रम"),
                        onClick: () => setEventDialog(true),
                      },
                    }}
                  />
                </DataPanel>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Create Notice dialog (16.1) ── */}
        <Dialog open={noticeDialog} onOpenChange={setNoticeDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("New Notice", "नयाँ सूचना")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitNotice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="n-title">{t("Title", "शीर्षक")}</Label>
                  <Input
                    id="n-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-title-ne">{t("Title (Nepali)", "शीर्षक (नेपाली)")}</Label>
                  <Input
                    id="n-title-ne"
                    value={form.title_nepali}
                    onChange={(e) => setForm({ ...form, title_nepali: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="n-content">{t("Message", "सन्देश")}</Label>
                <Textarea
                  id="n-content"
                  required
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("Who should see it?", "कसले हेर्ने?")}</Label>
                  <SimpleSelect
                    className="h-7 text-[12px] w-[130px]"
                    value={form.notice_type}
                    onChange={(v) => setForm({ ...form, notice_type: v })}
                    options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.en, o.ne) }))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ROLE_OPTIONS.map((r) => {
                    const on = form.roles.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setForm({
                            ...form,
                            roles: on ? form.roles.filter((x) => x !== r.value) : [...form.roles, r.value],
                          })
                        }
                        className={`win11-chip ${on ? "accent" : ""}`}
                        style={{ cursor: "pointer" }}
                      >
                        {t(r.en, r.ne)}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-2 ml-2">
                    <Switch
                      id="n-parents"
                      checked={form.notify_parents}
                      onCheckedChange={(v) => setForm({ ...form, notify_parents: v })}
                    />
                    <Label htmlFor="n-parents" className="text-[12px] font-normal">
                      {t("Also notify parents", "अभिभावकलाई पनि सूचित गर्नुहोस्")}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("Classes (optional)", "कक्षा (वैकल्पिक)")}</Label>
                <MultiSelect
                  value={form.class_ids}
                  onChange={(v) => setForm({ ...form, class_ids: v })}
                  options={classOptions}
                  placeholder={t("All classes", "सबै कक्षा")}
                  nePlaceholder={t("All classes", "सबै कक्षा")}
                  maxTokens={4}
                />
                <div
                  role="note"
                  className="win11-infobar warning flex items-start gap-2 text-[11px]"
                  style={{ padding: "6px 10px" }}
                >
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {t(
                      "Requires backend update — the notice API does not persist class targeting yet, so the notice reaches the whole audience above. Selections are sent as target_class_ids for when it ships.",
                      "ब्याकएन्ड अद्यावधिक आवश्यक — सूचना API ले अहिले कक्षा-लक्ष्यीकरण सुरक्षित गर्दैन, त्यसैले सूचाले माथिका सबै श्रोतालाई छोप्छ।"
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="n-pin"
                    checked={form.is_pinned}
                    onCheckedChange={(v) => setForm({ ...form, is_pinned: v })}
                  />
                  <Label htmlFor="n-pin" className="text-[12px] font-normal">{t("Pin to top", "माथि पिन गर्नुहोस्")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="n-publish"
                    checked={form.is_published}
                    onCheckedChange={(v) => setForm({ ...form, is_published: v })}
                  />
                  <Label htmlFor="n-publish" className="text-[12px] font-normal">{t("Publish now", "अहिले प्रकाशित गर्नुहोस्")}</Label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex items-center gap-1 text-[12px] font-medium"
                style={{ color: "var(--w11-accent)" }}
                aria-expanded={showAdvanced}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                {t("Advanced", "उन्नत")}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label htmlFor="n-content-ne">{t("Message (Nepali)", "सन्देश (नेपाली)")}</Label>
                    <Textarea
                      id="n-content-ne"
                      rows={3}
                      value={form.content_nepali}
                      onChange={(e) => setForm({ ...form, content_nepali: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Publish at", "प्रकाशन समय")}</Label>
                    <DateTimeField
                      value={form.publish_at}
                      onChange={(v) => setForm({ ...form, publish_at: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Expires at", "म्याद समाप्ति")}</Label>
                    <DateTimeField
                      value={form.expires_at}
                      onChange={(v) => setForm({ ...form, expires_at: v })}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                {t("Channel fan-out (SMS / email / WhatsApp / push) follows the", "माध्यम विस्तार (SMS / इमेल / WhatsApp / पुश) ले अनुसरण गर्छ:")}{" "}
                <Link
                  href="/dashboard/notifications/matrix"
                  className="underline"
                  style={{ color: "var(--w11-accent)" }}
                >
                  {t("Notification Matrix", "सूचना म्याट्रिक्स")}
                </Link>
                .
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNoticeDialog(false)}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={createNotice.isPending}>
                  {createNotice.isPending ? <Spinner size="sm" /> : t("Publish Notice", "सूचना प्रकाशित")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Create Event dialog ── */}
        <Dialog open={eventDialog} onOpenChange={setEventDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("New Event", "नयाँ कार्यक्रम")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createEvent.mutate({
                  title: eventForm.title,
                  title_nepali: eventForm.title_nepali || undefined,
                  description: eventForm.description || undefined,
                  start_date: eventForm.start_date,
                  end_date: eventForm.end_date || undefined,
                  location: eventForm.location || undefined,
                  is_holiday: eventForm.is_holiday,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-title">{t("Title", "शीर्षक")}</Label>
                  <Input
                    id="e-title"
                    required
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-title-ne">{t("Title (Nepali)", "शीर्षक (नेपाली)")}</Label>
                  <Input
                    id="e-title-ne"
                    value={eventForm.title_nepali}
                    onChange={(e) => setEventForm({ ...eventForm, title_nepali: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-start">{t("Start Date", "सुरु मिति")}</Label>
                  <Input
                    id="e-start"
                    type="date"
                    required
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-end">{t("End Date", "अन्त्य मिति")}</Label>
                  <Input
                    id="e-end"
                    type="date"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-loc">{t("Location", "स्थान")}</Label>
                <Input
                  id="e-loc"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-desc">{t("Description", "विवरण")}</Label>
                <Textarea
                  id="e-desc"
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="e-holiday"
                  checked={eventForm.is_holiday}
                  onCheckedChange={(v) => setEventForm({ ...eventForm, is_holiday: v })}
                />
                <Label htmlFor="e-holiday" className="text-[12px] font-normal">
                  {t("School closed on this day (holiday)", "यस दिन विद्यालय बन्द (बिदा)")}
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEventDialog(false)}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={createEvent.isPending}>
                  {createEvent.isPending ? <Spinner size="sm" /> : t("Create Event", "कार्यक्रम बनाउनुहोस्")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
