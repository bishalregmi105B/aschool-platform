"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { api, ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  AOSEmptyState,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { displayBS } from "@/lib/nepali_date";

type GalleryFile = {
  id: string;
  url: string;
  original_name?: string | null;
  folder?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
};

export default function GalleryPage() {
  return (
    // E125: every /files/* endpoint is gated by the file_management plugin
    // (files.py @plugin_required("file_management")) — gating this page by
    // `notices` let schools with notices-but-no-file-management hit a raw 403.
    <PluginGate slug="file_management">
      <GalleryContent />
    </PluginGate>
  );
}

function GalleryContent() {
  const [year, setYear] = useState<string>("all");
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["gallery-files", year],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "image" });
      if (year !== "all") params.set("year", year);
      const response = await api.get<ApiResponse<GalleryFile[]>>(`/files/?${params.toString()}`);
      return response.data.data || [];
    },
  });

  const { data: allFiles } = useQuery({
    queryKey: ["gallery-files-years"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<GalleryFile[]>>("/files/?type=image");
      return response.data.data || [];
    },
  });

  const years = useMemo(() => {
    const values = new Set<string>();
    (allFiles || []).forEach((file) => {
      const parsed = file.created_at ? new Date(file.created_at) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        values.add(String(parsed.getFullYear()));
      }
    });
    return Array.from(values).sort((a, b) => Number(b) - Number(a));
  }, [allFiles]);

  const files = data || [];

  if (isLoading) return <AOSModuleLoadingState label="Loading gallery…" />;
    if (isError) {
      return (
        <AOSPage>
          <AOSPageHeader title="Gallery" />
          <AOSPageBody>
            <DataPanel className="max-w-2xl mx-auto">
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load gallery images. Please try again.</p>
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
        icon={<Image className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Gallery"
        subtitle={`${files.length} photo${files.length === 1 ? "" : "s"} in school media${year !== "all" ? ` · ${year}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/files">
                <Upload className="h-4 w-4 mr-2" /> Upload
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/files">
                <Plus className="h-4 w-4 mr-2" /> Create Album
              </Link>
            </Button>
          </div>
        }
      />
      <AOSPageBody>
        <FilterCommandBar>
          <Button variant={year === "all" ? "default" : "outline"} size="sm" onClick={() => setYear("all")}>
            All Years
          </Button>
          {years.map((value) => (
            <Button key={value} variant={year === value ? "default" : "outline"} size="sm" onClick={() => setYear(value)}>
              {value}
            </Button>
          ))}
        </FilterCommandBar>

        {files.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Image className="h-10 w-10" />}
              title="No gallery photos found"
              description="No gallery photos found for the selected year."
            />
          </DataPanel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <div key={file.id} className="win11-card p-3">
                <div className="aspect-[4/3] overflow-hidden rounded-md" style={{ background: "var(--w11-control-hover)" }}>
                  <img src={file.url} alt={file.original_name || "Gallery image"} className="h-full w-full object-cover" />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--w11-text-primary)" }}>{file.original_name || "Gallery image"}</p>
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                      {file.created_at ? displayBS(file.created_at) : ""}
                    </p>
                  </div>
                  {file.folder ? <span className="win11-chip subtle">{file.folder}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
