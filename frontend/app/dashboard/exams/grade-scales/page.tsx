"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ScrollText, Plus, Star, Trash2 } from "lucide-react";

// ── Types (GET/POST /exams/grade-scales) ────────────────────────────────────
interface GradeScaleRow {
  grade_name: string;
  gpa: number;
  percent_from: number;
  percent_upto?: number | null;
  description?: string;
}

interface GradeScale {
  id: string;
  name: string;
  board: string | null;
  is_default: boolean;
  rows: GradeScaleRow[];
}

/** Editable draft row — everything stays strings while typing. */
interface DraftRow {
  grade_name: string;
  gpa: string;
  percent_from: string;
  description: string;
}

function toDraftRows(rows: GradeScaleRow[]): DraftRow[] {
  return rows.map((r) => ({
    grade_name: r.grade_name ?? "",
    gpa: String(r.gpa ?? ""),
    percent_from: String(r.percent_from ?? ""),
    description: r.description ?? "",
  }));
}

export default function GradeScalesPage() {
  return (
    <PluginGate slug="exams">
      <GradeScalesContent />
    </PluginGate>
  );
}

function GradeScalesContent() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GradeScale | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["grade-scales"],
    queryFn: async () => {
      const res = await api.get("/exams/grade-scales");
      return (res.data?.data?.scales || []) as GradeScale[];
    },
    retry: 1,
  });

  const scales = data || [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (scale: GradeScale) => {
    setEditing(scale);
    setDialogOpen(true);
  };

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ScrollText className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Grade Scales"
        subtitle={`${scales.length} scales · School grading scales (NEB, SEE or custom) used for results, report cards and the tabulation sheet`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Scale
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel>
          {isLoading ? (
            <AOSModuleLoadingState label="Loading grade scales…" />
          ) : isError ? (
            <ErrorState
              body="Failed to load grade scales. Please try again."
              onRetry={() => refetch()}
              size="sm"
            />
          ) : scales.length === 0 ? (
            <EmptyState
              size="sm"
              icon={ScrollText}
              title="No grade scales yet"
              body="Create a scale (e.g. NEB Letter Grading 2078) or use the built-in NEB default."
              action={{ label: "Create a scale", onClick: openCreate }}
            />
          ) : (
            <DataTable<GradeScale>
              columns={SCALE_COLUMNS}
              rows={scales}
              rowKey={(s) => s.id}
              onRowClick={openEdit}
              exportFileName="grade-scales"
              empty={{ icon: ScrollText, title: "No scales" }}
            />
          )}
        </DataPanel>

        <GradeScaleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["grade-scales"] })}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

const SCALE_COLUMNS: Column<GradeScale>[] = [
  {
    key: "name",
    label: "Scale",
    sortable: true,
    value: (s) => s.name,
    render: (s) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {s.name}
        {s.is_default && (
          <span className="win11-chip warning">
            <Star className="h-3 w-3" /> Default
          </span>
        )}
      </span>
    ),
  },
  {
    key: "board",
    label: "Board",
    sortable: true,
    value: (s) => s.board ?? "",
    render: (s) => s.board || "custom",
  },
  {
    key: "bands",
    label: "Bands",
    align: "right",
    value: (s) => s.rows?.length ?? 0,
    render: (s) => `${s.rows?.length ?? 0} bands`,
  },
  {
    key: "range",
    label: "Top band",
    value: (s) => {
      const top = [...(s.rows || [])].sort((a, b) => (b.percent_from ?? 0) - (a.percent_from ?? 0))[0];
      return top ? `${top.grade_name} @ ${top.percent_from}%` : "—";
    },
    render: (s) => {
      const top = [...(s.rows || [])].sort((a, b) => (b.percent_from ?? 0) - (a.percent_from ?? 0))[0];
      if (!top) return "—";
      return `${top.grade_name} · GPA ${Number(top.gpa ?? 0).toFixed(1)} · ≥${top.percent_from}%`;
    },
  },
];

function GradeScaleDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: GradeScale | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [board, setBoard] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setBoard(editing?.board && editing.board !== "custom" ? editing.board : "");
      setIsDefault(Boolean(editing?.is_default));
      setRows(
        editing?.rows?.length
          ? toDraftRows(editing.rows)
          : [
              { grade_name: "A+", gpa: "4.0", percent_from: "90", description: "Outstanding" },
              { grade_name: "A", gpa: "3.6", percent_from: "80", description: "Excellent" },
              { grade_name: "NG", gpa: "0", percent_from: "0", description: "Not Graded" },
            ],
      );
    }
  }, [open, editing]);

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // ── Validation hints (the backend rejects: <2 rows, last band not 0,
  // non-descending percent_from) ──
  const parsed = rows.map((r) => ({
    grade_name: r.grade_name.trim(),
    gpa: parseFloat(r.gpa),
    percent_from: parseFloat(r.percent_from),
  }));
  const hints: string[] = [];
  if (rows.length < 2) hints.push("At least 2 grade bands are required.");
  parsed.forEach((r, i) => {
    if (!r.grade_name) hints.push(`Row ${i + 1}: grade name is required.`);
    if (Number.isNaN(r.percent_from) || r.percent_from < 0 || r.percent_from > 100)
      hints.push(`Row ${i + 1}: from-% must be between 0 and 100.`);
    if (Number.isNaN(r.gpa)) hints.push(`Row ${i + 1}: GPA must be a number.`);
  });
  const sorted = [...parsed].sort((a, b) => b.percent_from - a.percent_from);
  if (sorted.length >= 2 && sorted[sorted.length - 1].percent_from !== 0) {
    hints.push("The last band must include 0% (e.g. NG @ 0).");
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].percent_from <= sorted[i + 1].percent_from) {
      hints.push("From-% values must be strictly descending (no duplicates).");
      break;
    }
  }
  const duplicateNames = parsed.some(
    (r, i) => parsed.findIndex((o) => o.grade_name && o.grade_name === r.grade_name) !== i,
  );
  if (duplicateNames) hints.push("Grade names must be unique.");
  const canSave = name.trim().length > 0 && rows.length >= 2 && hints.length === 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/exams/grade-scales", {
        name: name.trim(),
        board: board.trim() || undefined,
        is_default: isDefault,
        rows: rows.map((r) => ({
          grade_name: r.grade_name.trim(),
          gpa: parseFloat(r.gpa) || 0,
          percent_from: parseFloat(r.percent_from) || 0,
          description: r.description.trim(),
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(editing ? "Grade scale updated" : "Grade scale created");
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      toast.error(typeof msg === "string" ? msg : "Failed to save the grade scale");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Grade Scale" : "New Grade Scale"}</DialogTitle>
          <DialogDescription>
            Define the grade bands top-down: letter grade, GPA and the from-%
            boundary. The lowest band must cover 0%.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Scale name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NEB Letter Grading 2078"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Board</Label>
            <Input
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              placeholder="e.g. NEB (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default scale</Label>
            <div className="flex h-9 items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <span className="text-xs text-[color:var(--w11-text-secondary)]">
                Use this scale for results and report cards
              </span>
            </div>
          </div>
        </div>

        {/* Row editor */}
        <div className="rounded-lg border border-[var(--w11-border-subtle)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow style={{ background: "var(--w11-control-hover)" }}>
                <TableHead className="w-32">Grade</TableHead>
                <TableHead className="w-24">GPA</TableHead>
                <TableHead className="w-24">From %</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={row.grade_name}
                      onChange={(e) => updateRow(idx, { grade_name: e.target.value })}
                      placeholder="A+"
                      className="h-8"
                      maxLength={10}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.gpa}
                      onChange={(e) => updateRow(idx, { gpa: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={row.percent_from}
                      onChange={(e) => updateRow(idx, { percent_from: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={row.description}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      placeholder="Optional"
                      className="min-h-[32px] h-8 py-1.5 text-[13px]"
                      rows={1}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[color:var(--w11-text-secondary)] hover:!text-[#c42b1c]"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove band"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((prev) => [...prev, { grade_name: "", gpa: "", percent_from: "", description: "" }])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add band
          </Button>
          <p className="text-[11px] text-[color:var(--w11-text-secondary)]">
            Bands are stored top-down; from-% must strictly descend to 0%.
          </p>
        </div>

        {/* Validation hints */}
        {hints.length > 0 && (
          <div
            className="rounded-md border px-3 py-2 text-xs space-y-0.5"
            style={{
              background: "rgba(216,59,1,.08)",
              borderColor: "rgba(216,59,1,.3)",
              color: "#d83b01",
            }}
          >
            {hints.slice(0, 5).map((h, i) => (
              <p key={i}>• {h}</p>
            ))}
            {hints.length > 5 && <p>• …and {hints.length - 5} more</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Scale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
