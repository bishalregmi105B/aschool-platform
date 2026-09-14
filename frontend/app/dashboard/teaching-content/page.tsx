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
  FilterCommandBar,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

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
  const { t } = useI18n();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TeachingSection | null>(null);
  const [search, setSearch] = useState("");
  // Wave C (plan spec): card grid + subject/grade/kind filters as URL state —
  // filters are parsed from the section code (SCI.G10.U2.S3) so they work
  // with the payload the list endpoint actually returns.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const subjectFilter = routeParams.get("subject") || "";
  const gradeFilter = routeParams.get("grade") || "";
  const kindFilter = routeParams.get("kind") || "";
  const setRouteFilter = (patch: Record<string, string>) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/teaching-content";
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };

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

  const all = sections ?? [];
  const codeSubject = (c: string) => c.split(".")[0] || "";
  const codeGrade = (c: string) => c.match(/\.G(\d+)/i)?.[1] ?? "";
  const subjects = Array.from(new Set(all.map((x) => codeSubject(x.code)).filter(Boolean))).sort();
  const grades = Array.from(new Set(all.map((x) => codeGrade(x.code)).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
  const needle = search.trim().toLowerCase();
  const shown = all.filter((x) =>
    (!subjectFilter || codeSubject(x.code) === subjectFilter) &&
    (!gradeFilter || codeGrade(x.code) === gradeFilter) &&
    (!kindFilter || x.kind === kindFilter) &&
    (!needle || `${x.title_en} ${x.title_ne ?? ""} ${x.code}`.toLowerCase().includes(needle))
  );
  const isFiltered = !!subjectFilter || !!gradeFilter || !!kindFilter || !!needle;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Chapter Content", "पाठ्य सामग्री")}
        subtitle={`${shown.length}/${all.length} ${t("sections", "सेक्सन")} · ${t("Bilingual teaching sections — versioned, reviewable, publishable", "द्विभाषी शैक्षिक सामग्री — संस्करणित, समीक्षित, प्रकाशित")}`}
        actions={
          <>
            <Link href="/dashboard/academics">
              <Button variant="outline" size="sm" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("New section", "नयाँ सेक्सन")}
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

        <FilterCommandBar>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search sections…", "सेक्सन खोज्नुहोस्…")}
            className="w-full md:w-64 h-9"
          />
          <AdvancedSelect className="w-32" triggerClassName="h-8 text-xs" value={subjectFilter} onChange={(v) => setRouteFilter({ subject: v || "" })} clearable placeholder={t("All subjects", "सबै विषय")}
            options={subjects.map((x) => ({ value: x, label: x }))}
          />
          <AdvancedSelect className="w-28" triggerClassName="h-8 text-xs" value={gradeFilter} onChange={(v) => setRouteFilter({ grade: v || "" })} clearable placeholder={t("All grades", "सबै कक्षा")}
            options={grades.map((g) => ({ value: g, label: `Grade ${g}` }))}
          />
          <AdvancedSelect className="w-32" triggerClassName="h-8 text-xs" value={kindFilter} onChange={(v) => setRouteFilter({ kind: v || "" })} clearable placeholder={t("All kinds", "सबै प्रकार")}
            options={KINDS.map((k) => ({ value: k, label: k }))}
          />
          {isFiltered && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setRouteFilter({ subject: "", grade: "", kind: "" }); }}>
              {t("Clear", "खाली")}
            </Button>
          )}
        </FilterCommandBar>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
        ) : shown.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<BookOpen className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
              title={isFiltered && all.length > 0
                ? t("No sections match these filters", "यी फिल्टरसँग मिल्ने सेक्सन भेटिएन")
                : t("No teaching sections yet", "अझै कुनै पाठ्य सामग्री छैन")}
              description={isFiltered && all.length > 0
                ? t("Adjust or clear the filters.", "फिल्टर मिलाउनुहोस् वा खाली गर्नुहोस्।")
                : t("Create the first section for a curriculum unit.", "पाठ्यक्रम एकाइको पहिलो सेक्सन बनाउनुहोस्।")}
              action={isFiltered && all.length > 0
                ? { label: t("Clear filters", "फिल्टर हटाउनुहोस्"), onClick: () => { setSearch(""); setRouteFilter({ subject: "", grade: "", kind: "" }); } }
                : { label: t("New section", "नयाँ सेक्सन"), onClick: () => setIsCreateOpen(true) }}
            />
          </DataPanel>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((x) => (
              <div key={x.id} className="win11-card" style={{ marginBottom: 0 }}>
                <div className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{x.title_en}</p>
                    {x.published_version_no
                      ? <StatusChip status="published" label={`v${x.published_version_no}`} />
                      : <StatusChip status="pending" label="draft" />}
                  </div>
                  {x.title_ne && <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>{x.title_ne}</p>}
                  <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--w11-text-tertiary)" }}>{x.code}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="win11-chip subtle text-[10px]">{x.kind}</span>
                    {x.difficulty && <span className="win11-chip subtle text-[10px]">{x.difficulty}</span>}
                    {x.estimated_minutes ? <span className="win11-chip subtle text-[10px]">{x.estimated_minutes} min</span> : null}
                  </div>
                  {x.summary_en && <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--w11-text-secondary)" }}>{x.summary_en}</p>}
                  <div className="mt-auto pt-3">
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setSelected(x)}>
                      {t("Versions", "संस्करणहरू")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
