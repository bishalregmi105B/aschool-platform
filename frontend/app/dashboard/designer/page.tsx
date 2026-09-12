"use client";

import { useState } from "react";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Palette, FileText, Search, Plus, ArrowRight, Clock, Trash2, Pencil,
  LayoutTemplate, ImageIcon, WalletCards, MoreVertical, RotateCcw,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  FilterCommandBar,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import { ChevronRight } from "lucide-react";

// Quick links — the design_studio manifest subitems plus the Writer surface.
const QUICK_LINKS = [
  { label: "Templates", icon: "Layers", href: "/dashboard/designer/templates" },
  { label: "Canvas Editor", icon: "Palette", href: "/dashboard/designer/editor" },
  { label: "Document Writer", icon: "FileText", href: "/dashboard/designer/writer" },
  { label: "Bulk ID Cards", icon: "Image", href: "/dashboard/designer/bulk" },
  { label: "Certificates", icon: "Award", href: "/dashboard/certificates" },
];

const CATEGORIES = [
  { id: "all",           label: "All" },
  { id: "id_cards",      label: "ID Cards" },
  { id: "certificates",  label: "Certificates" },
  { id: "admit_cards",   label: "Admit Cards" },
  { id: "reports",       label: "Reports" },
  { id: "notices",       label: "Notices" },
  { id: "letters",       label: "Letters" },
  { id: "lesson_plans",  label: "Lesson Plans" },
  { id: "letterheads",   label: "Letterheads" },
  { id: "calendars",     label: "Calendar" },
  { id: "banners",       label: "Banners" },
  { id: "posters",       label: "Posters" },
  { id: "registers",     label: "Registers" },
  { id: "forms",         label: "Forms" },
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  id_cards:     <ImageIcon className="h-4 w-4" />,
  calendars:    <LayoutTemplate className="h-4 w-4" />,
  reports:      <FileText className="h-4 w-4" />,
  certificates: <FileText className="h-4 w-4" />,
  admit_cards:  <WalletCards className="h-4 w-4" />,
  notices:      <FileText className="h-4 w-4" />,
  letters:      <FileText className="h-4 w-4" />,
  lesson_plans: <LayoutTemplate className="h-4 w-4" />,
  letterheads:  <FileText className="h-4 w-4" />,
  banners:      <LayoutTemplate className="h-4 w-4" />,
  posters:      <LayoutTemplate className="h-4 w-4" />,
  registers:    <FileText className="h-4 w-4" />,
  forms:        <FileText className="h-4 w-4" />,
};

export default function DesignerPage() {
  const router = useAOSRouterNavigate();
  const [search, setSearch]     = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const queryClient = useQueryClient();
  const { data: templates = [], isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const res = await api.get("/design-studio/templates");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    retry: 1,
  });

  // My Designs — recent saved documents
  const { data: myDocs = [] } = useQuery<any>({
    queryKey: ["designer-docs"],
    queryFn: async () => {
      const res = await api.get("/design-studio/documents");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/design-studio/documents/${id}`),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: ["designer-docs"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      api.get(`/design-studio/documents/${id}`).then((r) =>
        api.post("/design-studio/documents", {
          id,
          name,
          template_type: r.data?.data?.template_type ?? "custom",
          canvas_state: r.data?.data?.canvas_state ?? {},
          thumbnail_url: r.data?.data?.thumbnail_url ?? "",
        }),
      ),
    onSuccess: () => {
      toast.success("Renamed");
      queryClient.invalidateQueries({ queryKey: ["designer-docs"] });
    },
    onError: () => toast.error("Rename failed"),
  });

  const filtered = (templates as any[]).filter((t: any) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = activeTab === "all" || t.category === activeTab;
    return matchSearch && matchCat;
  });

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Design Studio" subtitle="Create school documents, certificates, ID cards, and more." />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load templates. Please try again.
              </p>
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
        icon={<Palette className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Design Studio"
        subtitle="Create school documents, certificates, ID cards, and more."
      />
      <AOSPageBody>
        {/* Dashboard — KPI stat grid from the queries the page already runs */}
        <StatGrid>
          <KpiCard
            label="Templates"
            value={(templates as any[]).length}
            icon={<LayoutTemplate className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="My Designs"
            value={(myDocs as any[]).length}
            color="var(--w11-text-primary)"
            icon={<Palette className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
          <KpiCard
            label="Certificate Templates"
            value={(templates as any[]).filter((t: any) => t.category === "certificates").length}
            color="#107c10"
            icon={<FileText className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="ID Card Templates"
            value={(templates as any[]).filter((t: any) => t.category === "id_cards").length}
            color="#d83b01"
            icon={<ImageIcon className="h-4 w-4" style={{ color: "#d83b01" }} />}
          />
        </StatGrid>

        {/* Quick links — 44px gradient icon tile + label, as next/link */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {QUICK_LINKS.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS["Design & Web"],
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {l.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Hero / Quick Start */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Bulk ID Cards — most common task */}
            <div
              className="win11-card cursor-pointer transition-all group"
              style={{ border: "2px dashed var(--w11-border-default)" }}
              onClick={() => router("/dashboard/designer/bulk")}
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--w11-accent)",
                    color: "var(--w11-accent-text)",
                    borderRadius: "var(--w11-radius-xl)",
                  }}
                >
                  <WalletCards className="h-6 w-6" />
                </div>
                <div>
                  <div
                    className="font-semibold text-base flex items-center gap-1"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    Bulk ID Cards
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>
                    Pick a class — ID cards auto-filled with photos, ready to export
                  </p>
                </div>
              </div>
            </div>

            {/* New Canvas Design */}
            <div
              className="win11-card cursor-pointer transition-all group"
              style={{ border: "2px dashed var(--w11-border-default)" }}
              onClick={() => router("/dashboard/designer/editor")}
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    background: "var(--w11-accent-light)",
                    borderRadius: "var(--w11-radius-xl)",
                  }}
                >
                  <Palette className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
                </div>
                <div>
                  <div
                    className="font-semibold text-base flex items-center gap-1"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    New Canvas Design
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>
                    Drag-and-drop canvas — shapes, images, multi-page
                  </p>
                </div>
              </div>
            </div>

            {/* New Document (Writer) */}
            <div
              className="win11-card cursor-pointer transition-all group"
              style={{ border: "2px dashed var(--w11-border-default)" }}
              onClick={() => router("/dashboard/designer/writer")}
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    background: "var(--w11-accent-light)",
                    borderRadius: "var(--w11-radius-xl)",
                  }}
                >
                  <FileText className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
                </div>
                <div>
                  <div
                    className="font-semibold text-base flex items-center gap-1"
                    style={{ color: "var(--w11-text-primary)" }}
                  >
                    New Document
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>
                    Rich-text writer — fonts, styles, PDF export
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* My Designs — recent saved documents */}
        {(myDocs as any[]).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold flex items-center gap-2"
                style={{ color: "var(--w11-text-primary)" }}
              >
                <Clock className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} /> My Designs
              </h2>
              <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                {(myDocs as any[]).length} saved
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(myDocs as any[]).slice(0, 12).map((doc: any) => (
                <div
                  key={doc.id}
                  className="group relative rounded-xl overflow-hidden hover:shadow-md transition-shadow win11-card"
                  style={{ padding: 0 }}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => {
                      const state = doc.canvas_state;
                      const isWriter = state?.type === "writer" || state?.type === "writer2";
                      router(isWriter ? `/dashboard/designer/writer?doc=${doc.id}` : `/dashboard/designer/editor?doc=${doc.id}`);
                    }}
                  >
                    <div
                      className="aspect-[4/3] flex items-center justify-center overflow-hidden"
                      style={{ background: "var(--w11-control-hover)" }}
                    >
                      {doc.thumbnail_url ? (
                        <img src={doc.thumbnail_url} alt={doc.name} className="w-full h-full object-cover" />
                      ) : (
                        <Palette className="h-8 w-8" style={{ color: "var(--w11-text-tertiary)" }} />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--w11-text-primary)" }}>{doc.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--w11-text-secondary)" }}>
                        {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </button>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-6 w-6 rounded-full border flex items-center justify-center"
                          style={{
                            background: "var(--w11-surface-solid)",
                            borderColor: "var(--w11-border-default)",
                          }}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const name = window.prompt("Rename design", doc.name);
                          if (name && name.trim()) renameDocMutation.mutate({ id: doc.id, name: name.trim() });
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router(`/dashboard/designer/editor?doc=${doc.id}`)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-2" /> Open in editor
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => {
                          if (window.confirm(`Delete "${doc.name}"?`)) deleteDocMutation.mutate(doc.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--w11-text-primary)" }}>Templates</h2>
            <div className="relative w-56">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: "var(--w11-text-tertiary)" }}
              />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Category tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="h-8 flex flex-wrap gap-1 bg-transparent p-0">
              {CATEGORIES.map((c) => (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className="h-7 text-xs px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {CATEGORY_ICON[c.id] ?? null}
                  <span className="ml-1">{c.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Template grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl animate-pulse aspect-[3/4]"
                  style={{ background: "var(--w11-control-hover)" }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <AOSEmptyState
              title={`No templates found${search ? ` for "${search}"` : ""}.`}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((tpl: any) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function TemplateCard({ template }: { template: any }) {
  const router = useAOSRouterNavigate();

  const ratio = template.height && template.width
    ? template.height / template.width
    : 1.414;

  // Dynamic: read editor_type from the API — "writer" or "designer" (default)
  const useWriter = template.editor_type === "writer";
  const dest = useWriter
    ? `/dashboard/designer/writer?template=${template.id}`
    : `/dashboard/designer/editor?template=${template.id}`;

  return (
    <div
      className="win11-card group cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      style={{ padding: 0 }}
      onClick={() => router(dest)}
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden"
        style={{ paddingTop: `${Math.min(ratio * 100, 133)}%`, background: "var(--w11-control-hover)" }}
      >
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--w11-text-tertiary)" }}
          >
            {CATEGORY_ICON[template.category] ?? <LayoutTemplate className="h-8 w-8" />}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        {/* Tool indicator */}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 backdrop-blur-sm">
            {useWriter ? "Writer" : "Designer"}
          </Badge>
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" className="h-7 text-xs gap-1">
            {useWriter ? <FileText className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {useWriter ? "Open" : "Use"}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-medium text-xs truncate" style={{ color: "var(--w11-text-primary)" }}>{template.name}</p>
        <div className="flex items-center justify-between mt-1">
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {template.category?.replace("_", " ")}
          </Badge>
          {template.width && (
            <span className="text-[10px]" style={{ color: "var(--w11-text-secondary)" }}>
              {template.width}×{template.height}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
