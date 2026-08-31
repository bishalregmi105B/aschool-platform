"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const CATEGORIES = [
  { id: "all",          label: "All" },
  { id: "id_cards",     label: "ID Cards" },
  { id: "certificates", label: "Certificates" },
  { id: "admit_cards",  label: "Admit Cards" },
  { id: "reports",      label: "Reports" },
  { id: "calendars",    label: "Calendar" },
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  id_cards:     <ImageIcon className="h-4 w-4" />,
  calendars:    <LayoutTemplate className="h-4 w-4" />,
  reports:      <FileText className="h-4 w-4" />,
  certificates: <FileText className="h-4 w-4" />,
  admit_cards:  <WalletCards className="h-4 w-4" />,
};

export default function DesignerPage() {
  const router         = useRouter();
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
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Design Studio</h1>
        <Card className="mt-6"><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load templates. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Hero / Quick Start */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Design Studio</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Create school documents, certificates, ID cards, and more.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Bulk ID Cards — most common task */}
          <Card
            className="cursor-pointer border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => router.push("/dashboard/designer/bulk")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <WalletCards className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-base flex items-center gap-1">
                  Bulk ID Cards
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a class — ID cards auto-filled with photos, ready to export
                </p>
              </div>
            </CardContent>
          </Card>

          {/* New Canvas Design */}
          <Card
            className="cursor-pointer border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => router.push("/dashboard/designer/editor")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-base flex items-center gap-1">
                  New Canvas Design
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drag-and-drop canvas — shapes, images, multi-page
                </p>
              </div>
            </CardContent>
          </Card>

          {/* New Document (Writer) */}
          <Card
            className="cursor-pointer border-2 border-dashed hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all group"
            onClick={() => router.push("/dashboard/designer/writer")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 flex items-center justify-center shrink-0 transition-colors">
                <FileText className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <div className="font-semibold text-base text-violet-700 dark:text-violet-400 flex items-center gap-1">
                  New Document
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rich-text writer — fonts, styles, PDF export
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* My Designs — recent saved documents */}
      {(myDocs as any[]).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> My Designs
            </h2>
            <span className="text-xs text-muted-foreground">{(myDocs as any[]).length} saved</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(myDocs as any[]).slice(0, 12).map((doc: any) => (
              <div key={doc.id} className="group relative border rounded-xl overflow-hidden bg-background hover:shadow-md transition-shadow">
                <button
                  className="block w-full text-left"
                  onClick={() => {
                    const state = doc.canvas_state;
                    const isWriter = state?.type === "writer" || state?.type === "writer2";
                    router.push(isWriter ? `/dashboard/designer/writer?doc=${doc.id}` : `/dashboard/designer/editor?doc=${doc.id}`);
                  }}
                >
                  <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden">
                    {doc.thumbnail_url ? (
                      <img src={doc.thumbnail_url} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <Palette className="h-8 w-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                </button>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 rounded-full bg-background/90 border flex items-center justify-center hover:bg-muted">
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
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/designer/editor?doc=${doc.id}`)}>
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
          <h2 className="text-lg font-semibold">Templates</h2>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
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
              <div key={i} className="rounded-xl border bg-muted animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No templates found{search ? ` for "${search}"` : ""}.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((tpl: any) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  const router = useRouter();

  const ratio = template.height && template.width
    ? template.height / template.width
    : 1.414;

  // Dynamic: read editor_type from the API — "writer" or "designer" (default)
  const useWriter = template.editor_type === "writer";
  const dest = useWriter
    ? `/dashboard/designer/writer?template=${template.id}`
    : `/dashboard/designer/editor?template=${template.id}`;

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      onClick={() => router.push(dest)}
    >
      {/* Thumbnail */}
      <div
        className="bg-gradient-to-br from-muted to-muted/60 relative overflow-hidden"
        style={{ paddingTop: `${Math.min(ratio * 100, 133)}%` }}
      >
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
            {CATEGORY_ICON[template.category] ?? <LayoutTemplate className="h-8 w-8" />}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        {/* Tool indicator */}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 backdrop-blur-sm ${useWriter ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
            {useWriter ? "Writer" : "Designer"}
          </Badge>
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" className={`h-7 text-xs gap-1 ${useWriter ? "bg-violet-600 hover:bg-violet-700" : ""}`}>
            {useWriter ? <FileText className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {useWriter ? "Open" : "Use"}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-medium text-xs truncate">{template.name}</p>
        <div className="flex items-center justify-between mt-1">
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {template.category?.replace("_", " ")}
          </Badge>
          {template.width && (
            <span className="text-[10px] text-muted-foreground">
              {template.width}×{template.height}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
