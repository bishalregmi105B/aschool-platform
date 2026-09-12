"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Calendar, Clock, Users, Video, Plus } from "lucide-react";

import { BSDateInput } from "@/components/ui/bs-date-input";
interface Conference {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  start_date_bs?: string;
  end_date_bs?: string;
  is_virtual?: boolean;
  meeting_link?: string;
  is_active?: boolean;
}

function displayConferenceDate(bsDate?: string, adDate?: string) {
  return bsDate || adDate?.slice(0, 10) || "—";
}

export default function ConferencesPage() {
  return (
    <PluginGate slug="conferences">
      <ConferencesContent />
    </PluginGate>
  );
}

function ConferencesContent() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    mode: "in_person",
    meeting_link: "",
  });
  const queryClient = useQueryClient();

  const { data: conferences, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["conferences"],
    queryFn: async () => {
      const res = await api.get("/conferences");
      return (res.data.data || []) as Conference[];
    },
    retry: 1,
  });

  const createConference = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        is_virtual: form.mode === "online",
        meeting_link: form.mode === "online" ? (form.meeting_link || undefined) : undefined,
        is_active: true,
      };
      return api.post("/conferences", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      toast.success("Conference scheduled");
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        mode: "in_person",
        meeting_link: "",
      });
    },
    onError: () => toast.error("Failed to schedule conference"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading conferences…" />;

  if (isError)
    return (
      <AOSPage>
        <AOSPageHeader title="Parent-Teacher Conferences" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-12 text-center">
              <p className="mb-4" style={{ color: "#c42b1c" }}>Failed to load conferences.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );

  const list = conferences || [];

  const getStatus = (conference: Conference) => {
    const today = new Date().toISOString().split("T")[0];
    const start = conference.start_date?.slice(0, 10);
    const end = conference.end_date?.slice(0, 10);
    if (end && end < today) return "completed";
    if (start && start > today) return "scheduled";
    return "ongoing";
  };

  const filtered = search
    ? list.filter((c: Conference) =>
        c.title?.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Calendar className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Parent-Teacher Conferences"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "conference" : "conferences"} · ${filtered.filter((c: Conference) => getStatus(c) === "scheduled").length} upcoming`}
        actions={
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Schedule Conference</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Conference</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createConference.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Mid-Term Parent Teacher Meeting"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Purpose and guidance for parents"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <BSDateInput
                      value={form.start_date}
                      onChange={(v) => setForm({ ...form, start_date: v })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <BSDateInput
                      value={form.end_date}
                      onChange={(v) => setForm({ ...form, end_date: v })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.mode === "online" && (
                  <div className="space-y-2">
                    <Label>Meeting Link</Label>
                    <Input
                      value={form.meeting_link}
                      onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createConference.isPending || !form.title}>
                  {createConference.isPending ? "Saving..." : "Save Conference"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <AOSPageBody>
        <StatGrid>
          {[
            { label: "Upcoming", value: filtered.filter((c: Conference) => getStatus(c) === "scheduled").length, icon: <Calendar className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />, color: "var(--w11-accent)" },
            { label: "Completed", value: filtered.filter((c: Conference) => getStatus(c) === "completed").length, icon: <Users className="h-4 w-4" style={{ color: "#107c10" }} />, color: "#107c10" },
            { label: "Ongoing", value: filtered.filter((c: Conference) => getStatus(c) === "ongoing").length, icon: <Clock className="h-4 w-4" style={{ color: "#d83b01" }} />, color: "#d83b01" },
            { label: "Virtual", value: filtered.filter((c: Conference) => c.is_virtual).length, icon: <Video className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
          ].map((stat) => (
            <KpiCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} color={stat.color} />
          ))}
        </StatGrid>

        <FilterCommandBar>
          <div className="relative max-w-md">
            <Input placeholder="Search conferences..." className="w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </FilterCommandBar>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <DataPanel>
              <AOSEmptyState
                title="No conferences scheduled"
                description={'Click "Schedule Conference" to create one.'}
              />
            </DataPanel>
          ) : (
            filtered.map((conf: Conference) => (
              <div key={conf.id} className="win11-card hover:shadow-md transition-shadow">
                <div className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--w11-accent-light)" }}
                    >
                      <Calendar className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{conf.title || "PT Conference"}</h3>
                      <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{displayConferenceDate(conf.start_date_bs, conf.start_date)} to {displayConferenceDate(conf.end_date_bs, conf.end_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusChip
                      status={getStatus(conf) === "scheduled" ? "pending" : getStatus(conf) === "completed" ? "completed" : "active"}
                      label={getStatus(conf)}
                    />
                    <span className="win11-chip subtle">{conf.is_virtual ? "online" : "in-person"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
