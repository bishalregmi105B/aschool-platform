"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Flag, Send, ChevronRight, Layers as LayersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
} from "@/components/aos/kit/page-kit";

// Quick links — the AI surfaces that consume what this gate publishes.
const QUICK_LINKS = [
  { label: "AI Tools Hub", icon: "Sparkles", href: "/dashboard/ai-tools" },
  { label: "AI Workbench", icon: "Layers", href: "/dashboard/ai-workbench" },
  { label: "Teaching Content", icon: "BookOpen", href: "/dashboard/teaching-content" },
];

interface ContentSource {
  id: string;
  kind: string;
  grade: string | null;
  subject_code: string | null;
  title_en: string | null;
  title_ne: string | null;
  medium: string;
  edition_bs: string | null;
  ingest_status: string;
  page_count: number | null;
  manifest: Record<string, unknown> | null;
  unit_count: number;
}

interface UnitRow {
  id: string;
  unit_path: string;
  unit_no_ascii: number | null;
  title_ne: string | null;
  title_en: string | null;
  page_start: number | null;
  page_end: number | null;
  align_method: string | null;
  is_published: boolean;
  chunks: { total: number; published: number; flagged: number };
}

interface ChunkRow {
  id: string;
  ordinal: number;
  kind: string;
  language: string;
  text_display: string;
  page_no: number | null;
  bbox: number[] | null;
  qa_status: string;
  is_published: boolean;
}

const STATUS_TONE: Record<string, string> = {
  published: "success",
  review: "warning",
  failed: "error",
  registered: "",
};

export default function ContentReviewPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ContentSource | null>(null);
  const [openUnit, setOpenUnit] = useState<UnitRow | null>(null);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["content-sources"],
    queryFn: async () => {
      const resp = await api.get("/content/sources?per_page=100");
      return (resp.data.data ?? []) as ContentSource[];
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["content-source", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const resp = await api.get(`/content/sources/${selected!.id}`);
      return resp.data.data as { units: UnitRow[]; ingest_status: string; manifest: Record<string, unknown> };
    },
  });

  const { data: chunks } = useQuery({
    queryKey: ["content-chunks", selected?.id, openUnit?.id],
    enabled: Boolean(selected && openUnit),
    queryFn: async () => {
      const resp = await api.get(
        `/content/sources/${selected!.id}/chunks?unit_id=${openUnit!.id}&per_page=200`
      );
      return (resp.data.data ?? []) as ChunkRow[];
    },
  });

  const reviewChunk = useMutation({
    mutationFn: async ({ chunkId, action }: { chunkId: string; action: string }) => {
      const resp = await api.patch(`/content/chunks/${chunkId}`, { action });
      return resp.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-chunks"] });
      qc.invalidateQueries({ queryKey: ["content-source"] });
    },
    onError: () => toast.error("Review action failed"),
  });

  const publish = useMutation({
    mutationFn: async (sourceId: string) => {
      const resp = await api.post(`/content/sources/${sourceId}/publish`, {});
      return resp.data;
    },
    onSuccess: () => {
      toast.success("Source published — AI tools can now ground on it");
      qc.invalidateQueries({ queryKey: ["content-sources"] });
      qc.invalidateQueries({ queryKey: ["content-source"] });
    },
    onError: () => toast.error("Publish failed"),
  });

  const columns: Column<ContentSource>[] = [
    {
      key: "title", label: "Source", value: (s) => s.title_ne || s.title_en || s.id,
      render: (s) => (
        <div>
          <p className="font-medium">{s.title_ne || s.title_en || s.id.slice(0, 8)}</p>
          <p className="text-xs text-[color:var(--w11-text-secondary)]">
            {[s.kind, s.grade ? `Grade ${s.grade}` : null, s.medium, s.edition_bs].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    { key: "units", label: "Units", align: "right", value: (s) => s.unit_count },
    { key: "pages", label: "Pages", align: "right", value: (s) => s.page_count ?? 0 },
    {
      key: "status", label: "Status",
      render: (s) => (
        <StatusChip status={s.ingest_status === "published" ? "published" : s.ingest_status} />
      ),
    },
    {
      key: "actions", label: "",
      render: (s) => (
        <Button size="sm" variant="outline" onClick={() => { setSelected(s); setOpenUnit(null); }}>
          Review
        </Button>
      ),
    },
  ];

  // KPIs — client-computed counts over the sources list this page loads.
  const sourceList = sources ?? [];
  const kpis = [
    { label: "Sources", value: sourceList.length, color: "var(--w11-accent)", icon: <BookOpen className="h-4 w-4" style={{ color: "var(--w11-accent)" }} /> },
    { label: "Published", value: sourceList.filter((s) => s.ingest_status === "published").length, color: "#107c10", icon: <CheckCircle2 className="h-4 w-4" style={{ color: "#107c10" }} /> },
    { label: "Awaiting Review", value: sourceList.filter((s) => s.ingest_status !== "published").length, color: "#d83b01", icon: <Flag className="h-4 w-4" style={{ color: "#d83b01" }} /> },
    { label: "Units Staged", value: sourceList.reduce((a, s) => a + (s.unit_count || 0), 0), color: "var(--w11-text-primary)", icon: <LayersIcon className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
    { label: "Pages Ingested", value: sourceList.reduce((a, s) => a + (s.page_count || 0), 0), color: "var(--w11-text-primary)", icon: <Send className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="AI Content Review"
        subtitle="Human gate over ingested textbooks and question papers — nothing reaches AI tools until it is reviewed and published."
        actions={
          <>
            {selected && (
              <Button variant="outline" size="sm" aria-label="Back to sources" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selected && detail && detail.ingest_status !== "published" && (
              <Button onClick={() => publish.mutate(selected.id)} disabled={publish.isPending}>
                <Send className="mr-1 h-4 w-4" /> Publish source
              </Button>
            )}
          </>
        }
      />
      <AOSPageBody>
        {!selected && (
          <>
            {/* Dashboard — KPI stat grid */}
            <StatGrid>
              {kpis.map((k) => (
                <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} icon={k.icon} />
              ))}
            </StatGrid>

            {/* Quick links — 44px gradient icon tile + label, as next/link */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
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
                          background: SECTION_GRADIENTS.Insights,
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

            <DataPanel bodyClassName="p-0 pt-0">
              {isLoading ? (
                <div className="p-4"><PageLoader /></div>
              ) : (
                <DataTable
                  columns={columns}
                  rows={sources ?? []}
                  rowKey={(s) => s.id}
                  empty={{
                    icon: BookOpen,
                    title: "Nothing ingested yet",
                    body: "Run the content loader on a staged book folder to see it here.",
                  }}
                />
              )}
            </DataPanel>
          </>
        )}

        {selected && detail && (
          <div className="grid gap-4 lg:grid-cols-2">
            <DataPanel
              title={`${selected.title_ne || selected.title_en} — units (${detail.units.length})`}
              bodyClassName="space-y-2"
            >
              {detail.units.map((u) => (
                <button
                  key={u.id}
                  className={`w-full rounded-md border p-2 text-left transition-colors ${openUnit?.id === u.id ? "win11-card interactive" : ""}`}
                  style={{
                    borderColor: openUnit?.id === u.id ? "var(--w11-accent)" : "var(--w11-border-subtle)",
                    background: "var(--w11-card-bg)",
                  }}
                  onClick={() => setOpenUnit(openUnit?.id === u.id ? null : u)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {u.unit_no_ascii ? `${u.unit_no_ascii}. ` : ""}
                      {u.title_ne || u.title_en || u.unit_path}
                    </span>
                    <span className="text-xs text-[color:var(--w11-text-secondary)]">
                      pp.{u.page_start}–{u.page_end} · {u.chunks.total} chunks
                      {u.chunks.flagged > 0 && (
                        <span className="win11-chip error ml-2 text-[10px]">
                          {u.chunks.flagged} flagged
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--w11-text-secondary)]">
                    {u.chunks.published}/{u.chunks.total} published
                    {u.align_method ? ` · aligned (${u.align_method})` : " · unaligned"}
                  </p>
                </button>
              ))}
              {detail.units.length === 0 && (
                <EmptyState size="sm" title="No units staged" />
              )}
            </DataPanel>

            <DataPanel
              title={openUnit ? `Chunks — ${openUnit.title_ne || openUnit.unit_path}` : "Chunk review"}
              bodyClassName="max-h-[520px] space-y-2 overflow-y-auto"
            >
              {openUnit && (chunks ?? []).map((c) => (
                <div key={c.id} className="rounded-md border border-[color:var(--w11-border-subtle)] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
                        #{c.ordinal} · {c.kind} · page {c.page_no ?? "—"}
                        {c.bbox ? ` · bbox [${c.bbox.join(", ")}]` : ""}
                      </p>
                      <p className="mt-1 line-clamp-4 text-sm">{c.text_display}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 items-end">
                      <StatusChip
                        status={c.qa_status === "passed" ? "completed" : c.qa_status === "flagged" ? "failed" : "pending"}
                        label={c.qa_status}
                      />
                      <Button
                        size="sm" variant="ghost"
                        aria-label="Mark chunk as passed"
                        onClick={() => reviewChunk.mutate({ chunkId: c.id, action: "pass" })}
                      >
                        <CheckCircle2 className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        aria-label="Flag chunk for fixing"
                        onClick={() => reviewChunk.mutate({ chunkId: c.id, action: "flag" })}
                      >
                        <Flag className="h-4 w-4" style={{ color: "#9d5d00" }} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {openUnit && chunks && chunks.length === 0 && (
                <EmptyState size="sm" title="No chunks in this unit" />
              )}
              {!openUnit && (
                <EmptyState
                  size="sm"
                  title="Pick a unit"
                  body="Select a unit on the left to review its chunks against the printed page."
                />
              )}
            </DataPanel>
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
