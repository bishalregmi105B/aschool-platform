"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ScanLine } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

interface StocktakeSession {
  id: string;
  name: string;
  status: string;
  scan_count: number;
  expected_count: number;
  created_at: string | null;
  closed_at: string | null;
}

export default function StocktakePage() {
  return <PluginGate slug="library"><StocktakeContent /></PluginGate>;
}

function StocktakeContent() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [lastScan, setLastScan] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["library-stocktakes"],
    queryFn: async () => (await api.get("/library/stocktakes")).data?.data as StocktakeSession[],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["library-stocktakes"] });

  const create = useMutation({
    mutationFn: async () => (await api.post("/library/stocktakes", { name })).data?.data,
    onSuccess: (d) => {
      invalidate();
      setOpenSessionId(d.id);
      toast.success(`Session started — ${d.expected_count} copies expected`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Could not start session"),
  });

  const scan = useMutation({
    mutationFn: async () =>
      (await api.post(`/library/stocktakes/${openSessionId}/scan`, { barcode: scanCode.trim() })).data?.data,
    onSuccess: (d) => {
      setLastScan(d);
      setScanCode("");
      invalidate();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "";
      if (msg.includes("Already scanned")) toast.warning("Already scanned in this session");
      else toast.error(msg || "Scan failed");
    },
  });

  const close = useMutation({
    mutationFn: async (autoFine: boolean) =>
      (await api.post(`/library/stocktakes/${openSessionId}/close`, { auto_fine: autoFine })).data?.data,
    onSuccess: (d) => {
      invalidate();
      setOpenSessionId(null);
      setLastScan(null);
      toast.success(`Closed — ${d.scanned}/${d.expected} scanned, ${d.missing} missing`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Close failed"),
  });

  const SESSION_COLUMNS: Column<StocktakeSession>[] = [
    { key: "name", label: "Session", sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "created_at", label: "Started", sortable: true, value: (s) => s.created_at ?? "", render: (s) => (s.created_at ? displayBS(s.created_at.slice(0, 10)) : "—") },
    { key: "scan", label: "Scanned / Expected", align: "right", sortable: true, value: (s) => s.scan_count, render: (s) => <span className="tabular-nums">{s.scan_count}/{s.expected_count}</span> },
    { key: "status", label: "Status", sortable: true, value: (s) => s.status, render: (s) => <StatusChip status={s.status === "open" ? "active" : s.status} className="capitalize" /> },
    {
      key: "actions",
      label: "",
      align: "right",
      noExport: true,
      render: (s) =>
        s.status === "open" ? (
          <Button size="sm" variant="outline" onClick={() => { setOpenSessionId(s.id); setLastScan(null); }}>
            Resume
          </Button>
        ) : null,
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading stock-take…" />;
  const sessions = data || [];
  const openSession = sessions.find((s) => s.id === openSessionId && s.status === "open");

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ScanLine className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Stock-take"
        subtitle={`Shelf-by-shelf inventory verification · ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
      />
      <AOSPageBody>
        {!openSession ? (
          <DataPanel title="Start a new session" className="mb-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Session name (default: ${new Date().toISOString().slice(0, 10)})`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button disabled={create.isPending} onClick={() => create.mutate()}>
                <ScanLine className="h-4 w-4 mr-2" /> Start scanning
              </Button>
            </div>
          </DataPanel>
        ) : (
          <DataPanel
            className="mb-4"
            title={
              <span className="flex items-center justify-between gap-2">
                <span>{openSession.name}</span>
                <span className="win11-chip accent">{openSession.scan_count}/{openSession.expected_count} scanned</span>
              </span>
            }
          >
            <div className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); if (scanCode.trim()) scan.mutate(); }}
              >
                <Input
                  autoFocus
                  placeholder="Scan a copy barcode…"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                />
                <Button type="submit" disabled={scan.isPending}>Record</Button>
              </form>

              {lastScan && (
                <div
                  className={`rounded-md border p-3 text-sm ${
                    lastScan.outcome === "found"
                      ? "win11-infobar success"
                      : lastScan.outcome === "unexpected"
                        ? "win11-infobar warning"
                        : "border-[var(--w11-border-subtle)]"
                  }`}
                >
                  {lastScan.outcome === "found" ? (
                    <>✅ Found: <span className="font-medium">{lastScan.book_title}</span> ({lastScan.copy?.accession_no})</>
                  ) : (
                    <>⚠️ Unexpected scan — no copy in the catalog matches “{lastScan.scan_value ?? "this barcode"}”</>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" disabled={close.isPending}
                  onClick={() => close.mutate(false)}>Close (report only)</Button>
                <Button variant="destructive" disabled={close.isPending}
                  onClick={() => {
                    confirm({
                      title: "Close and open lost fines?",
                      body: "Every unscanned copy is marked missing and replacement-cost fines are created. This cannot be undone from here.",
                      confirmLabel: "Close & fine",
                      tone: "danger",
                    }).then((ok) => { if (ok) close.mutate(true); });
                  }}>
                  Close &amp; create lost fines
                </Button>
              </div>
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                On close, every catalogued copy not scanned is reported missing. “Create lost fines”
                also opens replacement-cost fines for unissued missing copies.
              </p>
            </div>
          </DataPanel>
        )}

        <DataPanel bodyClassName="p-0">
          <DataTable<StocktakeSession>
            columns={SESSION_COLUMNS}
            rows={sessions}
            rowKey={(s) => s.id}
            exportFileName="library-stocktakes"
            empty={{ icon: ScanLine, title: "No stock-take sessions yet", body: "Start a session above to verify the shelves." }}
          />
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
