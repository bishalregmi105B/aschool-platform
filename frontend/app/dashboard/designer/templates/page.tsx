"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  id_cards: "ID Cards",
  certificates: "Certificates",
  admit_cards: "Admit Cards",
  reports: "Report Cards",
  notices: "Notices & Posters",
  letterheads: "Letterheads",
  calendars: "Calendars",
  registers: "Registers",
  bills: "Bills",
  custom: "Custom",
};

interface Template {
  id: string;
  name: string;
  category: string;
  editor_type?: "designer" | "writer";
  thumbnail_url: string;
  is_default: boolean;
  description?: string;
}

export default function TemplatesPage() {
  return (
    <PluginGate slug="design_studio">
      <TemplatesContent />
    </PluginGate>
  );
}

function TemplatesContent() {
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(categoryFilter);

  const { data: templates, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["design-templates"],
    queryFn: async () => {
      const res = await api.get("/design-studio/templates");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    retry: 1,
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load templates. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const filtered = (templates || []).filter((t: Template) => {
    if (activeCategory && t.category !== activeCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/designer">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Design Templates</h1>
          <p className="text-muted-foreground">Choose a template to customize</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant={!activeCategory ? "default" : "outline"} size="sm" onClick={() => setActiveCategory("")}>
          All
        </Button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Button
            key={key}
            variant={activeCategory === key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No templates found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t: Template) => (
            <Card key={t.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-sm">Preview</span>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge variant="secondary">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                {t.is_default && <Badge className="ml-2">Default</Badge>}
                <Link href={t.editor_type === "writer" ? `/dashboard/designer/writer?template=${t.id}` : `/dashboard/designer/editor?template=${t.id}`}>
                  <Button className="w-full mt-2" size="sm">Use Template</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
