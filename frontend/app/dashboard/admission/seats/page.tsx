"use client";

/**
 * S-A5 (A-09): enrollment seat caps per class — the cap the conversion flow
 * enforces with SELECT … FOR UPDATE (InstiKit displayed theirs; ours blocks).
 *
 * Rewritten (R5a) onto DataTable with inline editing — the cap cell is
 * double-click editable (Enter/blur commits, Escape cancels), replacing the
 * hand-rolled table + per-row input + Save button trio.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Armchair } from "lucide-react";
import { AppGate } from "@/lib/apps";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";
import { DataTable, type Column } from "@/components/ui/data-table";

interface SeatRow {
  id: string; // class_id — the table is class-keyed
  class_name: string;
  booked: number;
  max_seat: number;
  remaining: number | "∞";
}

export default function SeatsPage() {
  return (
    <AppGate slug="admission">
      <SeatsInner />
    </AppGate>
  );
}

function SeatsInner() {
  const qc = useQueryClient();

  const classes = useQuery({
    queryKey: ["admission-classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes", { params: { per_page: 100 } });
      const payload = res.data?.data;
      const rows = Array.isArray(payload) ? payload : (payload?.classes ?? []);
      return rows as { id: string; name: string }[];
    },
  });

  const seats = useQuery({
    queryKey: ["admission-seats"],
    queryFn: async () => {
      const res = await api.get("/admission/seats");
      return res.data.data.seats as {
        class_id: string;
        class_name?: string | null;
        max_seat?: number | null;
        booked?: number;
        remaining?: number | null;
      }[];
    },
  });

  const save = useMutation({
    mutationFn: async (row: { class_id: string; max_seat: number }) => {
      const res = await api.put("/admission/seats", row);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Seat cap saved");
      qc.invalidateQueries({ queryKey: ["admission-seats"] });
    },
    onError: () => toast.error("Save failed"),
  });

  const seatByClass = new Map<string, { max_seat?: number | null; booked?: number }>(
    (seats.data ?? []).map((s) => [s.class_id, s]),
  );

  const rows: SeatRow[] = (classes.data ?? []).map((k) => {
    const seat = seatByClass.get(k.id);
    const cap = seat?.max_seat ?? 0;
    const booked = seat?.booked ?? 0;
    return {
      id: k.id,
      class_name: k.name,
      booked,
      max_seat: cap,
      remaining: cap > 0 ? Math.max(cap - booked, 0) : "∞",
    };
  });

  const columns: Column<SeatRow>[] = [
    { key: "class_name", label: "Class", sortable: true, value: (r) => r.class_name },
    { key: "booked", label: "Booked", align: "right", sortable: true, value: (r) => r.booked },
    {
      key: "max_seat",
      label: "Cap (double-click to edit)",
      align: "right",
      editable: true,
      editType: "number",
      value: (r) => (r.max_seat > 0 ? r.max_seat : ""),
      render: (r) => (r.max_seat > 0 ? r.max_seat : "∞"),
    },
    {
      key: "remaining",
      label: "Remaining",
      align: "right",
      value: (r) => (r.remaining === "∞" ? -1 : r.remaining),
      render: (r) =>
        r.remaining === "∞" ? (
          "∞"
        ) : (
          <span style={{ color: r.remaining === 0 ? "#c42b1c" : undefined }}>{r.remaining}</span>
        ),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Armchair className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Enrollment Seat Caps"
        titleNe="भर्ना सिट सीमा"
        subtitle="Applications beyond the cap are rejected at conversion time — the office cannot over-admit a class."
        subtitleNe="सीमाभन्दा बढी आवेदन भर्ना हुँदा अस्वीकार हुन्छ — कक्षामा बढी विद्यार्थी भर्ना हुन सक्दैन।"
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={classes.isLoading || seats.isLoading}
            error={classes.isError || seats.isError ? "Failed to load seat data." : null}
            onRetry={() => {
              classes.refetch();
              seats.refetch();
            }}
            onCellEdit={(row, _colKey, value) => {
              const cap = Number(value);
              if (!Number.isFinite(cap) || cap < 1) {
                toast.error("Cap must be at least 1");
                return;
              }
              save.mutate({ class_id: row.id, max_seat: cap });
            }}
            exportFileName="admission-seat-caps"
            empty={{ title: "No classes yet", body: "Create classes first (Academics → Classes & Sections) to set seat caps." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
