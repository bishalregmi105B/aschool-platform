"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

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

  if (isLoading) return <PageLoader />;
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
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
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
