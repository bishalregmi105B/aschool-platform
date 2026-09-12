"use client";

/**
 * S-A5 (A-09): enrollment seat caps per class — the cap the conversion flow
 * enforces with SELECT … FOR UPDATE (InstiKit displayed theirs; ours blocks).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PluginGate } from "@/lib/plugins";

interface SeatRow {
  id?: string;
  class_id: string;
  class_name?: string | null;
  academic_year_id?: string | null;
  max_seat?: number | null;
  booked?: number;
  remaining?: number | null;
}

export default function SeatsPage() {
  return (
    <PluginGate slug="admission">
      <SeatsInner />
    </PluginGate>
  );
}

function SeatsInner() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});

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
      return res.data.data.seats as SeatRow[];
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

  const seatByClass = new Map<string, SeatRow>(
    (seats.data ?? []).map((s) => [s.class_id, s])
  );

  if (classes.isLoading || seats.isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="animate-spin text-[#0e3b2e]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-[#0e3b2e]">
        Enrollment Seat Caps
      </h1>
      <p className="text-sm text-[#0d1f14]/60">
        Applications beyond the cap are rejected at conversion time — the
        office cannot over-admit a class.
      </p>
      <div className="rounded-xl border border-[#0e3b2e]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0e3b2e] text-[#c5f4dd]">
            <tr>
              <th className="text-left px-4 py-2">Class</th>
              <th className="text-center px-4 py-2">Booked</th>
              <th className="text-center px-4 py-2">Cap</th>
              <th className="text-center px-4 py-2">Remaining</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(classes.data ?? []).map((k) => {
              const seat = seatByClass.get(k.id);
              const editKey = k.id;
              const value = edits[editKey] ?? seat?.max_seat ?? 0;
              const booked = seat?.booked ?? 0;
              const remaining =
                value > 0 ? Math.max(value - booked, 0) : (seat?.remaining ?? "∞");
              return (
                <tr key={k.id} className="border-t border-[#0e3b2e]/10">
                  <td className="px-4 py-2">{k.name}</td>
                  <td className="text-center">{booked}</td>
                  <td className="text-center">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={value || ""}
                      onChange={(e) =>
                        setEdits({ ...edits, [editKey]: Number(e.target.value) })
                      }
                      className="w-20 mx-auto"
                      placeholder="∞"
                    />
                  </td>
                  <td className="text-center">{remaining}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      disabled={save.isPending || !value || value < 1}
                      onClick={() =>
                        save.mutate({ class_id: k.id, max_seat: value })
                      }
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
