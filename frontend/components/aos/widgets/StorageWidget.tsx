"use client";

import { useQuery } from "@tanstack/react-query";
import { HardDrive, FolderOpen } from "lucide-react";
import { getStorageUsage, type StorageUsage } from "@/lib/services/files.service";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DataPanel, AOSEmptyState } from "@/components/aos/kit/page-kit";
import { WidgetLink, WidgetError, formatBytes, type AOSWidgetProps } from "./shared";

/** Fixed palette for the per-type usage segments (Fluent-ish hues). */
const SEGMENT_COLORS = [
  "var(--w11-accent)",
  "#107c10",
  "#d83b01",
  "#8b5cf6",
  "#f7630c",
  "#c42b1c",
];

/**
 * storage — file storage usage from GET /files/usage
 * (lib/services/files.service). A segmented bar shows how the used bytes
 * split across file types, with totals above it.
 */
export default function StorageWidget({ compact = false, onOpenRoute }: AOSWidgetProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["aos-widget", "storage"],
    queryFn: (): Promise<StorageUsage> => getStorageUsage(),
    retry: 1,
  });

  const breakdown = [...(data?.breakdown ?? [])].sort(
    (a, b) => (b.total_bytes ?? 0) - (a.total_bytes ?? 0)
  );
  const visibleBreakdown = compact ? breakdown.slice(0, 4) : breakdown;

  return (
    <DataPanel
      title={
        <span className="inline-flex items-center gap-2">
          <HardDrive className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
          Storage
        </span>
      }
      actions={
        <WidgetLink
          href="/dashboard/files"
          onOpenRoute={onOpenRoute}
          className="text-[11px] hover:underline"
          style={{ color: "var(--w11-accent)" }}
        >
          Files
        </WidgetLink>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-2.5 w-full" />
          <SkeletonText lines={compact ? 1 : 2} />
        </div>
      ) : isError ? (
        <WidgetError
          title="Couldn't load storage usage"
          body="File storage stats are unavailable right now."
          onRetry={() => refetch()}
        />
      ) : !data || data.total_files === 0 ? (
        <AOSEmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="No files uploaded yet"
          description="Storage usage and its breakdown will appear once files are uploaded."
          action={
            <WidgetLink
              href="/dashboard/files"
              onOpenRoute={onOpenRoute}
              className="win11-chip"
              style={{ color: "var(--w11-accent)" }}
            >
              Open files
            </WidgetLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold leading-none" style={{ color: "var(--w11-text-primary)" }}>
              {formatBytes(data.total_bytes)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
              across {data.total_files} {data.total_files === 1 ? "file" : "files"}
            </span>
          </div>

          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--w11-border-default)" }}
            role="img"
            aria-label={`Storage usage by file type, ${formatBytes(data.total_bytes)} total`}
          >
            {visibleBreakdown.map((segment, i) => {
              const pct =
                data.total_bytes > 0 ? (segment.total_bytes / data.total_bytes) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <span
                  key={segment.file_type}
                  title={`${segment.file_type}: ${formatBytes(segment.total_bytes)} (${Math.round(pct)}%)`}
                  style={{
                    width: `${pct}%`,
                    background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {visibleBreakdown.map((segment, i) => (
              <span
                key={segment.file_type}
                className="flex items-center gap-1.5 text-[11px]"
                style={{ color: "var(--w11-text-secondary)" }}
              >
                <span
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
                {segment.file_type} · {formatBytes(segment.total_bytes)}
              </span>
            ))}
          </div>
        </div>
      )}
    </DataPanel>
  );
}
