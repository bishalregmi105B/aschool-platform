"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type CatalogBook = {
  id: string;
  title: string;
  author?: string;
  category?: string;
  available_copies?: number;
};

type IssuedBook = {
  id: string;
  title?: string;
  due_date?: string;
  is_overdue?: boolean;
};

type LibraryPayload = {
  catalog?: CatalogBook[];
  issued?: IssuedBook[];
};

/** Student → Library. Backed by GET /student/library (+ POST /student/library/request). */
export default function StudentLibraryPage() {
  const qc = useQueryClient();
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-library"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LibraryPayload>>("/student/library");
      return res.data.data;
    },
  });

  const requestBook = async (bookId: string, title: string) => {
    setRequesting(bookId);
    setRequestNote(null);
    try {
      await api.post("/student/library/request", { book_id: bookId });
      setRequestNote(`Requested “${title}” — collect it from the library desk.`);
      await qc.invalidateQueries({ queryKey: ["student-library"] });
    } catch {
      setRequestNote("Couldn't place the request — the copy may have run out.");
    } finally {
      setRequesting(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load the library" onRetry={() => refetch()} />;

  const catalog = data?.catalog || [];
  const issued = data?.issued || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="Library" />

      {issued.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My Issued Books</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issued.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{b.title || "Book"}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Due {b.due_date || "—"}</span>
                    {b.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
        <CardContent>
          {requestNote && (
            <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm">{requestNote}</p>
          )}
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books in the catalog yet.</p>
          ) : (
            <div className="space-y-2">
              {catalog.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.author || ""}
                      {b.category ? ` • ${b.category}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={(b.available_copies || 0) > 0 ? "success" : "outline"}>
                      {(b.available_copies || 0) > 0 ? `${b.available_copies} available` : "All issued"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!b.available_copies || requesting === b.id}
                      onClick={() => requestBook(b.id, b.title)}
                    >
                      {requesting === b.id ? "Requesting…" : "Request"}
                    </Button>
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
