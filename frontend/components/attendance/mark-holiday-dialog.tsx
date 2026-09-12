"use client";

/**
 * MarkHolidayDialog — POST /attendance/holiday (A-33).
 * Every active student of the selected classes (or the whole school) gets a
 * `holiday` row so monthly registers stay complete. Shared by the main
 * attendance page and the subject attendance page.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { CalendarOff } from "lucide-react";

export function MarkHolidayDialog({
  open,
  onOpenChange,
  defaultClassId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClassId?: string;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [wholeSchool, setWholeSchool] = useState(true);
  const [classIds, setClassIds] = useState<string[]>(defaultClassId ? [defaultClassId] : []);

  useEffect(() => {
    if (open) {
      setClassIds(defaultClassId ? [defaultClassId] : []);
    }
  }, [open, defaultClassId]);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: open,
  });

  const toggleClass = (id: string) => {
    setClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const holidayMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/attendance/holiday", {
        date,
        class_ids: wholeSchool ? [] : classIds,
        note: note.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Holiday marked for ${data?.data?.date_bs || data?.data?.date} — ${data?.data?.marked ?? 0} register rows written.`,
      );
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["subject-attendance"] });
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Failed to mark the holiday");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" /> Mark Holiday
          </DialogTitle>
          <DialogDescription>
            Every active student of the selected classes (or the whole school)
            gets a holiday row so monthly registers stay complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <BSDateInput value={date} onChange={setDate} />
          </div>

          <div className="space-y-2">
            <Label>Scope</Label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="holiday-whole-school"
                checked={wholeSchool}
                onChange={(e) => setWholeSchool(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="holiday-whole-school" className="text-sm">
                Whole school
              </label>
            </div>
            {!wholeSchool && (
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto rounded-md border p-2">
                {(classes || []).map((c: { id: string; name: string }) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={classIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="h-4 w-4"
                    />
                    {c.name}
                  </label>
                ))}
                {(classes || []).length === 0 && (
                  <p className="col-span-2 text-xs text-muted-foreground">No classes found.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Dashain vacation"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => holidayMutation.mutate()}
            disabled={holidayMutation.isPending || !date || (!wholeSchool && classIds.length === 0)}
          >
            {holidayMutation.isPending ? "Marking…" : "Mark Holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
