"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { Search, Download, BookOpen } from "lucide-react";

export default function PastPapersPage() {
  return <PluginGate slug="elibrary"><PastPapersContent /></PluginGate>;
}

function PastPapersContent() {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["past-papers", search, subject, classFilter],
    queryFn: async () => { const r = await api.get("/elibrary/past-papers", { params: { search: search || undefined, subject: subject || undefined, class_name: classFilter || undefined } }); return r.data?.data ?? r.data; },
  });

  const papers: any[] = Array.isArray(data) ? data : data?.items ?? [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><BookOpen className="h-6 w-6 text-blue-600" /><div><h1 className="text-2xl font-bold">Past Papers</h1><p className="text-muted-foreground">Previous exam papers and answer sheets</p></div></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search papers..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Subjects</SelectItem>
            <SelectItem value="Mathematics">Mathematics</SelectItem>
            <SelectItem value="Science">Science</SelectItem>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Nepali">Nepali</SelectItem>
            <SelectItem value="Social">Social Studies</SelectItem>
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Classes</SelectItem>
            {["1","2","3","4","5","6","7","8","9","10","11","12"].map((c) => <SelectItem key={c} value={`Class ${c}`}>Class {c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead>Year</TableHead><TableHead>Exam Type</TableHead><TableHead>Pages</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {papers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No past papers found</TableCell></TableRow>
            ) : papers.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell><Badge variant="outline">{p.subject}</Badge></TableCell>
                <TableCell>{p.class_name ?? "—"}</TableCell>
                <TableCell>{p.year ?? "—"}</TableCell>
                <TableCell>{p.exam_type ?? "—"}</TableCell>
                <TableCell>{p.pages ?? "—"}</TableCell>
                <TableCell>
                  {p.file_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3 mr-1" />Download</a>
                    </Button>
                  ) : <span className="text-muted-foreground text-sm">No file</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
