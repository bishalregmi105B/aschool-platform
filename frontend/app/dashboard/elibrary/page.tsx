"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { BookOpen, Search, Upload, Download, Plus } from "lucide-react";

export default function ELibraryPage() {
  return <PluginGate slug="elibrary"><ELibraryContent /></PluginGate>;
}

function ELibraryContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  // DigitalBook only stores title/author/file_url/file_type — the old dialog's
  // category/subject/class/isbn/description inputs were silently dropped by the
  // backend (and the category dropdown never filtered: GET /elibrary/books
  // ignores the param), so only storable fields remain.
  const [form, setForm] = useState({ title: "", author: "", file_url: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["elibrary", search],
    queryFn: async () => {
      const r = await api.get("/elibrary/books", { params: { search: search || undefined } });
      return {
        books: r.data?.data || [],
        stats: r.data?.meta?.stats || {},
      };
    },
    retry: 1,
  });

  const books = data?.books || [];
  const stats = data?.stats || {};

  const create = useMutation({
    mutationFn: async () => (await api.post("/elibrary/books", form)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["elibrary"] }); setShowDialog(false); toast.success("Book added"); },
    onError: () => toast.error("Failed to add book"),
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">E-Library</h1><p className="text-muted-foreground">Digital resource library and book management</p></div>
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load the e-library. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">E-Library</h1><p className="text-muted-foreground">Digital resource library and book management</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Resource</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ label: "Total Books", val: stats.total || books.length }, { label: "Textbooks", val: stats.textbooks || 0 }, { label: "E-Books", val: stats.ebooks || 0 }, { label: "Journals", val: stats.journals || 0 }].map((s) => (
          <Card key={s.label}><CardContent className="py-4"><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search books, authors..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Category</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {books.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No resources found</TableCell></TableRow>
              ) : books.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</div></TableCell>
                  <TableCell>{b.author || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{b.category}</Badge></TableCell>
                  <TableCell>{b.subject || "—"}</TableCell>
                  <TableCell>{b.class_name || "All"}</TableCell>
                  <TableCell>{b.file_url ? <Button variant="ghost" size="sm" asChild><a href={b.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a></Button> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>File URL / Link</Label>
              <Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://… or /uploads/… (upload files from the Upload Resources page)" />
              <p className="text-xs text-muted-foreground">To attach a real file, use Upload Resources — it stores the file and fills this URL for you.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
