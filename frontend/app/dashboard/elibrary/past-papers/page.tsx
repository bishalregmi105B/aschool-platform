"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Download, FileText, Search, GraduationCap } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import { useDebounced } from "@/components/ui/filter-bar";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

export default function PastPapersPage() {
  return <AppGate slug="elibrary"><PastPapersContent /></AppGate>;
}

function PastPapersContent() {
  const { t } = useI18n();
  // Wave C (plan 34-25): subject/class/year filters are URL state (?subject=&cls=)
  // so a filtered paper list is shareable; text search is local + debounced.
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const setRouteFilter = (patch: Record<string, string>) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/elibrary/past-papers";
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };
  const subject = routeParams.get("subject") || "";
  const classFilter = routeParams.get("cls") || "";
  const yearFilter = routeParams.get("year") || "";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);

  // Backend route is GET /elibrary/papers (no query filters) — search/subject
  // are applied client-side. The old path /elibrary/past-papers was a 404.
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["past-papers"],
    queryFn: async () => { const r = await api.get("/elibrary/papers"); return r.data?.data ?? r.data; },
  });

  const allPapers: any[] = Array.isArray(data) ? data : data?.items ?? [];
  const papers: any[] = allPapers.filter((p) => {
    if (debouncedSearch && !String(p.title || "").toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (subject && p.subject !== subject) return false;
    if (classFilter && p.class_name !== classFilter) return false;
    if (yearFilter && String(p.year ?? "") !== yearFilter) return false;
    return true;
  });
  const years = Array.from(new Set(allPapers.map((p) => String(p.year ?? "")).filter(Boolean))).sort().reverse();
  const isFiltered = !!subject || !!classFilter || !!yearFilter || !!debouncedSearch;

  if (isLoading)
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("Past Papers", "पुराना प्रश्नपत्रहरू")}
          subtitle={t("Previous exam papers and answer sheets", "अघिल्ला परीक्षाका प्रश्नपत्र र उत्तरपुस्तिका")}
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
          icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title={t("Past Papers", "पुराना प्रश्नपत्रहरू")}
          subtitle={t("Previous exam papers and answer sheets", "अघिल्ला परीक्षाका प्रश्नपत्र र उत्तरपुस्तिका")}
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load past papers. Please try again.", "प्रश्नपत्र लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<GraduationCap className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Past Papers", "पुराना प्रश्नपत्रहरू")}
        subtitle={`${papers.length}/${allPapers.length} ${t("papers", "प्रश्नपत्र")}`}
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--w11-text-secondary)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search papers…", "प्रश्नपत्र खोज्नुहोस्…")} className="pl-8 h-9" />
          </div>
          <AdvancedSelect className="w-36" triggerClassName="h-8 text-xs" value={subject} onChange={(v) => setRouteFilter({ subject: v || "" })} clearable placeholder={t("All Subjects", "सबै विषय")}
            options={[
              { value: "Mathematics", label: "Mathematics" },
              { value: "Science", label: "Science" },
              { value: "English", label: "English" },
              { value: "Nepali", label: "Nepali" },
              { value: "Social", label: "Social Studies" },
            ]}
          />
          <AdvancedSelect className="w-36" triggerClassName="h-8 text-xs" value={classFilter} onChange={(v) => setRouteFilter({ cls: v || "" })} clearable placeholder={t("All Classes", "सबै कक्षा")}
            options={["1","2","3","4","5","6","7","8","9","10","11","12"].map((c) => ({ value: `Class ${c}`, label: `Class ${c}` }))}
          />
          <AdvancedSelect className="w-28" triggerClassName="h-8 text-xs" value={yearFilter} onChange={(v) => setRouteFilter({ year: v || "" })} clearable placeholder={t("All years", "सबै वर्ष")}
            options={years.map((y) => ({ value: y, label: y }))}
          />
          {isFiltered && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setRouteFilter({ subject: "", cls: "", year: "" }); }}>
              {t("Clear", "खाली")}</Button>
          )}
        </FilterCommandBar>

        {papers.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<FileText className="h-12 w-12" style={{ color: "var(--w11-text-tertiary)" }} />}
              title={isFiltered ? t("No papers match these filters", "यी फिल्टरसँग मिल्ने प्रश्नपत्र भेटिएन") : t("No past papers yet", "अझै प्रश्नपत्र छैन")}
              description={t("Upload previous exam papers from the Upload Resources page.", "Upload Resources पानाबाट पुराना प्रश्नपत्र अपलोड गर्नुहोस्।")}
              action={isFiltered
                ? { label: t("Clear filters", "फिल्टर हटाउनुहोस्"), onClick: () => { setSearch(""); setRouteFilter({ subject: "", cls: "", year: "" }); } }
                : { label: t("Upload papers", "अपलोड गर्नुहोस्"), href: "/dashboard/elibrary/upload" }}
            />
          </DataPanel>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {papers.map((p: any) => (
              <div key={p.id} className="win11-card" style={{ marginBottom: 0 }}>
                <div className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "var(--w11-accent-light)", color: "var(--w11-accent)" }}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="win11-chip subtle text-[10px]">{p.year ?? "—"}</span>
                  </div>
                  <p className="font-medium text-sm mt-3 line-clamp-2" title={p.title}>{p.title}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.subject && <span className="win11-chip subtle text-[10px]">{p.subject}</span>}
                    {p.class_name && <span className="win11-chip subtle text-[10px]">{p.class_name}</span>}
                    {p.exam_type && <span className="win11-chip subtle text-[10px]">{p.exam_type}</span>}
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>{p.pages ? `${p.pages} pp.` : ""}</span>
                    {p.file_url ? (
                      <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5 mr-1" />{t("Open", "खोल्नुहोस्")}</a>
                      </Button>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>{t("No file", "फाइल छैन")}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
