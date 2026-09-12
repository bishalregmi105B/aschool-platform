"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";

type Slot = { id: string; start_time?: string; end_time?: string };

type Conference = {
  id: string;
  title: string;
  description?: string;
  teacher_name?: string;
  start_date?: string;
  end_date?: string;
  is_virtual?: boolean;
  meeting_link?: string;
  available_slots?: Slot[];
  total_slots?: number;
  booked_slot?: Slot | null;
  slot_id?: string | null;
};

/** Parent → PT Conferences. Backed by GET /parent/conferences + POST /parent/conferences/<id>/book. */
export default function ParentConferencesPage() {
  const qc = useQueryClient();
  const [booking, setBooking] = useState<string | null>(null); // "confId:slotId"
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-conferences"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conference[]>>("/parent/conferences");
      return res.data.data || [];
    },
  });

  const book = async (conf: Conference, slotId: string) => {
    setBooking(`${conf.id}:${slotId}`);
    setError(null);
    try {
      await api.post(`/parent/conferences/${conf.id}/book`, { slot_id: slotId });
      setNote("Slot booked — the teacher can see your booking.");
      await qc.invalidateQueries({ queryKey: ["parent-conferences"] });
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Couldn't book that slot — it may have just been taken."
      );
    } finally {
      setBooking(null);
    }
  };

  if (isLoading) return <AOSModuleLoadingState label="Loading…" />;
  if (isError)
    return <ErrorState title="Couldn't load conferences" onRetry={() => refetch()} />;

  const conferences = data || [];

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="PT Conferences" />
      {note && <p className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--w11-control-hover)", color: "var(--w11-text-primary)" }}>{note}</p>}
      {error && <p className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--w11-control-hover)", color: "var(--w11-text-primary)" }}>{error}</p>}
      {conferences.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No conferences scheduled. When a teacher opens booking, slots appear here.
          </CardContent>
        </Card>
      ) : (
        conferences.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {c.title}
                {c.is_virtual && <Badge variant="outline">Virtual</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {c.teacher_name ? `${c.teacher_name} • ` : ""}
                {c.start_date || ""}{c.end_date && c.end_date !== c.start_date ? ` – ${c.end_date}` : ""}
              </p>
              {c.description && <p className="text-sm">{c.description}</p>}
              {c.booked_slot || c.slot_id ? (
                <p className="text-sm">
                  <Badge variant="success">Booked</Badge>{" "}
                  <span className="ml-2">
                    {c.booked_slot?.start_time || c.slot_id}
                  </span>
                  {c.is_virtual && c.meeting_link && (
                    <a href={c.meeting_link} target="_blank" rel="noopener noreferrer" className="ml-3 text-primary hover:underline">
                      Join link
                    </a>
                  )}
                </p>
              ) : (c.available_slots || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(c.available_slots ?? []).map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant="outline"
                      disabled={booking === `${c.id}:${s.id}`}
                      onClick={() => book(c, s.id)}
                    >
                      {booking === `${c.id}:${s.id}` ? "Booking…" : s.start_time || s.id.slice(0, 8)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No open slots.</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
