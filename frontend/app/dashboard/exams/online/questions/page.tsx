"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { FileQuestion, Printer, Sparkles, Copy, Check } from "lucide-react";

export default function OnlineExamQuestionsPage() {
  return (
    // The generator endpoint (/design-studio/ai/question-paper) is gated by the
    // e-library plugin on the backend (canonical slug elibrary).
    <PluginGate slug="elibrary">
      <QuestionsContent />
    </PluginGate>
  );
}

function QuestionsContent() {
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Use the AI question paper generator endpoint
      const res = await api.post("/design-studio/ai/question-paper", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Question paper generated successfully!");
      setResult(data.data || data);
    },
    onError: () => toast.error("Failed to generate questions. Please ensure AI limits aren't exceeded."),
  });

  const handleCopy = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handlePrint = () => {
    const newWin = window.open("", "_blank");
    if (newWin && result?.html) {
      newWin.document.write(`
        <html>
          <head>
            <title>Exam Paper</title>
            <style>
              body { font-family: serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="no-print" style="margin-bottom: 20px; text-align: right;">
              <button id="print-btn" style="padding: 10px 20px;">Print Paper</button>
            </div>
            ${result.html}
          </body>
        </html>
      `);
      newWin.document.close();
      newWin.document.getElementById("print-btn")?.addEventListener("click", () => {
        newWin.focus();
        newWin.print();
      });
    } else {
      toast.error("HTML formatting not available for this output.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" /> AI Question Generator
          </h1>
          <p className="text-muted-foreground">Instantly generate exam papers and questions using AI</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Exam Parameters</CardTitle>
            <CardDescription>Configure the paper details</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                generateMutation.mutate({
                  subject: fd.get("subject"),
                  grade: Number(fd.get("grade")),
                  total_marks: Number(fd.get("total_marks")),
                  duration: Number(fd.get("duration")),
                  topics: fd.get("topics"),
                  difficulty: fd.get("difficulty"),
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input name="subject" required placeholder="e.g. Science, Mathematics" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grade / Class</Label>
                  <Input name="grade" type="number" required defaultValue="10" />
                </div>
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input name="total_marks" type="number" required defaultValue="100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (mins)</Label>
                  <Input name="duration" type="number" required defaultValue="180" />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select name="difficulty" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Specific Topics (Optional)</Label>
                <Input name="topics" placeholder="e.g. Thermodynamics, Optics" />
              </div>

              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Spinner size="sm" className="mr-2 text-white" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Paper
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg">Generated Output</CardTitle>
            {result && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy Text"}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={!result.html}>
                  <Printer className="h-4 w-4 mr-2" /> Print PDF
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {generateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-4">
                <Spinner size="lg" className="text-purple-600" />
                <p className="animate-pulse">AI is crafting the perfect questions...</p>
              </div>
            ) : result ? (
              <div className="p-6 h-[600px] overflow-y-auto bg-muted/10 font-serif">
                {result.html ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.html) }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{result.text || JSON.stringify(result, null, 2)}</pre>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground border-2 border-dashed m-6 rounded-lg bg-muted/30">
                <FileQuestion className="h-12 w-12 mb-4 opacity-30" />
                <p>Fill out the parameters and click Generate to see the AI output here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
