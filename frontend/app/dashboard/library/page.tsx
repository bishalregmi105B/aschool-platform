"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, PlusCircle, RotateCcw } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  total_copies: number;
  available_copies: number;
  shelf_location: string;
}

interface BookIssue {
  id: string;
  book_id: string;
  student_id: string;
  issued_date: string;
  due_date: string;
  returned_date: string | null;
  status: string;
}

export default function LibraryPage() {
  return (
    <PluginGate slug="library">
      <LibraryContent />
    </PluginGate>
  );
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [showAddBook, setShowAddBook] = useState(false);
  const initialTab = searchParams.get("tab") === "issues" ? "issues" : "books";
  const [tab, setTab] = useState<"books" | "issues">(initialTab);
  const queryClient = useQueryClient();

  const { data: books, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["library-books", search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await api.get<ApiResponse>(`/library/books${params}`);
      return (res.data.data as Book[]) || [];
    },
  });

  const { data: issues } = useQuery({
    queryKey: ["library-issues"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/library/issues");
      return (res.data.data as BookIssue[]) || [];
    },
    enabled: tab === "issues",
  });

  const addBookMut = useMutation({
    mutationFn: async (data: Partial<Book>) => {
      const res = await api.post<ApiResponse>("/library/books", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      setShowAddBook(false);
      toast.success("Book added");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to add book"),
  });

  const returnMut = useMutation({
    mutationFn: async (issueId: string) => {
      const res = await api.post<ApiResponse>(`/library/issues/${issueId}/return`);
      return res.data;
    },
    onSuccess: () => {
      // element-wise prefixes: the combined key matched neither query
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      toast.success("Book returned");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to process return"),
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load library overview. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const BOOK_COLUMNS: Column<Book>[] = [
    { key: "title", label: "Title", sortable: true, value: (b) => b.title, render: (b) => <span className="font-medium">{b.title}</span> },
    { key: "author", label: "Author", sortable: true, value: (b) => b.author },
    { key: "category", label: "Category", sortable: true, value: (b) => b.category, render: (b) => <Badge variant="outline">{b.category}</Badge> },
    { key: "available", label: "Available", align: "right", sortable: true, value: (b) => b.available_copies, render: (b) => <>{b.available_copies}/{b.total_copies}</> },
    { key: "shelf_location", label: "Location", value: (b) => b.shelf_location },
  ];

  const ISSUE_COLUMNS: Column<BookIssue>[] = [
    { key: "id", label: "Issue ID", value: (i) => i.id.slice(0, 8), render: (i) => <span className="font-mono text-xs">{i.id.slice(0, 8)}</span> },
    { key: "book", label: "Book", value: (i) => (i as any).book_title ?? i.book_id, render: (i) => (i as any).book_title || i.book_id },
    { key: "student", label: "Student", value: (i) => (i as any).student_name ?? i.student_id, render: (i) => (i as any).student_name || i.student_id },
    { key: "due_date", label: "Due Date", sortable: true, value: (i) => i.due_date, render: (i) => displayBS(i.due_date) },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (i) => i.status,
      render: (i) => <Badge variant={i.status === "returned" ? "default" : "destructive"}>{i.status}</Badge>,
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (i) =>
        i.status !== "returned" ? (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); returnMut.mutate(i.id); }}>Return</Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">Manage books, issues, and returns</p>
        </div>
        <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="h-4 w-4 mr-2" /> Add Book</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
            <AddBookForm onSubmit={(data) => addBookMut.mutate(data)} loading={addBookMut.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "books" ? "default" : "outline"} onClick={() => setTab("books")}>
          <BookOpen className="h-4 w-4 mr-2" /> Books ({books?.length || 0})
        </Button>
        <Button variant={tab === "issues" ? "default" : "outline"} onClick={() => setTab("issues")}>
          <RotateCcw className="h-4 w-4 mr-2" /> Issues
        </Button>
      </div>

      {tab === "books" && (
        <Card>
          <CardContent className="p-0">
            <DataTable<Book>
              columns={BOOK_COLUMNS}
              rows={books ?? []}
              rowKey={(b) => b.id}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search books..."
              exportFileName="library-books"
            />
          </CardContent>
        </Card>
      )}

      {tab === "issues" && (
        <Card>
          <CardContent className="p-0">
            <DataTable<BookIssue>
              columns={ISSUE_COLUMNS}
              rows={issues ?? []}
              rowKey={(i) => i.id}
              searchable
              searchPlaceholder="Search issues…"
              exportFileName="library-issues"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddBookForm({ onSubmit, loading }: { onSubmit: (data: Partial<Book>) => void; loading: boolean }) {
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "", total_copies: 1, shelf_location: "" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, available_copies: form.total_copies }); }} className="space-y-4">
      <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      <Input placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
      <Input placeholder="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
      <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      <Input placeholder="Total Copies" type="number" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })} />
      <Input placeholder="Shelf Location" value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} />
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Adding..." : "Add Book"}</Button>
    </form>
  );
}
