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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, Pin, Calendar, Bell } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
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

  const { data: notices, isLoading: loadingNotices } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notice[]>>("/notices");
      return res.data.data || [];
    },
  });

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<EventItem[]>>("/notices/events");
      return res.data.data || [];
    },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notices & Events</h1>
          <p className="text-muted-foreground">Communicate with your school community</p>
        </div>
        <Button onClick={() => (tab === "notices" ? setShowAddNotice(true) : setShowAddEvent(true))}>
          <Plus className="h-4 w-4 mr-2" />
          Add {tab === "notices" ? "Notice" : "Event"}
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab("notices")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "notices" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="h-4 w-4" /> Notices
        </button>
        <button
          onClick={() => setTab("events")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "events" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-4 w-4" /> Events
        </button>
      </div>

      {tab === "notices" && (
        loadingNotices ? <PageLoader /> : (
          <div className="space-y-4">
            {(notices || []).length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No notices yet.
                </CardContent>
              </Card>
            )}
            {(notices || []).map((notice) => (
              <Card key={notice.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {notice.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
                      <CardTitle className="text-lg">{notice.title}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={notice.is_published ? "success" : "secondary"}>
                        {notice.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {notice.content}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    {notice.author_name && <span>By {notice.author_name}</span>}
                    <span>{displayBS(notice.created_at)}</span>
                    <div className="flex gap-1">
                      {notice.target_roles.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">
                          {r.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "events" && (
        loadingEvents ? <PageLoader /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(events || []).length === 0 && (
              <p className="col-span-3 text-center py-8 text-muted-foreground">
                No events yet.
              </p>
            )}
            {(events || []).map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    {event.is_holiday && <Badge variant="warning">Holiday</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {displayEventDate(event.start_date_bs, event.start_date)}
                    {event.end_date && event.end_date !== event.start_date && ` — ${displayEventDate(event.end_date_bs, event.end_date)}`}
                  </div>
                </CardContent>
              </Card>
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
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_pinned" name="is_pinned" className="rounded" />
              <Label htmlFor="is_pinned">Pin this notice</Label>
            </div>
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
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_holiday" name="is_holiday" className="rounded" />
              <Label htmlFor="is_holiday">Mark as holiday</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddEvent(false)}>Cancel</Button>
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? <Spinner size="sm" /> : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
