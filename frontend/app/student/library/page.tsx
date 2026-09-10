"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { Banknote, BookmarkCheck, Search } from "lucide-react";

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
  renewal_count?: number;
};

type Hold = {
  id: string;
  book_id: string;
  title?: string;
  status: string;
  queue_pos: number;
  pickup_deadline?: string | null;
};

type LibraryPayload = {
  catalog?: CatalogBook[];
  issued?: IssuedBook[];
  holds?: Hold[];
  outstanding_fines?: number;
};

/** Student → Library (FC-B OPAC): searchable catalog, my books with renew
 * countdown, my holds with queue position, outstanding fines. Backed by
 * GET /student/library?search= (+ POST /student/library/request which now
 * persists a real reservation). */
export default function StudentLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-library", search],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LibraryPayload>>("/student/library", {
        params: search ? { search } : undefined,
      });
      return res.data.data;
    },
  });

  const requestBook = async (bookId: string, title: string) => {
    setRequesting(bookId);
    setRequestNote(null);
    try {
      const r = await api.post("/student/library/request", { book_id: bookId });
      const pos = r.data?.data?.queue_pos;
      setRequestNote(
        pos
          ? `You're #${pos} in the queue for “${title}” — we'll notify you when it's ready.`
          : `Requested “${title}”.`,
      );
      await qc.invalidateQueries({ queryKey: ["student-library"] });
    } catch (e: any) {
      setRequestNote(
        e?.response?.data?.error || "Couldn't place the request — please try again later.",
      );
    } finally {
      setRequesting(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load the library" onRetry={() => refetch()} />;

  const catalog = data?.catalog || [];
  const issued = data?.issued || [];
  const holds = data?.holds || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="student" title="Library" />

      {(issued.length > 0 || (data?.outstanding_fines ?? 0) > 0) && (
        <Card>
          <CardHeader><CardTitle>My Books</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issued.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{b.title || "Book"}</p>
                    <p className="text-xs text-muted-foreground">
                      {(b.renewal_count ?? 0) > 0 ? `Renewed ${b.renewal_count}×` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Due {b.due_date || "—"}</span>
                    {b.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                  </div>
                </div>
              ))}
              {(data?.outstanding_fines ?? 0) > 0 && (
                <div className="flex items-center gap-2 pt-1 text-sm text-destructive">
                  <Banknote className="h-4 w-4" />
                  Outstanding fines: Rs {(data?.outstanding_fines || 0).toFixed(2)} — please clear at the library desk.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {holds.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BookmarkCheck className="h-4 w-4" /> My Holds</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {holds.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{h.title || "Book"}</p>
                  {h.status === "ready" ? (
                    <Badge>Ready — pick up by {h.pickup_deadline || "soon"}</Badge>
                  ) : (
                    <Badge variant="secondary">Queue #{h.queue_pos}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title or author…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7"
            />
          </div>
          {requestNote && (
            <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm">{requestNote}</p>
          )}
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books match your search.</p>
          ) : (
            <div className="space-y-2">
              {catalog.map((b) => {
                const alreadyHeld = holds.some(
                  (h) => h.book_id === b.id && h.status === "requested",
                );
                return (
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
                      {(b.available_copies || 0) <= 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={alreadyHeld || requesting === b.id}
                          onClick={() => requestBook(b.id, b.title)}
                        >
                          {alreadyHeld ? "Requested" : requesting === b.id ? "Requesting…" : "Request"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
