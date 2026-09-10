"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
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

  if (isLoading) return <PageLoader />;
  const sessions = data || [];
  const openSession = sessions.find((s) => s.id === openSessionId && s.status === "open");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock-take</h1>
        <p className="text-muted-foreground">Shelf-by-shelf inventory verification</p>
      </div>

      {!openSession ? (
        <Card>
          <CardHeader><CardTitle>Start a new session</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder={`Session name (default: ${new Date().toISOString().slice(0, 10)})`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              <ScanLine className="h-4 w-4 mr-2" /> Start scanning
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{openSession.name}</span>
              <Badge>{openSession.scan_count}/{openSession.expected_count} scanned</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className={`rounded-md border p-3 text-sm ${
                lastScan.outcome === "found" ? "border-green-200 bg-green-50"
                : lastScan.outcome === "unexpected" ? "border-amber-200 bg-amber-50" : ""}`}>
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
                onClick={() => close.mutate(true)}>
                Close &amp; create lost fines
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              On close, every catalogued copy not scanned is reported missing. “Create lost fines”
              also opens replacement-cost fines for unissued missing copies.
            </p>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Session</th>
              <th className="p-3 font-medium">Started</th>
              <th className="p-3 font-medium text-right">Scanned / Expected</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No stock-take sessions yet.</td></tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.created_at ? displayBS(s.created_at.slice(0, 10)) : "—"}</td>
                <td className="p-3 text-right">{s.scan_count}/{s.expected_count}</td>
                <td className="p-3"><Badge variant={s.status === "open" ? "default" : "outline"}>{s.status}</Badge></td>
                <td className="p-3 text-right">
                  {s.status === "open" && (
                    <Button size="sm" variant="outline"
                      onClick={() => { setOpenSessionId(s.id); setLastScan(null); }}>
                      Resume
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
