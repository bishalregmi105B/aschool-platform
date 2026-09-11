"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Flag, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  review: "secondary",
  failed: "destructive",
  registered: "outline",
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
          <p className="text-xs text-muted-foreground">
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
        <Badge variant={STATUS_VARIANT[s.ingest_status] ?? "secondary"}>{s.ingest_status}</Badge>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selected && (
            <Button variant="ghost" size="icon" aria-label="Back to sources" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> AI Content Review
            </h1>
            <p className="text-sm text-muted-foreground">
              Human gate over ingested textbooks and question papers — nothing reaches AI tools
              until it is reviewed and published.
            </p>
          </div>
        </div>
        {selected && detail && detail.ingest_status !== "published" && (
          <Button onClick={() => publish.mutate(selected.id)} disabled={publish.isPending}>
            <Send className="mr-1 h-4 w-4" /> Publish source
          </Button>
        )}
      </div>

      {!selected && (
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <PageLoader />
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
          </CardContent>
        </Card>
      )}

      {selected && detail && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selected.title_ne || selected.title_en} — units ({detail.units.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.units.map((u) => (
                <button
                  key={u.id}
                  className={`w-full rounded-md border p-2 text-left transition-colors hover:bg-muted ${openUnit?.id === u.id ? "border-primary" : ""}`}
                  onClick={() => setOpenUnit(openUnit?.id === u.id ? null : u)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {u.unit_no_ascii ? `${u.unit_no_ascii}. ` : ""}
                      {u.title_ne || u.title_en || u.unit_path}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      pp.{u.page_start}–{u.page_end} · {u.chunks.total} chunks
                      {u.chunks.flagged > 0 && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          {u.chunks.flagged} flagged
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.chunks.published}/{u.chunks.total} published
                    {u.align_method ? ` · aligned (${u.align_method})` : " · unaligned"}
                  </p>
                </button>
              ))}
              {detail.units.length === 0 && (
                <EmptyState size="sm" title="No units staged" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {openUnit ? `Chunks — ${openUnit.title_ne || openUnit.unit_path}` : "Chunk review"}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[520px] space-y-2 overflow-y-auto">
              {openUnit && (chunks ?? []).map((c) => (
                <div key={c.id} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground">
                        #{c.ordinal} · {c.kind} · page {c.page_no ?? "—"}
                        {c.bbox ? ` · bbox [${c.bbox.join(", ")}]` : ""}
                      </p>
                      <p className="mt-1 line-clamp-4 text-sm">{c.text_display}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Badge variant={c.qa_status === "passed" ? "default" : c.qa_status === "flagged" ? "destructive" : "secondary"}>
                        {c.qa_status}
                      </Badge>
                      <Button
                        size="sm" variant="ghost"
                        aria-label="Mark chunk as passed"
                        onClick={() => reviewChunk.mutate({ chunkId: c.id, action: "pass" })}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        aria-label="Flag chunk for fixing"
                        onClick={() => reviewChunk.mutate({ chunkId: c.id, action: "flag" })}
                      >
                        <Flag className="h-4 w-4 text-amber-600" />
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
