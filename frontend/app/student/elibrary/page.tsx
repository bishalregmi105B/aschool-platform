"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type Ebook = { id: string; title: string; subject?: string; file_size?: string | null };
type Resource = { id: string; title?: string; url?: string; resource_type?: string };

type ElibraryPayload = {
  ebooks?: Ebook[];
  past_papers?: Ebook[];
  resources?: Resource[];
};

/** Student → E-Library. Backed by GET /student/elibrary (gated by the elibrary plugin). */
export default function StudentElibraryPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-elibrary"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ElibraryPayload>>("/student/elibrary");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load the e-library" onRetry={() => refetch()} />;

  const ebooks = data?.ebooks || [];
  const papers = data?.past_papers || [];
  const resources = data?.resources || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="E-Library" />
      <Card>
        <CardHeader><CardTitle>Digital Books</CardTitle></CardHeader>
        <CardContent>
          {ebooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No digital books published yet.</p>
          ) : (
            <div className="space-y-2">
              {ebooks.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{b.title}</p>
                    {b.subject && <p className="text-xs text-muted-foreground">{b.subject}</p>}
                  </div>
                  <Badge variant="outline">eBook</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {papers.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Past Papers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {papers.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <Badge variant="outline">Past paper</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {resources.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Learning Resources</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{r.title || "Resource"}</p>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      Open →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
