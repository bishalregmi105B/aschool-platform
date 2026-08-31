"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { BookOpen, Search, Plus, Pencil, Trash2 } from "lucide-react";

export default function CatalogPage() {
  return <PluginGate slug="library"><CatalogContent /></PluginGate>;
}

interface BookForm {
  title: string; author: string; isbn: string; category: string;
  publisher: string; copies: string; shelf_location: string;
}

const EMPTY_FORM: BookForm = { title: "", author: "", isbn: "", category: "general", publisher: "", copies: "1", shelf_location: "" };

function CatalogContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library-books", search],
    queryFn: async () => {
      const r = await api.get("/library/books", { params: { search: search || undefined } });
      return r.data;
    },
    retry: 1,
  });

  const books = data?.data || [];

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowDialog(true); };
  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({
      title: b.title ?? "", author: b.author ?? "", isbn: b.isbn ?? "",
      category: b.category ?? "general", publisher: b.publisher ?? "",
      copies: String(b.total_copies ?? 1), shelf_location: b.shelf_location ?? "",
    });
    setShowDialog(true);
  };

  const create = useMutation({
    mutationFn: async () => (await api.post("/library/books", { ...form, total_copies: parseInt(form.copies) || 1, available_copies: parseInt(form.copies) || 1 })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      setShowDialog(false);
      toast.success("Book added to catalog");
    },
    onError: () => toast.error("Failed to add book"),
  });

  const update = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/library/books/${editingId}`, {
          ...form,
          total_copies: parseInt(form.copies) || 1,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      setShowDialog(false);
      toast.success("Book updated");
    },
    onError: () => toast.error("Failed to update book"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/library/books/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      toast.success("Book removed");
    },
    onError: () => toast.error("Failed to remove book (it may have active issues)"),
  });

  const save = editingId ? update : create;

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load the catalog. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Book Catalog</h1>
          <p className="text-muted-foreground">Browse and manage the library catalog</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Book</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by title, author, ISBN..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Copies</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Shelf</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No books found</TableCell></TableRow>
            ) : books.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</div>
                </TableCell>
                <TableCell>{b.author || "—"}</TableCell>
                <TableCell className="text-sm">{b.isbn || "—"}</TableCell>
                <TableCell><Badge variant="outline">{b.category}</Badge></TableCell>
                <TableCell>{b.total_copies || 0}</TableCell>
                <TableCell><Badge variant={b.available_copies > 0 ? "default" : "destructive"}>{b.available_copies || 0}</Badge></TableCell>
                <TableCell className="text-sm">{b.shelf_location || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => {
                        if (window.confirm(`Delete "${b.title}" from the catalog?`)) remove.mutate(b.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Book" : "Add Book to Catalog"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div className="space-y-2"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full border rounded-md p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="general">General</option>
                  <option value="textbook">Textbook</option>
                  <option value="fiction">Fiction</option>
                  <option value="reference">Reference</option>
                  <option value="science">Science</option>
                  <option value="nepali">Nepali</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Copies</Label><Input type="number" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} /></div>
              <div className="space-y-2"><Label>Shelf</Label><Input value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} placeholder="A-1" /></div>
            </div>
            <div className="space-y-2"><Label>Publisher</Label><Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
              {save.isPending ? <Spinner className="mr-2" /> : null} {editingId ? "Save Changes" : "Add to Catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
