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
import { BookOpen, Search, Plus } from "lucide-react";

export default function CatalogPage() {
  return <PluginGate slug="library"><CatalogContent /></PluginGate>;
}

function CatalogContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "general", publisher: "", copies: "1", shelf_location: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["library-books", search],
    queryFn: async () => {
      const r = await api.get("/library/books", { params: { search: search || undefined } });
      return r.data;
    },
  });

  const books = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/library/books", { ...form, copies: parseInt(form.copies) || 1 })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      setShowDialog(false);
      toast.success("Book added to catalog");
    },
    onError: () => toast.error("Failed to add book"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Book Catalog</h1>
          <p className="text-muted-foreground">Browse and manage the library catalog</p>
        </div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Book</Button>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No books found</TableCell></TableRow>
            ) : books.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</div>
                </TableCell>
                <TableCell>{b.author || "—"}</TableCell>
                <TableCell className="text-sm">{b.isbn || "—"}</TableCell>
                <TableCell><Badge variant="outline">{b.category}</Badge></TableCell>
                <TableCell>{b.copies || 0}</TableCell>
                <TableCell><Badge variant={b.available > 0 ? "default" : "destructive"}>{b.available || 0}</Badge></TableCell>
                <TableCell className="text-sm">{b.shelf_location || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Book to Catalog</DialogTitle></DialogHeader>
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
            <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
              {create.isPending ? <Spinner className="mr-2" /> : null} Add to Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
