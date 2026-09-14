"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { VaultImageField } from "@/components/files/VaultImageField";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BookOpen, Search, Download, Plus, FileText, FileType } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  FilterCommandBar,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import { useI18n } from "@/lib/i18n";
import { useDebounced } from "@/components/ui/filter-bar";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

export default function ELibraryPage() {
  return <AppGate slug="elibrary"><ELibraryContent /></AppGate>;
}

function ELibraryContent() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  // Wave C (plan 34-25): hub becomes a card grid; the file-type filter is URL
  // state (shareable), search stays server-side & debounced.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const typeFilter = routeParams.get("type") || "";
  const setTypeFilter = (v: string) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/elibrary";
    const next = new URLSearchParams(routeParams.toString());
    if (v) next.set("type", v);
    else next.delete("type");
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [showDialog, setShowDialog] = useState(false);
  // DigitalBook only stores title/author/file_url/file_type — the old dialog's
  // category/subject/class/isbn/description inputs were silently dropped by the
  // backend (and the category dropdown never filtered: GET /elibrary/books
  // ignores the param), so only storable fields remain.
  const [form, setForm] = useState({ title: "", author: "", file_url: "" });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["elibrary", debouncedSearch],
    queryFn: async () => {
      const r = await api.get("/elibrary/books", { params: { search: debouncedSearch || undefined } });
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

  const typesFromData = Array.from(new Set(books.map((b: any) => b.file_type).filter(Boolean))) as string[];
  const shown = typeFilter ? books.filter((b: any) => (b.file_type || "file") === typeFilter) : books;

  if (isLoading)
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("E-Library", "इ-पुस्तकालय")}
          subtitle={t("Digital resource library and book management", "डिजिटल स्रोत पुस्तकालय")}
        />
        <AOSPageBody>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
        </AOSPageBody>
      </AOSPage>
    );

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
        title={t("E-Library", "इ-पुस्तकालय")}
        subtitle={`${books.length} ${t("resources", "स्रोत")} · ${t("Digital resource library and book management", "डिजिटल स्रोत पुस्तकालय")}`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> {t("Add Resource", "स्रोत थप्नुहोस्")}</Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label={t("Total Books", "कुल पुस्तक")} value={stats.total || books.length} />
          <KpiCard label={t("Textbooks", "पाठ्यपुस्तक")} value={stats.textbooks || 0} />
          <KpiCard label={t("E-Books", "इ-पुस्तक")} value={stats.ebooks || 0} />
          <KpiCard label={t("Journals", "जर्नल")} value={stats.journals || 0} />
        </StatGrid>

        {/* Quick links — every e-library subpage from the plugin manifest */}
        <QuickLinks
          section="Learning"
          links={[
            { label: "Past Papers", href: "/dashboard/elibrary/past-papers", icon: "FileText" },
            { label: "Upload", href: "/dashboard/elibrary/upload", icon: "Upload" },
          ]}
        />

        <FilterCommandBar>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--w11-text-secondary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search books, authors…", "पुस्तक/लेखक खोज्नुहोस्…")}
              className="pl-8"
            />
          </div>
          <AdvancedSelect
            className="w-40"
            triggerClassName="h-8 text-xs"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v || "")}
            clearable
            placeholder={t("All types", "सबै प्रकार")}
            options={(typesFromData.length ? typesFromData : ["pdf", "epub"]).map((ft) => ({ value: ft, label: ft.toUpperCase() }))}
          />
        </FilterCommandBar>

        {shown.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<BookOpen className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
              title={books.length > 0 && typeFilter
                ? t("No resources of this type", "यो प्रकारको स्रोत भेटिएन")
                : t("No resources found", "कुनै स्रोत भेटिएन")}
              description={t("Add digital books, e-books and journals to the library.", "पुस्तकालयमा डिजिटल पुस्तक थप्नुहोस्।")}
              action={books.length > 0 && typeFilter
                ? { label: t("Clear filter", "फिल्टर हटाउनुहोस्"), onClick: () => setTypeFilter("") }
                : { label: t("Add Resource", "स्रोत थप्नुहोस्"), onClick: () => setShowDialog(true) }}
            />
          </DataPanel>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {shown.map((b: any) => (
              <div key={b.id} className="win11-card" style={{ marginBottom: 0 }}>
                <div className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}
                    >
                      {b.file_type === "epub" ? <BookOpen className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    {b.file_type && <span className="win11-chip subtle uppercase text-[10px]">{b.file_type}</span>}
                  </div>
                  <p className="font-medium text-sm mt-3 line-clamp-2" title={b.title}>{b.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--w11-text-secondary)" }}>
                    {b.author || t("Unknown author", "लेखक अज्ञात")}
                  </p>
                  <div className="mt-auto pt-3">
                    {b.file_url ? (
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                        <a href={b.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> {t("Open", "खोल्नुहोस्")}
                        </a>
                      </Button>
                    ) : (
                      <p className="text-[11px] text-center" style={{ color: "var(--w11-text-tertiary)" }}>{t("No file linked", "फाइल छैन")}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
