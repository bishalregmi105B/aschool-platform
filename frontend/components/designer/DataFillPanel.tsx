"use client";
/**
 * DataFillPanel — reusable sidebar panel for auto-filling templates
 * with real data from students, teachers, or school records.
 *
 * Used in both the Canvas Designer and the Writer.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, ChevronLeft, Check, Database, User, GraduationCap, School } from "lucide-react";

interface DataFillPanelProps {
  /** Called with the field mapping when user selects a record */
  onApply: (fields: Record<string, string>) => void;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  student: <GraduationCap className="h-5 w-5" />,
  teacher: <User className="h-5 w-5" />,
  school:  <School className="h-5 w-5" />,
};

export default function DataFillPanel({ onApply }: DataFillPanelProps) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  // Fetch available data sources
  const { data: sources = [] } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      try {
        const r = await api.get("/design-studio/data-sources");
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch records for the active source
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["data-source-records", activeSource, search],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        params.set("limit", "50");
        const r = await api.get(`/design-studio/data-sources/${activeSource}/records?${params}`);
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!activeSource,
  });

  const handleApply = (record: any) => {
    setAppliedId(record.id);
    onApply(record.fields || {});
  };

  // Source selection view
  if (!activeSource) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>Select a data source to auto-fill template fields</span>
        </div>

        {sources.length === 0 ? (
          // Fallback if API isn't available — show static options
          <div className="space-y-2">
            {[
              { id: "student", name: "Students", icon: "🎓", description: "Auto-fill from student records" },
              { id: "teacher", name: "Teachers / Staff", icon: "👨‍🏫", description: "Auto-fill from teacher/staff records" },
              { id: "school", name: "School Info", icon: "🏫", description: "Auto-fill school details" },
            ].map((src) => (
              <button key={src.id} onClick={() => setActiveSource(src.id)}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-primary/5 hover:border-primary transition-all text-left">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                  {SOURCE_ICONS[src.id] || <span className="text-xl">{src.icon}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{src.name}</p>
                  <p className="text-[10px] text-muted-foreground">{src.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((src: any) => (
              <button key={src.id} onClick={() => setActiveSource(src.id)}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-primary/5 hover:border-primary transition-all text-left">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                  {SOURCE_ICONS[src.id] || <span className="text-xl">{src.icon}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{src.name}</p>
                  <p className="text-[10px] text-muted-foreground">{src.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <Separator />
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-[10px] text-blue-700 dark:text-blue-300 font-medium mb-1">💡 How it works</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
            Select a data source, pick a record, and the template fields 
            (name, class, roll no, etc.) will be automatically filled in.
          </p>
        </div>
      </div>
    );
  }

  // Records list view
  const currentSource = sources.find((s: any) => s.id === activeSource);
  return (
    <div className="space-y-3">
      {/* Back button */}
      <button onClick={() => { setActiveSource(null); setSearch(""); setAppliedId(null); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        <span>Back to sources</span>
      </button>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary shrink-0">
          {SOURCE_ICONS[activeSource] || <Database className="h-4 w-4" />}
        </div>
        <span className="text-sm font-semibold">{currentSource?.name || activeSource}</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search records…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 h-8 text-xs"
        />
      </div>

      {/* Available fields */}
      {currentSource?.fields && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            Available fields ({currentSource.fields.length})
          </summary>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {currentSource.fields.map((f: string) => (
              <span key={f} className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">{f}</span>
            ))}
          </div>
        </details>
      )}

      <Separator />

      {/* Records */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">No records found</p>
          {search && <p className="text-[10px] text-muted-foreground mt-1">Try a different search</p>}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[calc(100vh-380px)] overflow-y-auto">
          {records.map((record: any) => (
            <button
              key={record.id}
              onClick={() => handleApply(record)}
              className={`w-full flex items-center gap-2.5 p-2.5 border rounded-lg transition-all text-left
                ${appliedId === record.id
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                  : "hover:bg-muted/50 hover:border-primary/30"
                }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{record.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{record.subtitle}</p>
              </div>
              {appliedId === record.id ? (
                <Check className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleApply(record); }}>
                  Apply
                </Button>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
