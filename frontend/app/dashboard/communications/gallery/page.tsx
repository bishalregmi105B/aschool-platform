"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { api, ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
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
    <PluginGate slug="notices">
      <GalleryContent />
    </PluginGate>
  );
}

function GalleryContent() {
  const [year, setYear] = useState<string>("all");
  const { data, isLoading } = useQuery({
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Image className="h-6 w-6" /> Gallery
          </h1>
          <p className="text-muted-foreground">Manage school photo albums and media</p>
        </div>
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={year === "all" ? "default" : "outline"} size="sm" onClick={() => setYear("all")}>
          All Years
        </Button>
        {years.map((value) => (
          <Button key={value} variant={year === value ? "default" : "outline"} size="sm" onClick={() => setYear(value)}>
            {value}
          </Button>
        ))}
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No gallery photos found for the selected year.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {files.map((file) => (
            <Card key={file.id}>
              <CardContent className="p-3">
                <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                  <img src={file.url} alt={file.original_name || "Gallery image"} className="h-full w-full object-cover" />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.original_name || "Gallery image"}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.created_at ? displayBS(file.created_at) : ""}
                    </p>
                  </div>
                  {file.folder ? <Badge variant="outline">{file.folder}</Badge> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
