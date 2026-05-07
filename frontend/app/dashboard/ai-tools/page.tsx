"use client";

import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileQuestion, BookOpen, Calendar, MessageSquare, PenLine, Brain } from "lucide-react";
import Link from "next/link";

const AI_TOOLS = [
  { key: "question-paper", label: "AI Question Paper Generator", desc: "Generate exam papers with Bloom's taxonomy, chapter-wise balance", icon: FileQuestion, color: "bg-blue-500" },
  { key: "lesson-plan", label: "AI Lesson Plan", desc: "Generate structured lesson plans for any subject and grade", icon: BookOpen, color: "bg-green-500" },
  { key: "timetable", label: "AI Timetable Generator", desc: "Clash-free timetable in 30 seconds", icon: Calendar, color: "bg-purple-500" },
  { key: "report-remarks", label: "AI Report Remarks", desc: "Personalized report card comments per student", icon: MessageSquare, color: "bg-yellow-500" },
  { key: "letter-writer", label: "AI Letter Writer", desc: "Generate school letters, notices, and circulars", icon: PenLine, color: "bg-red-500" },
  { key: "insights", label: "AI School Insights", desc: "Weekly AI intelligence report on school performance", icon: Brain, color: "bg-indigo-500" },
];

export default function AIToolsPage() {
  return (
    <PluginGate slug="ai_tools">
      <AIToolsContent />
    </PluginGate>
  );
}

function AIToolsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Tools Hub</h1>
        <p className="text-muted-foreground">AI-powered tools to save hours of manual work</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AI_TOOLS.map((tool) => (
          <Link key={tool.key} href={`/dashboard/ai-tools/${tool.key}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`${tool.color} p-3 rounded-lg text-white shrink-0`}>
                  <tool.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{tool.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
                  <Badge variant="secondary" className="mt-2">AI Powered</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
