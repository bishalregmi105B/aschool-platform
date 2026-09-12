"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, BookOpen, ClipboardCheck, Layers, PenTool, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { api } from "@/lib/api";
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

interface TeachingSection {
  id: string;
  unit_id: string;
  section_no: number;
  code: string;
  kind: string;
  title_en: string;
  title_ne?: string | null;
  summary_en?: string | null;
  estimated_minutes?: number;
  difficulty?: string;
  is_active: boolean;
  published_version_no?: number | null;
}

interface CurriculumUnit {
  id: string;
  title_en: string;
  grade?: string;
  subject_code?: string;
}

interface VersionRow {
  version_no: number;
  status: string;
  change_note?: string | null;
}

const KINDS = ["concept", "derivation", "procedure", "experiment", "reading", "revision"];
const DIFFICULTIES = ["foundation", "core", "stretch"];

export default function TeachingContentPage() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TeachingSection | null>(null);

  const { data: sections, isLoading } = useQuery({
    queryKey: ["teaching-sections"],
    queryFn: async () => {
      const resp = await api.get("/teaching-content/sections?per_page=100");
      return (resp.data.data ?? []) as TeachingSection[];
    },
  });

  const { data: units } = useQuery({
    queryKey: ["curriculum-units"],
    queryFn: async () => {
      const resp = await api.get("/academics/curriculum/frameworks");
      const frameworks = (resp.data.data ?? []) as { id: string }[];
      const first = frameworks[0];
      if (!first) return [] as CurriculumUnit[];
      const detail = await api.get(`/academics/curriculum/frameworks/${first.id}`);
      return ((detail.data.data?.units ?? []) as CurriculumUnit[]);
    },
  });

  const { data: versions } = useQuery({
    queryKey: ["teaching-versions", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const resp = await api.get(`/teaching-content/sections/${selected!.id}/versions`);
      return (resp.data.data ?? []) as VersionRow[];
    },
  });

  const createSection = useMutation({
    mutationFn: async (form: Record<string, string>) => {
      const resp = await api.post("/teaching-content/sections", form);
      return resp.data;
    },
    onSuccess: () => {
      toast.success("Section created with an initial draft");
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["teaching-sections"] });
    },
    onError: (e: unknown) => {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || "Could not create section");
    },
  });

  const versionAction = useMutation({
    mutationFn: async ({ versionNo, action }: { versionNo: number; action: string }) => {
      const resp = await api.post(
        `/teaching-content/sections/${selected!.id}/versions/${versionNo}/${action}`
      );
      return resp.data;
    },
    onSuccess: () => {
      toast.success("Version updated");
      qc.invalidateQueries({ queryKey: ["teaching-versions", selected?.id] });
      qc.invalidateQueries({ queryKey: ["teaching-sections"] });
    },
    onError: (e: unknown) => {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || "Action failed");
    },
  });

  const columns: Column<TeachingSection>[] = [
    { key: "no", label: "#", sortable: true, value: (s) => s.section_no },
    {
      key: "title", label: "Title", sortable: true, value: (s) => s.title_en,
      render: (s) => (
        <div>
          <p className="font-medium">{s.title_en}</p>
          {s.title_ne && <p className="text-xs text-[color:var(--w11-text-secondary)]">{s.title_ne}</p>}
        </div>
      ),
    },
    { key: "code", label: "Code", value: (s) => s.code, render: (s) => <span className="text-[color:var(--w11-text-secondary)] text-xs">{s.code}</span> },
    { key: "kind", label: "Kind", value: (s) => s.kind, render: (s) => <span className="win11-chip text-xs">{s.kind}</span> },
    {
      key: "status", label: "Published", value: (s) => s.published_version_no ?? 0,
      render: (s) =>
        s.published_version_no ? (
          <StatusChip status="published" label={`v${s.published_version_no}`} />
        ) : (
          <StatusChip status="pending" label="draft" />
        ),
    },
    {
      key: "actions", label: "",
      render: (s) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(s)}>
          Versions
        </Button>
      ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Chapter Content"
        subtitle="Bilingual teaching sections — versioned, reviewable, publishable"
        actions={
          <>
            <Link href="/dashboard/academics">
              <Button variant="outline" size="sm" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New section
            </Button>
          </>
        }
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real counts from the data this page already loads */}
        <StatGrid>
          <KpiCard
            label="Sections"
            value={sections?.length ?? "—"}
            icon={<BookOpen className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Published"
            value={sections ? sections.filter((s) => s.published_version_no).length : "—"}
            color="#107c10"
            icon={<ClipboardCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Drafts"
            value={sections ? sections.filter((s) => !s.published_version_no).length : "—"}
            color="#d83b01"
            icon={<PenTool className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
          <KpiCard
            label="Curriculum Units"
            value={units?.length ?? "—"}
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

        <DataPanel bodyClassName="p-0 pt-0">
          {isLoading ? (
            <PageLoader />
          ) : (
            <DataTable
              columns={columns}
              rows={sections ?? []}
              rowKey={(s) => s.id}
              empty={{
                icon: BookOpen,
                title: "No teaching sections yet",
                body: "Create the first section for a curriculum unit.",
              }}
            />
          )}
        </DataPanel>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New teaching section</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createSection.mutate(Object.fromEntries(fd.entries()) as unknown as Record<string, string>);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="unit_id">Curriculum unit</Label>
              <Select name="unit_id" required>
                <SelectTrigger><SelectValue placeholder="Pick a unit" /></SelectTrigger>
                <SelectContent>
                  {(units ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.subject_code ? `${u.subject_code} · ` : ""}
                      {u.title_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="section_no">Section no</Label>
                <Input id="section_no" name="section_no" type="number" min={1} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="SCI.G10.U2.S3" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="title_en">Title (EN)</Label>
              <Input id="title_en" name="title_en" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="title_ne">Title (NE)</Label>
              <Input id="title_ne" name="title_ne" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="kind">Kind</Label>
                <Select name="kind" defaultValue="concept">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select name="difficulty" defaultValue="core">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createSection.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title_en} — versions</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(versions ?? []).map((v) => (
              <div key={v.version_no} className="flex items-center justify-between rounded-md border border-[color:var(--w11-border-subtle)] p-2">
                <div>
                  <p className="text-sm font-medium">v{v.version_no} · {v.status}</p>
                  {v.change_note && (
                    <p className="text-xs text-[color:var(--w11-text-secondary)]">{v.change_note}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {v.status === "draft" && (
                    <Button
                      size="sm" variant="outline"
                      disabled={versionAction.isPending}
                      onClick={() => versionAction.mutate({ versionNo: v.version_no, action: "submit" })}
                    >
                      Submit
                    </Button>
                  )}
                  {v.status === "in_review" && (
                    <Button
                      size="sm"
                      disabled={versionAction.isPending}
                      onClick={() => versionAction.mutate({ versionNo: v.version_no, action: "publish" })}
                    >
                      Publish
                    </Button>
                  )}
                  {v.status === "published" && (
                    <Button
                      size="sm" variant="outline"
                      disabled={versionAction.isPending}
                      onClick={() => versionAction.mutate({ versionNo: v.version_no, action: "archive" })}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {versions && versions.length === 0 && (
              <p className="text-sm text-[color:var(--w11-text-secondary)]">No versions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
