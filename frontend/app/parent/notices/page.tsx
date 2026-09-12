"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";

type ParentNotice = {
  id: string;
  title: string;
  date?: string;
  published_at?: string;
};

/** Parent → Notices. Served from the parent dashboard payload's notice list. */
export default function ParentNoticesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ recent_notices?: ParentNotice[] }>>(
        "/parent/dashboard"
      );
      return res.data.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading…" />;
  if (isError)
    return <ErrorState title="Couldn't load notices" onRetry={() => refetch()} />;

  const notices = data?.recent_notices || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Notices" />
      <Card>
        <CardHeader><CardTitle>School Notices</CardTitle></CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notices for parents yet.</p>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="flex items-start gap-3 border-b py-2 last:border-0">
                  <div className="w-2 h-2 mt-2" style={{ background: "var(--w11-accent)", borderRadius: "var(--w11-radius-full)" }} />
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.date || n.published_at || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
