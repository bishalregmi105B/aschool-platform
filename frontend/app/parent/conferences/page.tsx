"use client";

/**
 * Parent → PT Conferences (rewritten, R4d).
 *
 * Was broken against the real payload: it typed `available_slots` as a slot
 * LIST, but the backend sends a COUNT. The payload now also carries a
 * `slots` list (added this wave): [{slot_id, start_time, end_time,
 * teacher_name}] of bookable slots. Booking sends the selected child's
 * student_id so the teacher knows which child the meeting is about.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";
import { useSelectedChild, ChildSwitcher } from "@/components/portal/child-switcher";
import { Users } from "lucide-react";

type Slot = {
  slot_id: string;
  start_time?: string | null;
  end_time?: string | null;
  teacher_name?: string | null;
};

type BookedSlot = {
  slot_id: string;
  start_time?: string | null;
  end_time?: string | null;
  teacher_name?: string | null;
  student_id?: string | null;
};

type Conference = {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_virtual?: boolean;
  meeting_link?: string | null;
  total_slots?: number;
  available_slots?: number; // COUNT
  slots?: Slot[]; // bookable list
  booked_slot?: BookedSlot | null;
};

function fmtSlot(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function ParentConferencesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { selected } = useSelectedChild();
  const [booking, setBooking] = useState<string | null>(null); // "confId:slotId"
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-conferences", selected?.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Conference[]>>("/parent/conferences", {
        params: selected?.id ? { student_id: selected.id } : undefined,
      });
      return res.data.data || [];
    },
  });

  const book = async (conf: Conference, slot: Slot) => {
    setBooking(`${conf.id}:${slot.slot_id}`);
    setError(null);
    try {
      await api.post(`/parent/conferences/${conf.id}/book`, {
        slot_id: slot.slot_id,
        ...(selected?.id ? { student_id: selected.id } : {}),
      });
      setNote(
        t("Slot booked — the teacher can see your booking.", "समय बुक भयो — शिक्षकले देख्न सक्नुहुन्छ।"),
      );
      await qc.invalidateQueries({ queryKey: ["parent-conferences"] });
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t("Couldn't book that slot — it may have just been taken.", "बुक गर्न सकिएन — समयभरि भइसकेको हुन सक्छ।"),
      );
    } finally {
      setBooking(null);
    }
  };

  if (isLoading) return <AOSModuleLoadingState label={t("Loading…", "लोड हुँदै…")} />;
  if (isError)
    return <ErrorState title={t("Couldn't load conferences", "भेटघाट लोड गर्न सकिएन")} onRetry={() => refetch()} />;

  const conferences = data || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("PT Conferences", "अभिभावक-शिक्षक भेट")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("Book a time to meet your child's teacher.", "शिक्षकसँग भेट्न समय बुक गर्नुहोस्।")}
        </p>
      </div>

      <ChildSwitcher />

      {note && (
        <p className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--w11-control-hover)", color: "var(--w11-text-primary)" }}>
          {note}
        </p>
      )}
      {error && (
        <p className="rounded-md border px-3 py-2 text-sm" style={{ background: "#fde7e9", borderColor: "#c42b1c55", color: "#8a1f17" }}>
          {error}
        </p>
      )}

      {conferences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8" style={{ color: "var(--w11-text-secondary)" }} />
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              {t(
                "No conferences scheduled. When a teacher opens booking, slots appear here.",
                "कुनै भेटघाट तालिकाबद्ध छैन। शिक्षकले बुकिङ खोलेपछि यहाँ देखिन्छ।",
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        conferences.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {c.title}
                {c.is_virtual && <Badge variant="outline">{t("Virtual", "भर्चुअल")}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                {c.start_date || ""}
                {c.end_date && c.end_date !== c.start_date ? ` – ${c.end_date}` : ""}
                {typeof c.available_slots === "number"
                  ? ` · ${c.available_slots}/${c.total_slots ?? "?"} ${t("slots open", "समय खुला")}`
                  : ""}
              </p>
              {c.description && <p className="text-sm">{c.description}</p>}

              {c.booked_slot ? (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="success">{t("Booked", "बुक भयो")}</Badge>
                  <span>{fmtSlot(c.booked_slot.start_time)}</span>
                  {c.booked_slot.teacher_name && (
                    <span style={{ color: "var(--w11-text-secondary)" }}>
                      · {c.booked_slot.teacher_name}
                    </span>
                  )}
                  {c.is_virtual && c.meeting_link && (
                    <a
                      href={c.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--w11-accent)] hover:underline"
                    >
                      {t("Join link", "जोइन लिंक")}
                    </a>
                  )}
                </p>
              ) : (c.slots || []).length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {c.slots!.map((s) => (
                    <Button
                      key={s.slot_id}
                      size="sm"
                      variant="outline"
                      className="h-auto min-h-[52px] flex-col items-start py-2 text-left"
                      disabled={booking === `${c.id}:${s.slot_id}`}
                      onClick={() => book(c, s)}
                    >
                      <span className="font-semibold">{fmtSlot(s.start_time)}</span>
                      {s.teacher_name && (
                        <span className="text-[11px] font-normal opacity-70">{s.teacher_name}</span>
                      )}
                      {booking === `${c.id}:${s.slot_id}` && (
                        <span className="text-[11px] font-normal opacity-70">
                          {t("Booking…", "बुक हुँदै…")}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
                  {t("No open slots.", "खुला समय छैन।")}
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
