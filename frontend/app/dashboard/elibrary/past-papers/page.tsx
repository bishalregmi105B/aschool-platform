"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Download, BookOpen } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

export default function PastPapersPage() {
  return <PluginGate slug="elibrary"><PastPapersContent /></PluginGate>;
}

function PastPapersContent() {
  // Radix Select forbids empty-string item values — the old
  // <SelectItem value="">All …</SelectItem> threw
  // "A <Select.Item /> must have a value prop that is not an empty string"
  // and crashed the whole page (React error boundary). Use an "all" sentinel.
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  // Backend route is GET /elibrary/papers (no query filters) — search/subject
  // are applied client-side. The old path /elibrary/past-papers was a 404.
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["past-papers"],
    queryFn: async () => { const r = await api.get("/elibrary/papers"); return r.data?.data ?? r.data; },
  });

  const allPapers: any[] = Array.isArray(data) ? data : data?.items ?? [];
  const papers: any[] = allPapers.filter((p) => {
    if (search && !String(p.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (subject !== "all" && p.subject !== subject) return false;
    if (classFilter !== "all" && p.class_name !== classFilter) return false;
    return true;
  });

  const PAPER_COLUMNS: Column<any>[] = [
    { key: "title", label: "Title", sortable: true, value: (p) => p.title ?? "", render: (p) => <span className="font-medium">{p.title}</span> },
    { key: "subject", label: "Subject", sortable: true, value: (p) => p.subject ?? "", render: (p) => <span className="win11-chip">{p.subject}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (p) => p.class_name ?? "", render: (p) => p.class_name ?? "—" },
    { key: "year", label: "Year", align: "right", sortable: true, value: (p) => p.year ?? 0, render: (p) => p.year ?? "—" },
    { key: "exam_type", label: "Exam Type", value: (p) => p.exam_type ?? "", render: (p) => p.exam_type ?? "—" },
    { key: "pages", label: "Pages", align: "right", sortable: true, value: (p) => p.pages ?? 0, render: (p) => p.pages ?? "—" },
    {
      key: "file_url",
      label: "Action",
      noExport: true,
      render: (p) => (p.file_url ? (
        <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
          <a href={p.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3 mr-1" />Download</a>
        </Button>
      ) : <span className="text-[color:var(--w11-text-secondary)] text-sm">No file</span>),
    },
  ];

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Past Papers"
          subtitle="Previous exam papers and answer sheets"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load past papers. Please try again.</p>
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
        title="Past Papers"
        subtitle="Previous exam papers and answer sheets"
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={PAPER_COLUMNS}
            rows={papers}
            rowKey={(p: any) => p.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search papers..."
            exportFileName="past-papers"
            toolbar={
              <div className="flex gap-2">
                <AdvancedSelect className="w-36" triggerClassName="h-8 text-xs" value={subject} onChange={setSubject} clearable placeholder="All Subjects"
                  options={[
                    { value: "Mathematics", label: "Mathematics" },
                    { value: "Science", label: "Science" },
                    { value: "English", label: "English" },
                    { value: "Nepali", label: "Nepali" },
                    { value: "Social", label: "Social Studies" },
                  ]}
                />
                <AdvancedSelect className="w-36" triggerClassName="h-8 text-xs" value={classFilter} onChange={setClassFilter} clearable placeholder="All Classes"
                  options={["1","2","3","4","5","6","7","8","9","10","11","12"].map((c) => ({ value: `Class ${c}`, label: `Class ${c}` }))}
                />
              </div>
            }
            empty={{ icon: BookOpen, title: "No past papers found", body: "Upload previous exam papers from the Upload Resources page." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
