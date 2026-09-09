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

  const CATALOG_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (b) => b.title ?? "", render: (b) => <div className="flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</div> },
    { key: "author", label: "Author", sortable: true, value: (b) => b.author ?? "", render: (b) => b.author || "—" },
    { key: "isbn", label: "ISBN", value: (b) => b.isbn ?? "", render: (b) => <span className="text-sm">{b.isbn || "—"}</span> },
    { key: "category", label: "Category", sortable: true, value: (b) => b.category ?? "", render: (b) => <Badge variant="outline">{b.category}</Badge> },
    { key: "total_copies", label: "Copies", align: "right", sortable: true, value: (b) => b.total_copies ?? 0 },
    { key: "available_copies", label: "Available", align: "right", sortable: true, value: (b) => b.available_copies ?? 0, render: (b) => <Badge variant={b.available_copies > 0 ? "default" : "destructive"}>{b.available_copies || 0}</Badge> },
    { key: "shelf_location", label: "Shelf", value: (b) => b.shelf_location ?? "", render: (b) => <span className="text-sm">{b.shelf_location || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(b); }} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${b.title}" from the catalog?`)) remove.mutate(b.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

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
        <DataTable
          columns={CATALOG_COLUMNS}
          rows={books}
          rowKey={(b: any) => b.id}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by title, author, ISBN..."
          exportFileName="library-catalog"
          empty={{ icon: BookOpen, title: "No books found", body: "Add books to build the catalog.", action: { label: "Add Book", onClick: openCreate } }}
        />
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
