"use client";

/**
 * Writer research + AI panel — internet-connected research inside the editor.
 *
 * Two tabs:
 *  - AI: the same agent chat as the designer (mode="writer") executing
 *    document actions (insert at cursor, replace selection, bullet lists).
 *  - Research: Wikipedia search + any-URL page fetch through the backend
 *    (/design-studio/writer/research), with one-click citation insertion.
 *    Citations are numbered [n] in the doc and collected for a bibliography.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, ExternalLink, FileText, Plus, Quote, Search, Sparkles, X } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AIChatPanel } from "@/components/designer/AIChatPanel";

export interface WriterCitation {
  n: number;
  title: string;
  url: string;
}

export interface WriterSidePanelProps {
  onClose: () => void;
  /** TipTap editor actions */
  executeAgentAction: (action: Record<string, unknown>) => void;
  getAgentContext: () => Record<string, unknown>;
  /** insert "[n]" superscript marker at cursor */
  insertCitationMarker: (n: number) => void;
  /** append a full bibliography block at the cursor */
  insertBibliography: (citations: WriterCitation[]) => void;
  citations: WriterCitation[];
  addCitation: (c: Omit<WriterCitation, "n">) => number;
  insertQuote: (text: string, sourceUrl: string) => void;
}

type SearchResult = { title: string; url: string; snippet: string; source: string };
type PageResult = { title: string; url: string; text: string };

export function WriterSidePanel(props: WriterSidePanelProps) {
  const [tab, setTab] = useState<"research" | "ai">("research");
  return (
    <div className="h-full flex flex-col bg-background border-l">
      <div className="flex items-center gap-1 px-2 py-2 border-b shrink-0">
        <button
          onClick={() => setTab("research")}
          className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1 ${tab === "research" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Research
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1 ${tab === "ai" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Sparkles className="h-3.5 w-3.5" /> AI
        </button>
        <button onClick={props.onClose} className="ml-auto text-muted-foreground hover:text-foreground" title="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      {tab === "ai" ? (
        <div className="flex-1 min-h-0">
          <AIChatPanel
            mode="writer"
            executeAction={props.executeAgentAction}
            getContext={props.getAgentContext}
          />
        </div>
      ) : (
        <ResearchTab {...props} />
      )}
    </div>
  );
}

function ResearchTab({ insertCitationMarker, insertBibliography, citations, addCitation, insertQuote }: WriterSidePanelProps) {
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState<PageResult | null>(null);

  const search = useMutation({
    mutationFn: async () => {
      const r = await api.post("/design-studio/writer/research", { query });
      return r.data?.data as { results: SearchResult[] };
    },
    onSuccess: (d) => { setResults(d.results || []); setPage(null); },
    onError: () => toast.error("Search failed — check the network"),
  });

  const fetchPage = useMutation({
    mutationFn: async (target: string) => {
      const r = await api.post("/design-studio/writer/research", { url: target });
      return r.data?.data as PageResult;
    },
    onSuccess: (d) => { setPage(d); },
    onError: () => toast.error("Could not fetch that page"),
  });

  const cite = (title: string, targetUrl: string) => {
    const n = addCitation({ title, url: targetUrl });
    insertCitationMarker(n);
    toast.success(`Citation [${n}] inserted`);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-3 space-y-2 shrink-0">
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (query.trim()) search.mutate(); }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the web…" className="h-8 text-xs" />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={search.isPending}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (url.trim()) fetchPage.mutate(url.trim()); }}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste any URL" className="h-8 text-xs" />
          <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={fetchPage.isPending}>
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {/* current fetched page */}
        {page && (
          <div className="border rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-start gap-1.5">
              <span className="text-xs font-semibold leading-snug flex-1">{page.title}</span>
              <a href={page.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" title="Open source">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">{page.text.slice(0, 600)}…</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                onClick={() => cite(page.title, page.url)}>
                <Quote className="h-3 w-3" /> Cite
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1"
                onClick={() => insertQuote(page.text.slice(0, 400), page.url)}>
                <Plus className="h-3 w-3" /> Insert excerpt
              </Button>
            </div>
          </div>
        )}

        {/* search hits */}
        {results.map((r) => (
          <div key={r.url} className="border rounded-lg p-2.5 space-y-1">
            <div className="flex items-start gap-1.5">
              <button className="text-xs font-medium leading-snug text-left flex-1 hover:underline" onClick={() => fetchPage.mutate(r.url)}>
                {r.title}
              </button>
              <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{r.snippet}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => cite(r.title, r.url)}>
                <Quote className="h-3 w-3" /> Cite [source]
              </Button>
              <span className="text-[10px] text-muted-foreground">{r.source}</span>
            </div>
          </div>
        ))}

        {search.isPending && <p className="text-[11px] text-muted-foreground">Searching…</p>}
        {fetchPage.isPending && <p className="text-[11px] text-muted-foreground">Fetching page…</p>}

        {/* collected citations */}
        {citations.length > 0 && (
          <div className="border rounded-lg p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold">References in this document</p>
            {citations.map((c) => (
              <div key={c.n} className="text-[11px] text-muted-foreground flex gap-1.5">
                <span className="font-mono text-foreground">[{c.n}]</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline truncate">{c.title}</a>
              </div>
            ))}
            <Button size="sm" variant="outline" className="h-7 text-[11px]"
              onClick={() => insertBibliography(citations)}>
              Insert bibliography
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
