"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { VaultImageField } from "@/components/files/VaultImageField";
import { BookOpen, Search, Download, Plus } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";

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

  const RESOURCE_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (b) => b.title ?? "", render: (b) => <div className="flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-[color:var(--w11-text-secondary)]" />{b.title}</div> },
    { key: "author", label: "Author", sortable: true, value: (b) => b.author ?? "", render: (b) => b.author || "—" },
    { key: "category", label: "Category", sortable: true, value: (b) => b.category ?? "", render: (b) => <span className="win11-chip">{b.category}</span> },
    { key: "subject", label: "Subject", value: (b) => b.subject ?? "", render: (b) => b.subject || "—" },
    { key: "class_name", label: "Class", sortable: true, value: (b) => b.class_name ?? "", render: (b) => b.class_name || "All" },
    {
      key: "file_url",
      label: "Actions",
      noExport: true,
      render: (b) => (b.file_url ? (
        <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
          <a href={b.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
        </Button>
      ) : "—"),
    },
  ];

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="E-Library"
          subtitle="Digital resource library and book management"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load the e-library. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="E-Library"
        subtitle="Digital resource library and book management"
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Resource</Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Total Books" value={stats.total || books.length} />
          <KpiCard label="Textbooks" value={stats.textbooks || 0} />
          <KpiCard label="E-Books" value={stats.ebooks || 0} />
          <KpiCard label="Journals" value={stats.journals || 0} />
        </StatGrid>

        {/* Quick links — every e-library subpage from the plugin manifest */}
        <QuickLinks
          section="Learning"
          links={[
            { label: "Past Papers", href: "/dashboard/elibrary/past-papers", icon: "FileText" },
            { label: "Upload", href: "/dashboard/elibrary/upload", icon: "Upload" },
          ]}
        />

        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={RESOURCE_COLUMNS}
            rows={books}
            rowKey={(b: any) => b.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search books, authors..."
            exportFileName="elibrary"
            empty={{ icon: BookOpen, title: "No resources found", body: "Add digital books, e-books and journals to the library.", action: { label: "Add Resource", onClick: () => setShowDialog(true) } }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>File / Link</Label>
                <VaultImageField
                  value={form.file_url || null}
                  onChange={(url) => setForm({ ...form, file_url: url ?? "" })}
                  label="Resource file"
                  fileType=""
                />
                <p className="text-xs text-[color:var(--w11-text-secondary)]">Pick a file from your school vault, or upload one inside the picker — the URL is filled in for you.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
