"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Pin, Calendar, Bell, Megaphone, Send, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

interface Notice {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_published: boolean;
  target_roles: string[];
  created_at: string;
  author_name?: string;
}

interface EventItem {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  start_date_bs?: string;
  end_date_bs?: string;
  is_holiday: boolean;
}

function displayEventDate(bsDate?: string, adDate?: string) {
  return bsDate || adDate || "—";
}

export default function NoticesPage() {
  return (
    <PluginGate slug="notices">
      <NoticesContent />
    </PluginGate>
  );
}

function NoticesContent() {
  const [tab, setTab] = useState<"notices" | "events">("notices");
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const queryClient = useQueryClient();

  const { data: notices, isLoading: loadingNotices, isError: errorNotices, refetch: refetchNotices } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notice[]>>("/notices");
      return res.data.data || [];
    },
    retry: 1,
  });

  const { data: events, isLoading: loadingEvents, isError: errorEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<EventItem[]>>("/notices/events");
      return res.data.data || [];
    },
    retry: 1,
  });

  const createNoticeMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/notices", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice created");
      setShowAddNotice(false);
    },
    onError: () => toast.error("Failed to create notice"),
  });

  const createEventMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/notices/events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created");
      setShowAddEvent(false);
    },
    onError: () => toast.error("Failed to create event"),
  });

  // KPIs — client-computed counts from the lists this page already loads.
  const noticeList = notices || [];
  const eventList = events || [];
  const kpis = [
    { label: "Total Notices", value: noticeList.length, icon: <Bell className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />, color: "var(--w11-accent)" },
    { label: "Published", value: noticeList.filter((n) => n.is_published).length, icon: <Megaphone className="h-4 w-4" style={{ color: "#107c10" }} />, color: "#107c10" },
    { label: "Pinned", value: noticeList.filter((n) => n.is_pinned).length, icon: <Pin className="h-4 w-4" style={{ color: "#9d5d00" }} />, color: "#9d5d00" },
    { label: "Events", value: eventList.length, icon: <Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />, color: "var(--w11-accent)" },
    { label: "Holidays", value: eventList.filter((e) => e.is_holiday).length, icon: <Calendar className="h-4 w-4" style={{ color: "#d83b01" }} />, color: "#d83b01" },
  ];

  // Quick links — the module has no manifest subitems, so link the sibling
  // Communication surfaces a notice author reaches for next.
  const QUICK_LINKS = [
    { label: "Communications Hub", icon: "MessageSquare", href: "/dashboard/communications" },
    { label: "Announcements", icon: "Megaphone", href: "/dashboard/communications/announcements" },
    { label: "Broadcast", icon: "Send", href: "/dashboard/communications/broadcast" },
    { label: "SMS", icon: "MessageSquare", href: "/dashboard/sms" },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bell className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Notices & Events"
        subtitle="Communicate with your school community"
        actions={
          <Button onClick={() => (tab === "notices" ? setShowAddNotice(true) : setShowAddEvent(true))}>
            <Plus className="h-4 w-4 mr-2" />
            Add {tab === "notices" ? "Notice" : "Event"}
          </Button>
        }
      />
      <AOSPageBody>
        {/* Dashboard — KPI stat grid */}
        <StatGrid>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} icon={k.icon} />
          ))}
        </StatGrid>

        {/* Quick links — 44px gradient icon tile + label, as next/link */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {QUICK_LINKS.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Communication,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {l.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div
          className="flex gap-1 p-1 rounded-lg w-fit mb-4"
          style={{ background: "var(--w11-control-bg)" }}
        >
          <button
            onClick={() => setTab("notices")}
            className={`win11-tab ${tab === "notices" ? "active" : ""} flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium`}
            style={tab !== "notices" ? { color: "var(--w11-text-secondary)" } : undefined}
          >
            <Bell className="h-4 w-4" /> Notices
          </button>
          <button
            onClick={() => setTab("events")}
            className={`win11-tab ${tab === "events" ? "active" : ""} flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium`}
            style={tab !== "events" ? { color: "var(--w11-text-secondary)" } : undefined}
          >
            <Calendar className="h-4 w-4" /> Events
          </button>
        </div>

        {tab === "notices" && (
          loadingNotices ? <PageLoader /> : errorNotices ? (
            <DataPanel className="max-w-2xl mx-auto">
              <div className="p-4 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load notices. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetchNotices()}>Retry</Button>
              </div>
            </DataPanel>
          ) : (
            <div className="space-y-4">
              {(notices || []).length === 0 && (
                <DataPanel>
                  <div className="p-4 text-center text-[color:var(--w11-text-secondary)]">
                    No notices yet.
                  </div>
                </DataPanel>
              )}
              {(notices || []).map((notice) => (
                <div key={notice.id} className="win11-card" style={{ marginBottom: 0 }}>
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[color:var(--w11-border-subtle)]">
                    <div className="flex items-center gap-2">
                      {notice.is_pinned && <Pin className="h-4 w-4" style={{ color: "#9d5d00" }} />}
                      <h3 className="text-lg font-semibold text-[color:var(--w11-text-primary)]">{notice.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      <StatusChip status={notice.is_published ? "published" : "pending"} label={notice.is_published ? "Published" : "Draft"} />
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap text-[color:var(--w11-text-secondary)]">
                      {notice.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-[color:var(--w11-text-secondary)]">
                      {notice.author_name && <span>By {notice.author_name}</span>}
                      <span>{displayBS(notice.created_at)}</span>
                      <div className="flex gap-1">
                        {notice.target_roles.map((r) => (
                          <span key={r} className="win11-chip text-xs">
                            {r.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "events" && (
          loadingEvents ? <PageLoader /> : errorEvents ? (
            <DataPanel className="max-w-2xl mx-auto">
              <div className="p-4 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load events. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetchEvents()}>Retry</Button>
              </div>
            </DataPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(events || []).length === 0 && (
                <p className="col-span-3 text-center py-8 text-[color:var(--w11-text-secondary)]">
                  No events yet.
                </p>
              )}
              {(events || []).map((event) => (
                <div key={event.id} className="win11-card" style={{ marginBottom: 0 }}>
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-[color:var(--w11-text-primary)]">{event.title}</h3>
                    {event.is_holiday && <StatusChip status="on_leave" label="Holiday" />}
                  </div>
                  {event.description && (
                    <p className="text-sm mt-2 mb-3 text-[color:var(--w11-text-secondary)]">{event.description}</p>
                  )}
                  <div className="text-xs text-[color:var(--w11-text-secondary)]">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {displayEventDate(event.start_date_bs, event.start_date)}
                    {event.end_date && event.end_date !== event.start_date && ` — ${displayEventDate(event.end_date_bs, event.end_date)}`}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Add Notice Dialog */}
        <Dialog open={showAddNotice} onOpenChange={setShowAddNotice}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Notice</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createNoticeMutation.mutate({
                  title: fd.get("title"),
                  content: fd.get("content"),
                  is_published: true,
                  is_pinned: fd.get("is_pinned") === "on",
                  target_roles: ["school_admin", "teacher", "parent", "student"],
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea name="content" required rows={5} />
              </div>
              <FormCheckbox id="is_pinned" name="is_pinned" label="Pin this notice" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddNotice(false)}>Cancel</Button>
                <Button type="submit" disabled={createNoticeMutation.isPending}>
                  {createNoticeMutation.isPending ? <Spinner size="sm" /> : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Event Dialog */}
        <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createEventMutation.mutate({
                  title: fd.get("title"),
                  description: fd.get("description") || undefined,
                  start_date: fd.get("start_date"),
                  end_date: fd.get("end_date") || undefined,
                  is_holiday: fd.get("is_holiday") === "on",
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <BSDateInput name="start_date" required />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <BSDateInput name="end_date" />
                </div>
              </div>
              <FormCheckbox id="is_holiday" name="is_holiday" label="Mark as holiday" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddEvent(false)}>Cancel</Button>
                <Button type="submit" disabled={createEventMutation.isPending}>
                  {createEventMutation.isPending ? <Spinner size="sm" /> : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
