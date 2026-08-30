"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Megaphone, Plus, Trash2, Pin, Eye } from "lucide-react";
import Link from "next/link";

interface Notice {
  id: string;
  title: string;
  content: string;
  notice_type: string;
  target_audience: string[];
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
}

const AUDIENCES = ["all", "students", "teachers", "parents", "staff"];

export default function AnnouncementsPage() {
  return (
    <PluginGate slug="notices">
      <AnnouncementsContent />
    </PluginGate>
  );
}

function AnnouncementsContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    // E127: notice_type is a Postgres enum (general|academic|event|holiday|
    // urgent) — the old hardcoded "announcement" 500ed on every publish.
    title: "", content: "", notice_type: "general",
    target_audience: ["all"], is_pinned: false,
  });

  const { data: announcements, isLoading, isError, refetch } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      // E127: no type filter — "announcement" is not a valid notice_type
      // enum value (general|academic|event|holiday|urgent); fetching all
      // notices keeps this view honest instead of 500ing server-side.
      const res = await api.get<ApiResponse<unknown>>("/notices");
      const raw = res.data.data;
      if (Array.isArray(raw)) return raw as Notice[];
      if (raw && typeof raw === "object" && "data" in (raw as object)) {
        return ((raw as { data: Notice[] }).data) ?? [];
      }
      return [] as Notice[];
    },
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/notices", { ...form, published_at: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement published");
      setShowDialog(false);
      setForm({ title: "", content: "", notice_type: "general", target_audience: ["all"], is_pinned: false });
    },
    onError: () => toast.error("Failed to publish announcement"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement deleted");
    },
  });

  const toggleAudience = (aud: string) => {
    setForm((p) => ({
      ...p,
      target_audience: p.target_audience.includes(aud)
        ? p.target_audience.filter((a) => a !== aud)
        : [...p.target_audience, aud],
    }));
  };

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load announcements. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Announcements
          </h1>
          <p className="text-muted-foreground">Broadcast announcements to your school community</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/notices">All Notices</Link>
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: announcements?.length ?? 0 },
          { label: "Pinned", value: announcements?.filter((a) => a.is_pinned).length ?? 0 },
          { label: "Published", value: announcements?.filter((a) => a.published_at).length ?? 0 },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!announcements?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No announcements yet. Create one to notify your school community.
                  </TableCell>
                </TableRow>
              ) : (
                announcements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        <span className="font-medium text-sm">{a.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.content}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(a.target_audience ?? []).map((aud) => (
                          <Badge key={aud} variant="secondary" className="text-xs capitalize">{aud}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.published_at ? "default" : "secondary"}>
                        {a.published_at ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href="/dashboard/notices"><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Announcement title..."
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Announcement details..."
                rows={4}
              />
            </div>
            <div>
              <Label className="mb-2 block">Target Audience</Label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((aud) => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => toggleAudience(aud)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                      form.target_audience.includes(aud)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {aud === "all" ? "Everyone" : aud}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_pinned"
                checked={form.is_pinned}
                onChange={(e) => setForm((p) => ({ ...p, is_pinned: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_pinned">Pin this announcement</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
