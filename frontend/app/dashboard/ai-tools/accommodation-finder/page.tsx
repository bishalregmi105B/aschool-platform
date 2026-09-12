"use client";
/** Accommodation Finder — POST /ai/generate/accommodation_finder (wave-2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Accessibility, ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FormSection,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface Accommodation { barrier: string; accommodation: string; category?: string }
interface Result { summary?: string; accommodations: Accommodation[] }

export default function AccommodationFinderPage() {
  return <PluginGate slug="ai_suite"><Content /></PluginGate>;
}

function Content() {
  const [barrier, setBarrier] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/generate/accommodation_finder", { barrier_description: barrier })).data?.data as Result,
    onSuccess: (d) => { setResult(d); setError(null); toast.success("Suggestions ready"); },
    onError: (e: unknown) => setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Generation failed"),
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Accessibility className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Accommodation Finder"
        subtitle="Adjust the environment, not the child — never a diagnosis"
        actions={
          <Link href="/dashboard/ai-tools">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All AI Tools</Button>
          </Link>
        }
      />
      <AOSPageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormSection title="Describe the barrier">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What makes the task hard? (behaviour, not labels)</Label>
                <Textarea rows={6} value={barrier} onChange={(e) => setBarrier(e.target.value)}
                  placeholder="e.g. Los place in long dictations; copies from the board very slowly; understands everything when discussing aloud" />
              </div>
              <Button className="w-full" onClick={() => gen.mutate()} disabled={!barrier.trim() || gen.isPending}>
                <Sparkles className="h-4 w-4 mr-2" /> {gen.isPending ? "Thinking…" : "Suggest accommodations"}
              </Button>
            </div>
          </FormSection>
          <DataPanel title="Suggestions">
            {gen.isPending ? <PageLoader /> : error ? (
              <EmptyState title="Couldn't suggest accommodations" body={error} action={{ label: "Try again", onClick: () => gen.mutate() }} />
            ) : !result ? (
              <div className="text-center py-16 text-[color:var(--w11-text-secondary)]"><Accessibility className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Describe the barrier — get practical classroom adjustments.</p></div>
            ) : (
              <div className="space-y-3">
                {result.accommodations?.map((a, i) => (
                  <div key={i} className="rounded-md border border-[color:var(--w11-border-subtle)] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold capitalize text-[color:var(--w11-text-secondary)]">{(a.category || "support").replace(/_/g, " ")}</p>
                    </div>
                    <p className="text-sm mt-1 text-[color:var(--w11-text-primary)]"><span className="font-medium">Barrier:</span> {a.barrier}</p>
                    <p className="text-sm text-[color:var(--w11-text-primary)]"><span className="font-medium">Try:</span> {a.accommodation}</p>
                  </div>
                ))}
                {result.summary && (
                  <div className="win11-infobar warning flex gap-1.5 p-3 text-xs">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {result.summary}
                  </div>
                )}
              </div>
            )}
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
