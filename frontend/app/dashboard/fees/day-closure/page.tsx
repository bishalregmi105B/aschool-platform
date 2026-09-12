"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Spinner } from "@/components/ui/spinner";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { useAuth } from "@/lib/auth-context";
import {
  Banknote,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { formatNepaliDate, todayBS } from "@/lib/nepali_date";
import { formatNepaliCurrency } from "@/lib/nepali-utils";

interface DayBookMethod {
  method: string;
  count: number;
  amount: number;
}

interface DayBookUser {
  user_id: string | null;
  user_name: string;
  count: number;
  amount: number;
}

interface DayClosureRow {
  id: string;
  collected_by_id: string | null;
  status: string;
  expected_total: number;
  counted_total: number;
  difference: number;
}

interface DayBookPayload {
  date_bs: string;
  by_method: DayBookMethod[];
  by_user: DayBookUser[];
  grand_total: number;
  collections_count: number;
  closures: DayClosureRow[];
}

interface ClosureListRow extends DayClosureRow {
  closure_date_bs: string;
  denominations: Record<string, number> | null;
  notes: string | null;
  closed_at: string | null;
}

interface ClosureListPayload {
  closures: ClosureListRow[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

const DEFAULT_DENOMS = ["1000", "500", "100", "50", "20", "10", "5", "2", "1"];

function formatMethod(method: string) {
  const labels: Record<string, string> = {
    cash: "Cash",
    cheque: "Cheque",
    bank: "Bank / Transfer",
    qr_pay: "QR Pay",
    esewa: "eSewa",
    khalti: "Khalti",
    fonepay: "FonePay",
    unknown: "Unknown",
  };
  return labels[method] || method.replace(/_/g, " ");
}

export default function DayClosurePage() {
  return (
    <PluginGate slug="fees">
      <DayClosureContent />
    </PluginGate>
  );
}

function DayClosureContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "school_admin" || user?.role === "superadmin";

  const [dateBS, setDateBS] = useState<string>(todayBS());
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closuresPage, setClosuresPage] = useState(1);

  // Close-day dialog state
  const [denoms, setDenoms] = useState<Record<string, string>>({});
  const [customDenom, setCustomDenom] = useState("");
  const [collectorId, setCollectorId] = useState("");
  const [notes, setNotes] = useState("");

  const dayBook = useQuery({
    queryKey: ["fee-day-book", dateBS],
    retry: 1,
    queryFn: async () => {
      const r = await api.get(`/fees/day-book?date_bs=${dateBS}`);
      return r.data?.data as DayBookPayload | null;
    },
  });

  const closures = useQuery({
    queryKey: ["fee-day-closures", dateBS, closuresPage],
    retry: 1,
    queryFn: async () => {
      const params = new URLSearchParams({ date_bs: dateBS, page: String(closuresPage), per_page: "10" });
      const r = await api.get(`/fees/day-closures?${params.toString()}`);
      return r.data?.data as ClosureListPayload | null;
    },
  });

  const closeDay = useMutation({
    mutationFn: async () => {
      const denominations: Record<string, number> = {};
      Object.entries(denoms).forEach(([denom, count]) => {
        const c = parseInt(count, 10);
        if (c > 0) denominations[denom] = c;
      });
      const body: Record<string, unknown> = {
        closure_date_bs: dateBS,
        denominations,
      };
      if (collectorId) body.collected_by_id = collectorId;
      if (notes.trim()) body.notes = notes.trim();
      const r = await api.post("/fees/day-closures", body);
      return r.data?.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["fee-day-book"] });
      queryClient.invalidateQueries({ queryKey: ["fee-day-closures"] });
      setShowCloseDialog(false);
      setDenoms({});
      setCustomDenom("");
      setCollectorId("");
      setNotes("");
      const diff = Number(res?.difference || 0);
      toast.success(
        `Day closed. Counted ${formatNepaliCurrency(res?.counted_total || 0)} vs expected ${formatNepaliCurrency(res?.expected_total || 0)} (${diff === 0 ? "balanced" : diff > 0 ? "over" : "short"} ${formatNepaliCurrency(Math.abs(diff))}).`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Could not close the day"),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const r = await api.post(`/fees/day-closures/${id}/reopen`);
      return r.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-day-book"] });
      queryClient.invalidateQueries({ queryKey: ["fee-day-closures"] });
      toast.success("Closure reopened — the counter is unlocked for this date.");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || e?.message || "Could not reopen"),
  });

  const allDenomKeys = useMemo(() => {
    const keys = new Set(DEFAULT_DENOMS);
    Object.keys(denoms).forEach((k) => {
      if (denoms[k] && parseInt(denoms[k], 10) !== 0) keys.add(k);
    });
    if (customDenom && !keys.has(customDenom)) keys.add(customDenom);
    return Array.from(keys).sort((a, b) => Number(b) - Number(a));
  }, [denoms, customDenom]);

  const countedTotal = useMemo(
    () =>
      Object.entries(denoms).reduce(
        (sum, [denom, count]) => sum + Number(denom) * (parseInt(count, 10) || 0),
        0,
      ),
    [denoms],
  );

  const book = dayBook.data;
  const activeClosures = book?.closures ?? [];
  const dayIsClosed = activeClosures.some((c) => c.status === "closed");

  const CLOSURE_COLUMNS: Column<ClosureListRow>[] = [
    {
      key: "closure_date_bs",
      label: "Date (BS)",
      sortable: true,
      value: (r) => r.closure_date_bs,
      render: (r) => formatNepaliDate(r.closure_date_bs),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      render: (r) => (
        <Badge variant={r.status === "closed" ? "success" : "warning"}>
          {r.status === "closed" ? (
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Closed
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <LockOpen className="h-3 w-3" /> Open
            </span>
          )}
        </Badge>
      ),
    },
    {
      key: "expected_total",
      label: "Expected",
      align: "right",
      sortable: true,
      value: (r) => r.expected_total,
      render: (r) => formatNepaliCurrency(r.expected_total || 0),
    },
    {
      key: "counted_total",
      label: "Counted",
      align: "right",
      sortable: true,
      value: (r) => r.counted_total,
      render: (r) => formatNepaliCurrency(r.counted_total || 0),
    },
    {
      key: "difference",
      label: "Difference",
      align: "right",
      sortable: true,
      value: (r) => r.difference,
      render: (r) => (
        <span
          className={
            r.difference === 0
              ? "text-[color:var(--w11-text-secondary)]"
              : "font-semibold"
          }
          style={
            r.difference !== 0
              ? { color: r.difference > 0 ? "#107c10" : "#c42b1c" }
              : undefined
          }
        >
          {r.difference === 0
            ? "Balanced"
            : `${r.difference > 0 ? "+" : ""}${formatNepaliCurrency(r.difference)}`}
        </span>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      hidden: true,
      value: (r) => r.notes ?? "",
      render: (r) => <span className="text-xs text-[color:var(--w11-text-secondary)]">{r.notes || "—"}</span>,
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (r) =>
        isAdmin && r.status === "closed" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={reopen.isPending}
            onClick={(e) => {
              e.stopPropagation();
              reopen.mutate(r.id);
            }}
          >
            <RotateCcw className="h-3 w-3" /> Reopen
          </Button>
        ) : null,
    },
  ];

  if (dayBook.isLoading) return <AOSPage><AOSModuleLoadingState label="Loading day book…" /></AOSPage>;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Banknote className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Day Book & Closure"
        subtitle={`The counter's take for one BS date — then lock it with a closure${dayIsClosed ? " · day is closed" : ""}`}
        actions={
          <Button
            onClick={() => setShowCloseDialog(true)}
            disabled={dayIsClosed || dayBook.isFetching}
          >
            {dayIsClosed ? (
              <>
                <Lock className="h-4 w-4 mr-2" /> Day Closed
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4 mr-2" /> Close Day
              </>
            )}
          </Button>
        }
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="space-y-1">
            <Label className="text-xs">Date (BS)</Label>
            <BSDateInput
              value={dateBS}
              onChange={(v) => {
                setDateBS(v);
                setClosuresPage(1);
              }}
              emit="bs"
              className="w-44"
            />
          </div>
        </FilterCommandBar>

        {dayBook.isError ? (
          <div className="win11-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-[#c42b1c]">Failed to load the day book. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => dayBook.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Day summary */}
            <StatGrid className="mb-0" min={200}>
              <KpiCard
                label="Grand Total"
                value={formatNepaliCurrency(book?.grand_total || 0)}
                icon={<Wallet className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
                footnote={`${book?.collections_count ?? 0} collection(s) on ${book?.date_bs || dateBS} BS`}
              />
              {(book?.by_method ?? []).slice(0, 3).map((m) => (
                <KpiCard
                  key={m.method}
                  label={formatMethod(m.method)}
                  value={formatNepaliCurrency(m.amount || 0)}
                  color="var(--w11-text-primary)"
                  footnote={`${m.count} payment(s)`}
                />
              ))}
              {(book?.by_method?.length ?? 0) === 0 && (
                <div className="win11-card md:col-span-3 flex items-center justify-center py-8 text-sm text-[color:var(--w11-text-secondary)]">
                  No payments recorded for this date yet.
                </div>
              )}
            </StatGrid>

            {/* Collector breakdown + closure state */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataPanel title="By Collector">
                {(book?.by_user ?? []).length ? (
                  <div className="divide-y divide-[var(--w11-border-subtle)]">
                    {book!.by_user.map((u) => (
                      <div key={u.user_id || "unknown"} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{u.user_name}</p>
                          <p className="text-xs text-[color:var(--w11-text-secondary)]">{u.count} payment(s)</p>
                        </div>
                        <p className="text-sm font-bold">
                          {formatNepaliCurrency(u.amount || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                    No collections recorded for this date.
                  </p>
                )}
              </DataPanel>

              <DataPanel
                title={
                  <span className="flex items-center gap-2">
                    Closure State
                    {dayIsClosed && <Badge variant="success">Closed</Badge>}
                  </span>
                }
              >
                {activeClosures.length ? (
                  <div className="divide-y divide-[var(--w11-border-subtle)]">
                    {activeClosures.map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {c.status === "closed" ? "Closed" : "Open"}
                          </p>
                          <p className="text-xs text-[color:var(--w11-text-secondary)]">
                            Counted {formatNepaliCurrency(c.counted_total || 0)} / Expected{" "}
                            {formatNepaliCurrency(c.expected_total || 0)}
                          </p>
                        </div>
                        <p
                          className="text-sm font-bold"
                          style={
                            c.difference === 0
                              ? { color: "var(--w11-text-secondary)" }
                              : { color: c.difference > 0 ? "#107c10" : "#c42b1c" }
                          }
                        >
                          {c.difference === 0
                            ? "Balanced"
                            : `${c.difference > 0 ? "+" : ""}${formatNepaliCurrency(c.difference)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-[color:var(--w11-text-secondary)]">
                    This day has not been closed yet.
                  </p>
                )}
              </DataPanel>
            </div>

            {/* Closures history for this date */}
            <DataPanel title={`Closures for ${formatNepaliDate(dateBS)}`}>
              <DataTable<ClosureListRow>
                columns={CLOSURE_COLUMNS}
                rows={closures.data?.closures ?? []}
                rowKey={(r) => r.id}
                loading={closures.isLoading}
                error={closures.isError ? "Failed to load closures." : undefined}
                onRetry={() => closures.refetch()}
                pagination={
                  closures.data?.meta
                    ? {
                        total: closures.data.meta.total,
                        page: closures.data.meta.page,
                        per_page: closures.data.meta.per_page,
                        pages: closures.data.meta.pages,
                        has_next: closures.data.meta.has_next,
                        has_prev: closures.data.meta.has_prev,
                      }
                    : undefined
                }
                onPageChange={setClosuresPage}
                dense
                empty={{
                  icon: Banknote,
                  title: "No closures for this date",
                  body: "Use “Close Day” to count the till and lock the date.",
                }}
              />
            </DataPanel>
          </>
        )}

        {/* Close-day dialog */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Close Day — {formatNepaliDate(dateBS)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--w11-text-secondary)]">
                Enter the note/coin counts. The counted total is compared against the
                day-book take for the selected collector. While closed, new cash,
                cheque and bank entries for this collector and date are refused.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Collector (optional — defaults to you)</Label>
                <AdvancedSelect
                  value={collectorId}
                  onChange={(v) => setCollectorId(v)}
                  clearable
                  placeholder="Myself"
                  options={(book?.by_user ?? [])
                    .filter((u) => u.user_id)
                    .map((u) => ({ value: u.user_id as string, label: u.user_name }))}
                />
              </div>

              <div className="rounded-lg border border-[var(--w11-border-subtle)] p-3 space-y-2">
                <p className="text-xs font-medium text-[color:var(--w11-text-secondary)] uppercase tracking-wide">
                  Denominations
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {allDenomKeys.map((denom) => (
                    <div key={denom} className="flex items-center gap-1.5">
                      <span className="w-14 shrink-0 text-right text-[13px] tabular-nums text-[color:var(--w11-text-secondary)]">
                        Rs. {denom}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        className="h-8"
                        value={denoms[denom] ?? ""}
                        onChange={(e) =>
                          setDenoms((prev) => ({ ...prev, [denom]: e.target.value }))
                        }
                        placeholder="0"
                        aria-label={`Count of Rs. ${denom} notes`}
                      />
                      {Number(denom) !== 1 && !DEFAULT_DENOMS.includes(denom) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          aria-label={`Remove Rs. ${denom} denomination`}
                          onClick={() =>
                            setDenoms((prev) => {
                              const next = { ...prev };
                              delete next[denom];
                              return next;
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: "#c42b1c" }} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Custom denomination</Label>
                    <Input
                      type="number"
                      min="1"
                      className="h-8 w-32"
                      value={customDenom}
                      onChange={(e) => setCustomDenom(e.target.value)}
                      placeholder="e.g. 25"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!customDenom || Number(customDenom) <= 0}
                    onClick={() => {
                      setDenoms((prev) => ({ ...prev, [customDenom]: prev[customDenom] ?? "0" }));
                      setCustomDenom("");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>

              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: "var(--w11-control-hover)" }}
              >
                <span className="text-sm font-medium">Counted Total</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatNepaliCurrency(countedTotal)}
                </span>
              </div>
              {book && (
                <p className="text-xs text-[color:var(--w11-text-secondary)]">
                  Day-book reference total (all collectors):{" "}
                  {formatNepaliCurrency(book.grand_total || 0)}. The exact expected
                  total is computed on save per collector (cash, cheque, bank and QR
                  payments only).
                </p>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Rs. 200 shortage covered by petty cash"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)} disabled={closeDay.isPending}>
                Cancel
              </Button>
              <Button onClick={() => closeDay.mutate()} disabled={closeDay.isPending}>
                {closeDay.isPending ? <Spinner className="mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Close Day
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
