"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAOSRouteParams } from "@/lib/aos-window-route";
import { api, type ApiResponse } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { PaginationMeta } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import {
  AlertTriangle, BookOpen, PlusCircle, RotateCcw,
} from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
// Wave-C print twin (same window.print + scoped-style approach, no global CSS).
import { PrintStyles, PrintRegion, PrintTwinButton } from "@/app/dashboard/exams/print-twin";

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
    <AppGate slug="library">
      <LibraryContent />
    </AppGate>
  );
}

/**
 * Library hub — A5 launcher (plan 34-24): KPIs + QuickLinks into the v2
 * surfaces + the two most-used registers (Books | Issues) as fixed Tabs.
 * `?tab=issues` stays the deep-link contract for library__transactions.
 */
function LibraryContent() {
  const { t } = useI18n();
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
  const issues = issueData?.rows ?? [];
  const issueMeta = issueData?.meta;

  const addBookMut = useMutation({
    mutationFn: async (data: Partial<Book>) => {
      const res = await api.post<ApiResponse>("/library/books", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      setShowAddBook(false);
      toast.success(t("Book added", "किताब थपियो"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to add book", "किताब थप्न सकिएन")),
  });

  const returnMut = useMutation({
    mutationFn: async (issueId: string) => {
      const res = await api.post<ApiResponse>(`/library/issues/${issueId}/return`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      toast.success(t("Book returned", "किताब फर्कियो"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to process return", "फिर्ती प्रशोधन सकिएन")),
  });

  if (isLoading) return <AOSModuleLoadingState label={t("Loading library…", "पुस्तकालय लोड हुँदै…")} />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title={t("Library", "पुस्तकालय")} />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load library overview. Please try again.", "पुस्तकालय लोड गर्न सकिएन। पुनःप्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const overdueTotal = (overdueByClass || []).reduce((a, r) => a + (r.overdue || 0), 0);

  const BOOK_COLUMNS: Column<Book>[] = [
    { key: "title", label: t("Title", "शीर्षक"), sortable: true, value: (b) => b.title, render: (b) => <span className="font-medium">{b.title}</span> },
    { key: "author", label: t("Author", "लेखक"), sortable: true, value: (b) => b.author },
    { key: "category", label: t("Category", "श्रेणी"), sortable: true, value: (b) => b.category, render: (b) => <span className="win11-chip subtle">{b.category}</span> },
    { key: "available", label: t("Available", "उपलब्ध"), align: "right", sortable: true, value: (b) => b.available_copies, render: (b) => <>{b.available_copies}/{b.total_copies}</> },
    { key: "shelf_location", label: t("Location", "ठेगाना"), value: (b) => b.shelf_location },
  ];

  const ISSUE_COLUMNS: Column<BookIssue>[] = [
    { key: "id", label: t("Issue ID", "नं."), value: (i) => i.id.slice(0, 8), render: (i) => <span className="font-mono text-xs">{i.id.slice(0, 8)}</span> },
    { key: "book", label: t("Book", "किताब"), value: (i) => (i as any).book_title ?? i.book_id, render: (i) => (i as any).book_title || i.book_id },
    { key: "student", label: t("Student", "विद्यार्थी"), value: (i) => (i as any).student_name ?? i.student_id, render: (i) => (i as any).student_name || i.student_id },
    { key: "issued_date", label: t("Issued", "वितरण"), value: (i) => i.issued_date, render: (i) => displayBS(i.issued_date) },
    { key: "due_date", label: t("Due", "नियमित"), sortable: true, value: (i) => i.due_date, render: (i) => displayBS(i.due_date) },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (i) => i.status,
      render: (i) => <StatusChip status={i.status} className="capitalize" />,
    },
    {
      key: "actions",
      label: t("Actions", "कार्य"),
      noExport: true,
      render: (i) =>
        i.status !== "returned" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); returnMut.mutate(i.id); }}>{t("Return", "फिर्ता")}</Button>
            <Button size="sm" variant="ghost" disabled={(i as any).renewal_count >= 2}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await api.post(`/library/issues/${i.id}/renew`);
                  queryClient.invalidateQueries({ queryKey: ["library-issues"] });
                  toast.success(t("Due date extended", "मिति थपियो"));
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || t("Renewal failed", "नवीकरण सकिएन"));
                }
              }}>{t("Renew", "नवीकरण")}</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AOSPage>
      <PrintStyles />
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Library", "पुस्तकालय")}
        subtitle={`${bookMeta?.total ?? books?.length ?? 0} ${t("titles", "शीर्षक")} · ${stats?.available_copies ?? 0} ${t("available", "उपलब्ध")} · ${overdueTotal} ${t("overdue", "ढिला")}`}
        actions={
          <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
            <DialogTrigger asChild>
              <Button><PlusCircle className="h-4 w-4 mr-2" /> {t("Add Book", "किताब थप्नुहोस्")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("Add New Book", "नयाँ किताब")}</DialogTitle></DialogHeader>
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
            label={t("Titles / Copies", "शीर्षक / प्रतिलिपि")}
            value={`${stats?.titles ?? "—"} / ${stats?.total_copies ?? "—"}`}
          />
          <KpiCard
            icon={<BookOpen className="h-4 w-4" style={{ color: "#107c10" }} />}
            label={t("Available now", "अहिले उपलब्ध")}
            value={stats?.available_copies ?? "—"}
            color="#107c10"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" style={{ color: overdueTotal > 0 ? "#c42b1c" : "var(--w11-text-secondary)" }} />}
            label={t("Overdue", "अतिरिक्त ढिला")}
            value={overdueTotal || 0}
            color={overdueTotal > 0 ? "#c42b1c" : "var(--w11-accent)"}
          />
          <KpiCard
            icon={<RotateCcw className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
            label={t("Issues (page)", "वितरण (पृष्ठ)")}
            value={issueMeta?.total ?? "—"}
          />
        </StatGrid>

        {/* A5 launcher — one card per v2 surface (no duplicated tables). */}
        <QuickLinks
          section="Learning"
          links={[
            { label: t("Circulation desk", "सर्कुलेसन डेस्क"), href: "/dashboard/library/checkout", icon: "BookOpen" },
            { label: t("Catalog", "क्याटलग"), href: "/dashboard/library/catalog", icon: "Library" },
            { label: t("Books", "किताबहरू"), href: "/dashboard/library/books", icon: "BookOpen" },
            { label: t("Holds", "होल्डहरू"), href: "/dashboard/library/reservations", icon: "FileText" },
            { label: t("Fines", " जरिवाना"), href: "/dashboard/library/fines", icon: "Banknote" },
            { label: t("Overdue", "ढिला"), href: "/dashboard/library/overdue", icon: "AlertTriangle" },
            { label: t("Stock-take", "स्टक-टेक"), href: "/dashboard/library/stocktake", icon: "ClipboardCheck" },
            { label: t("Acquisition", "आआर्जन (PO/Vendor)"), href: "/dashboard/library/acquisition", icon: "Package" },
            { label: t("Reports", "रिपोर्ट"), href: "/dashboard/library/reports", icon: "BarChart3" },
          ]}
        />

        {/* Registers: same-data tabs (plan 33-1), deep-linkable via ?tab=. */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "books" | "issues")}>
          <TabsList className="mb-3">
            <TabsTrigger value="books" badge={bookMeta?.total}>{t("Books", "किताबहरू")}</TabsTrigger>
            <TabsTrigger value="issues" badge={issueMeta?.total}>{t("Issues", "वितरण")}</TabsTrigger>
          </TabsList>

          <TabsContent value="books">
            <DataPanel bodyClassName="p-0">
              <DataTable<Book>
                columns={BOOK_COLUMNS}
                rows={books ?? []}
                rowKey={(b) => b.id}
                searchable
                searchValue={search}
                onSearchChange={(v) => { setSearch(v); setBookPage(1); }}
                searchPlaceholder={t("Search books…", "किताब खोज्नुहोस्…")}
                exportFileName="library-books"
                pagination={bookMeta}
                onPageChange={setBookPage}
              />
            </DataPanel>
          </TabsContent>

          <TabsContent value="issues">
            <div className="flex justify-end mb-2 no-print">
              <PrintTwinButton title={`Library Issue Register ${new Date().toISOString().slice(0, 10)}`} label={t("Print register", "रेजिस्टर प्रिन्ट")} />
            </div>
            <PrintRegion>
              <div className="hidden print:block mb-2 text-[12pt] font-semibold">
                {t("Library Issue Register", "पुस्तकालय वितरण रेजिस्टर")} — {displayBS(new Date().toISOString().slice(0, 10))}
              </div>
              <DataPanel bodyClassName="p-0">
                <DataTable<BookIssue>
                  columns={ISSUE_COLUMNS}
                  rows={issues}
                  rowKey={(i) => i.id}
                  searchable
                  searchPlaceholder={t("Search issues…", "वितरण खोज्नुहोस्…")}
                  exportFileName="library-issues"
                  pagination={issueMeta}
                  onPageChange={setIssuePage}
                />
              </DataPanel>
            </PrintRegion>
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

function AddBookForm({ onSubmit, loading }: { onSubmit: (data: Partial<Book>) => void; loading: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "", total_copies: 1, shelf_location: "" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, available_copies: form.total_copies }); }} className="space-y-4">
      <Input placeholder={t("Title", "शीर्षक")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      <Input placeholder={t("Author", "लेखक")} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
      <Input placeholder="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
      <Input placeholder={t("Category", "श्रेणी")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder={t("Total Copies", "कुल प्रतिलिपि")} type="number" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })} />
        <Input placeholder={t("Shelf Location", "सेल्फ")} value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? t("Adding…", "थप्दै…") : t("Add Book", "किताब थप्नुहोस्")}</Button>
    </form>
  );
}
