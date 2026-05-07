"use client";

import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Plus, Play, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function OnlineExamPage() {
  return (
    <PluginGate slug="exams">
      <OnlineExamContent />
    </PluginGate>
  );
}

function OnlineExamContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Monitor className="h-6 w-6" /> Online Exams</h1>
          <p className="text-muted-foreground">Create and manage online examinations with auto-grading</p>
        </div>
        <Button asChild><Link href="/dashboard/exams"><Plus className="h-4 w-4 mr-2" /> Create Online Exam</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><Clock className="h-6 w-6 text-blue-600" /></div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Upcoming Exams</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><Play className="h-6 w-6 text-green-600" /></div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Active Exams</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="h-6 w-6 text-purple-600" /></div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Completed Exams</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Online Exams</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No online exams created yet</p>
            <p className="text-sm mt-1">Create your first online exam to get started with auto-grading</p>
            <Button className="mt-4" asChild><Link href="/dashboard/exams"><Plus className="h-4 w-4 mr-2" /> Create Online Exam</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
