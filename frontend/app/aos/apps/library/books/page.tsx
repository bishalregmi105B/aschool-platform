"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BookOpen, Search, Plus } from "lucide-react";

export default function BooksPage() {
  return <PluginGate slug="library"><BooksContent /></PluginGate>;
}

function BooksContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "general", publisher: "", copies: "1", shelf_location: "" });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library-books", search],
    queryFn: async () => { const r = await api.get("/library/books", { params: { search: search || undefined } }); return r.data; },
    retry: 1,
  });

  const books = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/library/books", { ...form, total_copies: parseInt(form.copies) || 1, available_copies: parseInt(form.copies) || 1 })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["library-books"] }); setShowDialog(false); toast.success("Book added"); },
    onError: () => toast.error("Failed to add book"),
  });

  const BOOK_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (b) => b.title ?? "", render: (b) => <div className="flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</div> },
    { key: "author", label: "Author", sortable: true, value: (b) => b.author ?? "", render: (b) => b.author || "—" },
    { key: "isbn", label: "ISBN", value: (b) => b.isbn ?? "", render: (b) => <span className="text-sm">{b.isbn || "—"}</span> },
    { key: "category", label: "Category", sortable: true, value: (b) => b.category ?? "", render: (b) => <Badge variant="outline">{b.category}</Badge> },
    { key: "total_copies", label: "Copies", align: "right", sortable: true, value: (b) => b.total_copies ?? 0 },
    { key: "available_copies", label: "Available", align: "right", sortable: true, value: (b) => b.available_copies ?? 0, render: (b) => <Badge variant={b.available_copies > 0 ? "default" : "destructive"}>{b.available_copies || 0}</Badge> },
    { key: "shelf_location", label: "Shelf", value: (b) => b.shelf_location ?? "", render: (b) => <span className="text-sm">{b.shelf_location || "—"}</span> },
  ];

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load books. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Books Catalog</h1><p className="text-muted-foreground">Manage library book collection</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Book</Button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search by title, author, ISBN..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card><CardContent className="pt-6">
        <DataTable
          columns={BOOK_COLUMNS}
          rows={books}
          rowKey={(b: any) => b.id}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by title, author, ISBN..."
          exportFileName="library-books"
          empty={{ icon: BookOpen, title: "No books found", body: "Add books to build the library catalog.", action: { label: "Add Book", onClick: () => setShowDialog(true) } }}
        />
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Book</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div className="space-y-2"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <AdvancedSelect
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          options={[{ value: 'general', label: 'General' }, { value: 'textbook', label: 'Textbook' }, { value: 'fiction', label: 'Fiction' }, { value: 'reference', label: 'Reference' }, { value: 'science', label: 'Science' }, { value: 'nepali', label: 'Nepali' }]}
        />
              </div>
              <div className="space-y-2"><Label>Copies</Label><Input type="number" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} /></div>
              <div className="space-y-2"><Label>Shelf</Label><Input value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} placeholder="A-1" /></div>
            </div>
            <div className="space-y-2"><Label>Publisher</Label><Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
