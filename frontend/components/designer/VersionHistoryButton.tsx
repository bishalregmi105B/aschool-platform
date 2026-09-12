"use client";

/**
 * VersionHistoryButton — browse/restore document revisions.
 * The backend snapshots every save (last 10 kept) and exposes
 *   GET  /design-studio/documents/:id/revisions
 *   POST /design-studio/documents/revisions/:revision_id/restore
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Loader2, RotateCcw } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Revision = {
  id: string;
  name: string;
  created_at: string;
  created_by?: string;
};

export function VersionHistoryButton({ docId, onRestored }: { docId: string | null; onRestored?: () => void }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const revisions = useQuery({
    queryKey: ["doc-revisions", docId],
    queryFn: async () => {
      const r = await api.get(`/design-studio/documents/${docId}/revisions`);
      return (r.data?.data ?? []) as Revision[];
    },
    enabled: open && !!docId,
  });

  const restore = useMutation({
    mutationFn: async (revisionId: string) => {
      await api.post(`/design-studio/documents/revisions/${revisionId}/restore`);
    },
    onSuccess: () => {
      toast.success("Revision restored — reloading design");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["designer-doc", docId] });
      onRestored?.();
    },
    onError: () => toast.error("Restore failed"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!docId} title={docId ? "Version history" : "Save the design first to track versions"}>
          <History className="h-3.5 w-3.5" /> History
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        {!docId ? (
          <div className="text-xs text-[var(--w11-text-secondary)] p-2">Save the design first — every save creates a restorable snapshot.</div>
        ) : revisions.isLoading ? (
          <div className="text-xs text-[var(--w11-text-secondary)] p-2 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading versions…</div>
        ) : !revisions.data?.length ? (
          <div className="text-xs text-[var(--w11-text-secondary)] p-2">No earlier versions yet. Each save keeps a snapshot (last 10).</div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--w11-text-tertiary)] px-1">Saved versions</div>
            {revisions.data.map((rev) => (
              <div key={rev.id} className="flex items-center gap-2 rounded-[var(--w11-radius-sm)] px-2 py-1.5 hover:bg-[var(--w11-control-hover)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{rev.name || "Version"}</p>
                  <div className="text-[10px] text-[var(--w11-text-tertiary)]">{new Date(rev.created_at).toLocaleString()}</div>
                </div>
                <Button
                  size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-1.5"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(rev.id)}
                >
                  <RotateCcw className="h-3 w-3" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
