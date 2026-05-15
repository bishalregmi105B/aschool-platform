"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

  const { data: books, isLoading } = useQuery({
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
  });

  const returnMut = useMutation({
    mutationFn: async (issueId: string) => {
      const res = await api.post<ApiResponse>(`/library/issues/${issueId}/return`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-issues", "library-books"] });
      toast.success("Book returned");
    },
  });

  if (isLoading) return <PageLoader />;

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
        <>
          <Input placeholder="Search books..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books?.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-medium">{book.title}</TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell><Badge variant="outline">{book.category}</Badge></TableCell>
                      <TableCell>{book.available_copies}/{book.total_copies}</TableCell>
                      <TableCell>{book.shelf_location}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "issues" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue ID</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues?.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-xs">{issue.id.slice(0, 8)}</TableCell>
                    <TableCell>{issue.book_id}</TableCell>
                    <TableCell>{issue.student_id}</TableCell>
                    <TableCell>{displayBS(issue.due_date)}</TableCell>
                    <TableCell><Badge variant={issue.status === "returned" ? "default" : "destructive"}>{issue.status}</Badge></TableCell>
                    <TableCell>
                      {issue.status !== "returned" && (
                        <Button size="sm" variant="outline" onClick={() => returnMut.mutate(issue.id)}>Return</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
