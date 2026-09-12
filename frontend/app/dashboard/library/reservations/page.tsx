"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { BookmarkCheck } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

interface Reservation {
  id: string;
  book_id: string;
  book_title: string;
  student_id: string;
  student_name: string;
  status: string;
  queue_pos: number;
  requested_at: string | null;
  ready_at: string | null;
  pickup_deadline: string | null;
}

export default function ReservationsPage() {
  return <PluginGate slug="library"><ReservationsContent /></PluginGate>;
}

function ReservationsContent() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("requested");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library-reservations", status],
    queryFn: async () => {
      const r = await api.get("/library/reservations", { params: { status } });
      return (r.data?.data || []) as Reservation[];
    },
    retry: 1,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "ready" | "collect" | "cancel" }) =>
      (await api.post(`/library/reservations/${id}/${action}`, {})).data,
    onSuccess: (d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["library-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      toast.success(
        vars.action === "ready" ? "Hold marked ready for pickup"
        : vars.action === "collect" ? "Hold converted to an issue"
        : "Hold cancelled",
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Action failed"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading holds…" />;
  const rows = data || [];

  const COLUMNS: Column<Reservation>[] = [
    { key: "queue", label: "#", align: "right", value: (r) => r.queue_pos },
    { key: "book", label: "Book", sortable: true, value: (r) => r.book_title, render: (r) => (
      <span className="font-medium">{r.book_title}</span>
    ) },
    { key: "student", label: "Student", sortable: true, value: (r) => r.student_name, render: (r) => r.student_name },
    { key: "status", label: "Status", sortable: true, value: (r) => r.status, render: (r) => (
      <StatusChip status={r.status} className="capitalize" />
    ) },
    { key: "requested_at", label: "Requested", value: (r) => r.requested_at ?? "", render: (r) =>
      r.requested_at ? <span className="text-sm">{displayBS(r.requested_at.slice(0, 10))}</span> : "—" },
    { key: "pickup_deadline", label: "Pickup by", value: (r) => r.pickup_deadline ?? "", render: (r) =>
      r.pickup_deadline ? <span className="text-sm">{displayBS(r.pickup_deadline)}</span> : "—" },
    { key: "actions", label: "Actions", noExport: true, render: (r) => (
      <div className="flex gap-1">
        {r.status === "requested" && (
          <Button size="sm" variant="outline" disabled={act.isPending}
            onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: "ready" }); }}>
            Mark ready
          </Button>
        )}
        {r.status === "ready" && (
          <>
            <Button size="sm" disabled={act.isPending}
              onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: "collect" }); }}>
              <BookmarkCheck className="h-3 w-3 mr-1" /> Collect
            </Button>
            <Button size="sm" variant="outline" disabled={act.isPending}
              onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: "cancel" }); }}>
              Cancel
            </Button>
          </>
        )}
      </div>
    ) },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookmarkCheck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Holds &amp; Reservations"
        subtitle={`${rows.length} ${status === "requested" ? "waiting in queue" : "ready for pickup"}`}
        actions={
          <div className="flex gap-2">
            {["requested", "ready"].map((s) => (
              <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                {s === "requested" ? "Waiting" : "Ready for pickup"}
              </Button>
            ))}
          </div>
        }
      />
      <AOSPageBody>
        {isError ? (
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load reservations.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable<Reservation>
              columns={COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              searchable
              searchPlaceholder="Search book or student…"
              exportFileName="library-reservations"
              empty={{ icon: BookmarkCheck, title: "No holds in this state" }}
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
