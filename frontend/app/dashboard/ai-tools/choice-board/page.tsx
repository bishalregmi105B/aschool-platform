"use client";
/** UDL Choice Board — POST /ai/generate/udl_choice_board (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Grid3X3, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface Cell { row: string; column: string; task: string }
interface Result { instructions?: string; cells: Cell[]; columns?: string[] }

export default function ChoiceBoardPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/udl_choice_board", { subject, grade, topic: topic || undefined })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Board ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  const columns = result?.columns || [];
  const rows = [...new Set((result?.cells || []).map((c) => c.row))];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Grid3X3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="UDL Choice Board"
        subtitle="3×3 boards: show it, express it, make it matter"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="space-y-4">
          <FormSection title="Scope">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Science" /></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 6" /></div>
              <div className="space-y-2"><Label>Topic (optional)</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Water cycle" /></div>
              <Button onClick={() => gen.mutate()} disabled={!subject || !grade || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Building…" : "Build board"}
              </Button>
            </div>
          </FormSection>
          {gen.isPending && <PageLoader />}
          {error && (
            <EmptyState title="Couldn't build the board" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
          )}
          {!gen.isPending && !error && !result && (
            <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Pick 3 tasks — one from each column.</p></div>
          )}
          {result && (
            <DataPanel title={result.instructions || "Choose any three, including one from each column"} bodyClassName="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2" />
                    {columns.map((c) => (
                      <th key={c} className="p-2 text-sm font-semibold border-b border-[color:var(--w11-border-subtle)] text-[color:var(--w11-text-secondary)]">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r}>
                      <td className="p-2 text-sm font-semibold whitespace-nowrap align-top text-[color:var(--w11-text-secondary)]">{r}</td>
                      {columns.map((c) => {
                        const cell = result.cells.find((x) => x.row === r && x.column === c);
                        return (
                          <td key={c} className="p-2 align-top">
                            <div className="h-full rounded-md border border-[color:var(--w11-border-subtle)] p-3 text-sm min-h-[80px]" style={{ background: "var(--w11-card-bg)" }}>{cell?.task || "—"}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataPanel>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
