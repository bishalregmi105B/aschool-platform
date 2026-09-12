"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  AOSModuleLoadingState,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

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
  thumbnail_emoji?: string;
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

  if (isLoading) return <AOSModuleLoadingState label="Loading templates…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Design Templates" subtitle="Choose a template to customize" />
        <AOSPageBody>
          <div className="py-10 text-center space-y-3">
            <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
              Failed to load templates. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const filtered = (templates || []).filter((t: Template) => {
    if (activeCategory && t.category !== activeCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AOSPage>
      <AOSPageHeader
        title={
          <span className="flex items-center gap-3">
            <Link href="/dashboard/designer" className="inline-flex">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            Design Templates
          </span>
        }
        subtitle="Choose a template to customize"
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "var(--w11-text-tertiary)" }}
            />
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
        </FilterCommandBar>

        {filtered.length === 0 ? (
          <AOSEmptyState title="No templates found." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((t: Template) => {
              const isWriter = t.editor_type === "writer";
              return (
              <div key={t.id} className="win11-card overflow-hidden hover:shadow-lg transition-shadow" style={{ padding: 0 }}>
                <div
                  className="aspect-[3/4] flex items-center justify-center relative"
                  style={{ background: "var(--w11-control-hover)" }}
                >
                  {t.thumbnail_url ? (
                    <>
                      <img
                        src={t.thumbnail_url}
                        alt={t.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <Badge variant="outline" className="absolute top-2 left-2 text-[10px] h-5 px-1.5 backdrop-blur-sm">
                        Demo
                      </Badge>
                    </>
                  ) : (
                    <span className="text-4xl">{t.thumbnail_emoji || "📄"}</span>
                  )}
                  {/* tool badge — matches the card on the designer home */}
                  <Badge variant="outline" className="absolute top-2 right-2 text-[9px] h-4 px-1.5 backdrop-blur-sm">
                    {isWriter ? "Writer" : "Designer"}
                  </Badge>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold" style={{ color: "var(--w11-text-primary)" }}>{t.name}</h3>
                  <Badge variant="secondary">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                  {t.is_default && <Badge className="ml-2">Default</Badge>}
                  <Link href={isWriter ? `/dashboard/designer/writer?template=${t.id}` : `/dashboard/designer/editor?template=${t.id}`}>
                    <Button className="w-full mt-2" size="sm">
                      Use Template
                    </Button>
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
