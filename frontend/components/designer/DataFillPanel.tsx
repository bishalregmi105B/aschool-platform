"use client";
/**
 * DataFillPanel v2 — sidebar panel for auto-filling templates with real data.
 *
 * v2: class/section filters, exam selector for exam_result source, paginated
 * search, click-a-field-to-insert-token, live value preview on apply.
 *
 * Used in both the Canvas Designer and the Writer.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ChevronLeft, Check, Database, User, GraduationCap, School,
  BarChart3, MousePointerClick, Plus,
} from "lucide-react";

interface DataFillPanelProps {
  /** Called with the field mapping when user selects a record */
  onApply: (fields: Record<string, string>) => void;
  /** Optional: insert a token into the current selection (writer/canvas) */
  onInsertToken?: (token: string) => void;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  student: <GraduationCap className="h-5 w-5" />,
  teacher: <User className="h-5 w-5" />,
  school:  <School className="h-5 w-5" />,
  exam_result: <BarChart3 className="h-5 w-5" />,
};

export default function DataFillPanel({ onApply, onInsertToken }: DataFillPanelProps) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examId, setExamId] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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

  // Classes for the filter (student source)
  const { data: classes = [] } = useQuery({
    queryKey: ["designer-classes"],
    queryFn: async () => {
      try {
        const r = await api.get("/academics/classes");
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: activeSource === "student",
  });

  const selectedClass = useMemo(
    () => classes.find((c: any) => c.id === classId),
    [classes, classId],
  );

  // Exams for the filter (exam_result source)
  const { data: exams = [] } = useQuery({
    queryKey: ["designer-exams"],
    queryFn: async () => {
      try {
        const r = await api.get("/exams");
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: activeSource === "exam_result",
  });

  // Fetch records for the active source
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["data-source-records", activeSource, debouncedSearch, classId, sectionId, examId, limit],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (classId) params.set("class_id", classId);
        if (sectionId) params.set("section_id", sectionId);
        if (examId) params.set("exam_id", examId);
        params.set("limit", String(limit));
        const r = await api.get(`/design-studio/data-sources/${activeSource}/records?${params}`);
        return r.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!activeSource && (activeSource !== "exam_result" || !!examId),
  });

  const handleApply = (record: any) => {
    setAppliedId(record.id);
    onApply(record.fields || {});
  };

  const insertToken = (field: string) => {
    if (onInsertToken) onInsertToken(`{${field}}`);
  };

  const currentSource = sources.find((s: any) => s.id === activeSource);

  // Source selection view
  if (!activeSource) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>Auto-fill template fields from your school data</span>
        </div>

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

        <Separator />

        {/* Built-in date tokens — always available, no data source needed */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            📅 Auto Dates (always live)
          </p>
          <div className="flex flex-wrap gap-1">
            {["today_bs", "today_bs_nepali", "today_ad", "bs_year", "bs_month_name", "bs_day", "ad_year", "ad_month_name", "current_time", "academic_year_bs", "weekday_name"].map((f) => (
              <button key={f}
                onClick={() => onInsertToken?.(`{${f}}`)}
                title={`Insert {${f}} — filled automatically on every render/export`}
                className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-mono text-amber-800 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors inline-flex items-center gap-0.5">
                <Plus className="h-2 w-2" />{f}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            These fill with the current Nepali (BS) / English (AD) date at render & export time — never stale.
          </p>
        </div>

        <Separator />
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-[10px] text-blue-700 font-medium mb-1">💡 How it works</p>
          <p className="text-[10px] text-blue-600 leading-relaxed">
            Pick a record to fill the design — apply is <strong>non-destructive</strong>:
            switch to another student anytime. Insert <code className="font-mono">{"{field}"}</code> tokens
            to bind text layers. For bulk (whole class), use the designer hub → Bulk.
          </p>
        </div>
      </div>
    );
  }

  // Records list view
  return (
    <div className="space-y-3">
      <button onClick={() => { setActiveSource(null); setSearch(""); setAppliedId(null); setSectionId(""); }}
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

      {/* Filters */}
      {activeSource === "student" && (
        <div className="grid grid-cols-2 gap-1.5">
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {(selectedClass?.sections || []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeSource === "exam_result" && (
        <div className="space-y-1.5">
          {exams.length === 0 ? (
            <p className="text-xs text-muted-foreground">No exams found — create one under Exams first.</p>
          ) : (
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select exam…" /></SelectTrigger>
              <SelectContent>
                {exams.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.name || e.title || "Exam"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

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

      {/* Available fields — click to insert token */}
      {currentSource?.fields && (
        <div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5">
            <MousePointerClick className="h-3 w-3" />
            Click a field to insert its token
          </p>
          <div className="flex flex-wrap gap-1">
            {currentSource.fields.map((f: string) => (
              <button key={f}
                onClick={() => insertToken(f)}
                title={`Insert {${f}}`}
                className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-0.5">
                <Plus className="h-2 w-2" />{f}
              </button>
            ))}
          </div>
        </div>
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
          {activeSource === "exam_result" && !examId && (
            <p className="text-[10px] text-muted-foreground mt-1">Select an exam above first</p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5 max-h-[calc(100vh-460px)] overflow-y-auto">
            {records.map((record: any) => (
              <button
                key={record.id}
                onClick={() => handleApply(record)}
                className={`w-full flex items-center gap-2.5 p-2.5 border rounded-lg transition-all text-left
                  ${appliedId === record.id
                    ? "border-green-500 bg-green-50"
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
          {records.length >= limit && (
            <Button variant="outline" size="sm" className="w-full h-7 text-xs"
              onClick={() => setLimit((l) => l + 50)}>
              Load 50 more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
