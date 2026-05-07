"use client";

/**
 * AIAssistPanel — asks the AI to generate text for the selected element
 * or the overall document. Routes through /design-studio/ai/suggest
 * which enforces per-school quota via AITokenHub.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge }    from "@/components/ui/badge";
import { Sparkles, Clipboard, ChevronRight } from "lucide-react";
import { toast }    from "sonner";

const DOC_TYPES = [
  "Certificate of Merit",
  "Transfer Certificate",
  "Character Certificate",
  "Admit Card",
  "School Notice",
  "Invitation Letter",
  "ID Card",
  "Report Card",
  "Letterhead",
  "Other Document",
];

const QUICK_PROMPTS = [
  "Write the header text for a merit certificate",
  "Write a formal transfer certificate body",
  "Generate a school achievement notice",
  "Write motivational text for a student certificate",
  "Generate an admission inquiry response letter",
];

interface Props { canvas: any; }

export default function AIAssistPanel({ canvas }: Props) {
  const [prompt,   setPrompt]   = useState("");
  const [docType,  setDocType]  = useState(DOC_TYPES[0]);
  const [result,   setResult]   = useState<string | null>(null);
  const [tokensUsed, setTokens] = useState<number | null>(null);

  const aiMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/design-studio/ai/suggest", {
        prompt,
        document_type: docType,
        context: {
          selected_element_type: canvas.selectedObject?.type ?? "none",
          selected_text: canvas.selectedObject?.text ?? "",
        },
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setResult(data?.content ?? "");
      setTokens(data?.tokens_used ?? null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "AI request failed";
      if (err?.response?.status === 429) {
        toast.error("AI quota exceeded. Contact your school admin.", { duration: 5000 });
      } else {
        toast.error(msg);
      }
    },
  });

  const applyToCanvas = () => {
    if (!result) return;
    const obj = canvas.selectedObject;
    if (obj && (obj.type === "textbox" || obj.type === "text" || obj.type === "i-text")) {
      obj.set({ text: result });
      obj.canvas?.renderAll();
      toast.success("Applied to selected text element");
    } else {
      canvas.addText(result, { fontSize: 16 });
      toast.success("Added as new text element");
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <p className="font-semibold text-sm">AI Content Generator</p>
      </div>

      <div>
        <Label className="text-xs">Document Type</Label>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">What should the AI write?</Label>
        <Textarea
          className="mt-1 text-xs min-h-[80px] resize-none"
          placeholder="e.g. Write formal certificate text for top scorer in Science..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Quick Prompts */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Quick prompts</Label>
        <div className="space-y-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-violet-50 hover:text-violet-700 flex items-center gap-1.5 transition-colors border border-transparent hover:border-violet-100"
              onClick={() => setPrompt(p)}
            >
              <ChevronRight className="h-3 w-3 shrink-0" /> {p}
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
        size="sm"
        onClick={() => aiMutation.mutate()}
        disabled={!prompt.trim() || aiMutation.isPending}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {aiMutation.isPending ? "Generating…" : "Generate Content"}
      </Button>

      {/* Result */}
      {result !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Generated Content</Label>
            {tokensUsed && (
              <Badge variant="secondary" className="text-xs">{tokensUsed} tokens</Badge>
            )}
          </div>
          <div className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {result}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={applyToCanvas}>
              Apply to Canvas
            </Button>
            <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={copyToClipboard}>
              <Clipboard className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2">
        Powered by Groq AI · Token usage tracked per school
      </p>
    </div>
  );
}
