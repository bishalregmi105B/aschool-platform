"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { PaginationMeta } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import {
  AlertTriangle, BookOpen, BookmarkCheck, Banknote, PlusCircle,
  RotateCcw, ScanLine, BarChart3,
} from "lucide-react";
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
  fine_amount?: number;
}

export default function LibraryPage() {
  return (
    <PluginGate slug="library">
      <LibraryContent />
    </PluginGate>
  );
}

/** FC-B: librarian dashboard — circulation KPIs + 14-day trend + quick links
 * to the v2 surfaces (holds, fines, stock-take, reports) above the classic
 * books/issues tables. */
function LibraryContent() {
  const searchParams = useAOSRouteParams();
  const [search, setSearch] = useState("");
  const [bookPage, setBookPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);
  const [showAddBook, setShowAddBook] = useState(false);
  const initialTab = searchParams.get("tab") === "issues" ? "issues" : "books";
  const [tab, setTab] = useState<"books" | "issues">(initialTab);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["library-collection-stats"],
    queryFn: async () => (await api.get("/library/reports/collection_stats")).data?.data,
    staleTime: 60_000,
  });

  const { data: overdueByClass } = useQuery({
    queryKey: ["library-overdue-by-class"],
    queryFn: async () => (await api.get("/library/reports/overdue_by_class")).data?.data as
      { class_name: string; overdue: number }[],
    staleTime: 120_000,
  });

  const { data: bookData, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["library-books", search, bookPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(bookPage) });
      if (search) params.set("search", search);
      const res = await api.get<ApiResponse>(`/library/books?${params}`);
      return {
        rows: (res.data.data as Book[]) || [],
        meta: (res.data.meta as any)?.pagination as PaginationMeta | undefined,
      };
    },
  });
  const books = bookData?.rows;
  const bookMeta = bookData?.meta;

  const { data: issueData } = useQuery({
    queryKey: ["library-issues", issuePage],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/library/issues?page=${issuePage}`);
      return {
        rows: (res.data.data as BookIssue[]) || [],
        meta: (res.data.meta as any)?.pagination as PaginationMeta | undefined,
      };
    },
    enabled: tab === "issues",
  });
  const issues = issueData?.rows;
  const issueMeta = issueData?.meta;

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
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      toast.success("Book returned");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to process return"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading library…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Library" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load library overview. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const overdueTotal = (overdueByClass || []).reduce((a, r) => a + (r.overdue || 0), 0);

  const BOOK_COLUMNS: Column<Book>[] = [
    { key: "title", label: "Title", sortable: true, value: (b) => b.title, render: (b) => <span className="font-medium">{b.title}</span> },
    { key: "author", label: "Author", sortable: true, value: (b) => b.author },
    { key: "category", label: "Category", sortable: true, value: (b) => b.category, render: (b) => <span className="win11-chip subtle">{b.category}</span> },
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
      render: (i) => <StatusChip status={i.status} className="capitalize" />,
    },
    {
      key: "actions",
      label: "Actions",
      noExport: true,
      render: (i) =>
        i.status !== "returned" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); returnMut.mutate(i.id); }}>Return</Button>
            <Button size="sm" variant="ghost" disabled={(i as any).renewal_count >= 2}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await api.post(`/library/issues/${i.id}/renew`);
                  queryClient.invalidateQueries({ queryKey: ["library-issues"] });
                  toast.success("Due date extended");
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || "Renewal failed");
                }
              }}>Renew</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Library"
        subtitle={`${bookMeta?.total ?? books?.length ?? 0} titles · ${stats?.available_copies ?? 0} available · ${overdueTotal} overdue`}
        actions={
          <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
            <DialogTrigger asChild>
              <Button><PlusCircle className="h-4 w-4 mr-2" /> Add Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
              <AddBookForm onSubmit={(data) => addBookMut.mutate(data)} loading={addBookMut.isPending} />
            </DialogContent>
          </Dialog>
        }
      />
      <AOSPageBody>
        {/* KPI cards */}
        <StatGrid>
          <KpiCard
            icon={<BookOpen className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            label="Titles / Copies"
            value={`${stats?.titles ?? "—"} / ${stats?.total_copies ?? "—"}`}
          />
          <KpiCard
            icon={<BookOpen className="h-4 w-4" style={{ color: "#107c10" }} />}
            label="Available now"
            value={stats?.available_copies ?? "—"}
            color="#107c10"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" style={{ color: overdueTotal > 0 ? "#c42b1c" : "var(--w11-text-secondary)" }} />}
            label="Overdue"
            value={overdueTotal || 0}
            color={overdueTotal > 0 ? "#c42b1c" : "var(--w11-accent)"}
          />
          <Link href="/dashboard/library/reservations" className="block">
            <div className="win11-card h-full transition-colors hover:bg-[var(--w11-control-hover)]" style={{ cursor: "pointer" }}>
              <div className="flex items-center gap-3">
                <div className="rounded-md p-2" style={{ background: "var(--w11-control-hover)" }}>
                  <BookmarkCheck className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>Holds &amp; fines</p>
                  <p className="text-sm font-medium underline" style={{ color: "var(--w11-accent)" }}>Manage queue →</p>
                </div>
              </div>
            </div>
          </Link>
        </StatGrid>

        {/* Quick links */}
        <FilterCommandBar>
          <Button asChild variant="outline"><Link href="/dashboard/library/checkout"><ScanLine className="h-4 w-4 mr-2" /> Circulation desk</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/library/reservations"><BookmarkCheck className="h-4 w-4 mr-2" /> Holds</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/library/fines"><Banknote className="h-4 w-4 mr-2" /> Fines</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/library/stocktake"><ScanLine className="h-4 w-4 mr-2" /> Stock-take</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/library/reports"><BarChart3 className="h-4 w-4 mr-2" /> Reports</Link></Button>
        </FilterCommandBar>

        <FilterCommandBar>
          <Button variant={tab === "books" ? "default" : "outline"} onClick={() => setTab("books")}>
            <BookOpen className="h-4 w-4 mr-2" /> Books ({bookMeta?.total ?? books?.length ?? 0})
          </Button>
          <Button variant={tab === "issues" ? "default" : "outline"} onClick={() => setTab("issues")}>
            <RotateCcw className="h-4 w-4 mr-2" /> Issues{issueMeta ? ` (${issueMeta.total})` : ""}
          </Button>
        </FilterCommandBar>

        {tab === "books" && (
          <DataPanel bodyClassName="p-0">
            <DataTable<Book>
              columns={BOOK_COLUMNS}
              rows={books ?? []}
              rowKey={(b) => b.id}
              searchable
              searchValue={search}
              onSearchChange={(v) => { setSearch(v); setBookPage(1); }}
              searchPlaceholder="Search books..."
              exportFileName="library-books"
              pagination={bookMeta}
              onPageChange={setBookPage}
            />
          </DataPanel>
        )}

        {tab === "issues" && (
          <DataPanel bodyClassName="p-0">
            <DataTable<BookIssue>
              columns={ISSUE_COLUMNS}
              rows={issues ?? []}
              rowKey={(i) => i.id}
              searchable
              searchPlaceholder="Search issues…"
              exportFileName="library-issues"
              pagination={issueMeta}
              onPageChange={setIssuePage}
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
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
