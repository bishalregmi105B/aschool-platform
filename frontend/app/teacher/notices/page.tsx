"use client";

/**
 * Teacher → Notices (scoped, 44.1).
 *
 * The admin hub (school-wide KPIs + tab strip + delete controls — DELETE
 * /notices is school_admin-only) was being re-exported whole. Teachers can
 * CREATE and EDIT notices (POST/PUT /notices allow the teacher role, server-
 * enforced), so this page shows the school feed with a compact composer;
 * own notices can be edited, others are read-only. No fake delete affordance.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Pin, Pencil, Plus } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import { DataPanel, StatusChip } from "@/components/aos/kit/page-kit";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Notice = {
  id: string;
  title: string;
  title_nepali?: string | null;
  content?: string;
  notice_type?: string | null;
  target_roles: string[];
  is_pinned: boolean;
  is_published: boolean;
  published_at?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  created_at?: string | null;
};

const AUDIENCES = [
  { value: "parent", label: "Parents" },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
];

export default function TeacherNoticesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [composer, setComposer] = useState<Notice | "new" | null>(null);

  const list = useQuery({
    queryKey: ["teacher-notices"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Notice[] | { items?: Notice[] }>>("/notices?per_page=50");
      const p = res.data.data;
      return Array.isArray(p) ? p : p?.items || [];
    },
  });

  const notices = list.data || [];
  const mine = notices.filter((n) => user && n.author_id === user.id).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>Notices</h1>
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {notices.length} in the school feed · {mine} authored by you
          </p>
        </div>
        <Button className="h-11" onClick={() => setComposer("new")}>
          <Plus className="mr-1 h-4 w-4" /> New notice
        </Button>
      </div>

      <DataPanel>
        {list.isLoading ? (
          <SkeletonList rows={5} />
        ) : list.isError ? (
          <ErrorState title="Couldn't load notices" onRetry={() => list.refetch()} />
        ) : notices.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notices yet"
            body="Publish the first one — parents and students see it instantly."
            action={{ label: "New notice", onClick: () => setComposer("new") }}
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--w11-border-subtle)" }}>
            {notices.map((n) => {
              const editable = Boolean(user && n.author_id === user.id);
              return (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  {n.is_pinned ? (
                    <Pin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w11-accent)]" />
                  ) : (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--w11-border-strong)" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm" style={{ color: "var(--w11-text-primary)" }}>{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                      {(n.content || "").replace(/<[^>]+>/g, " ").slice(0, 160)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
                      <span>{n.author_name || "School"}</span>
                      {n.created_at && <span>· {displayBS(n.created_at.slice(0, 10))}</span>}
                      {(n.target_roles || []).map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px] capitalize">{r}s</Badge>
                      ))}
                      {!n.is_published && <StatusChip status="pending" label="Draft" />}
                    </div>
                  </div>
                  {editable && (
                    <Button size="sm" variant="ghost" aria-label={`Edit ${n.title}`} onClick={() => setComposer(n)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DataPanel>

      <ComposerDialog
        target={composer}
        onClose={() => setComposer(null)}
        onSaved={() => {
          setComposer(null);
          qc.invalidateQueries({ queryKey: ["teacher-notices"] });
          qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
        }}
      />
    </div>
  );
}

function ComposerDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Notice | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = target && target !== "new" ? target : null;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [titleNe, setTitleNe] = useState(editing?.title_nepali ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [audiences, setAudiences] = useState<string[]>(editing?.target_roles?.length ? editing.target_roles : ["parent", "student"]);
  const [pinned, setPinned] = useState(Boolean(editing?.is_pinned));
  // Reset form when the dialog target changes (open new vs edit).
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = editing ? `edit-${editing.id}` : target === "new" ? "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key === "new") {
      setTitle("");
      setTitleNe("");
      setContent("");
      setAudiences(["parent", "student"]);
      setPinned(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        title_nepali: titleNe.trim() || undefined,
        content,
        target_roles: audiences,
        is_pinned: pinned,
        is_published: true,
      };
      if (editing) return (await api.put(`/notices/${editing.id}`, body)).data;
      return (await api.post("/notices", body)).data;
    },
    onSuccess: () => {
      toast.success(editing ? "Notice updated." : "Notice published.");
      onSaved();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Couldn't save the notice.");
    },
  });

  const valid = title.trim().length > 2 && content.trim().length > 3 && audiences.length > 0;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit notice" : "New notice"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="n-title">Title (English) *</Label>
            <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="e.g. Half-yearly exam datesheet" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-title-ne">शीर्षक (Nepali)</Label>
            <Input id="n-title-ne" value={titleNe} onChange={(e) => setTitleNe(e.target.value)} className="h-11" placeholder="विद्यार्थी र अभिभावकको ध्यानमा" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-content">Message *</Label>
            <Textarea id="n-content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the notice — class + section filtering happens by audience." />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold" style={{ color: "var(--w11-text-secondary)" }}>Audience *</legend>
            <div className="flex flex-wrap gap-4">
              {AUDIENCES.map((a) => (
                <label key={a.value} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <Checkbox
                    checked={audiences.includes(a.value)}
                    onCheckedChange={(c) =>
                      setAudiences((prev) => (c ? [...prev, a.value] : prev.filter((x) => x !== a.value)))
                    }
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <Checkbox checked={pinned} onCheckedChange={(c) => setPinned(c === true)} />
            Pin to top
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Update notice" : "Publish notice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
