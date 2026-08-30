"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Package, Search, Plus, AlertTriangle } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  asset_code: string | null;
  category: string | null;
  location: string | null;
  purchase_price: number | null;
  current_value: number | null;
  condition: string;
  is_active: boolean;
}

export default function InventoryPage() {
  return <PluginGate slug="inventory"><InventoryContent /></PluginGate>;
}

function InventoryContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", asset_code: "", category: "furniture", location: "", purchase_price: "", current_value: "" });

  // Backend contract: GET/POST /inventory/assets — an asset registry
  // (Asset model has no stock quantity; it tracks value, condition, location).
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const r = await api.get("/inventory/assets");
      return (r.data?.data || []) as Asset[];
    },
  });

  const assets = data || [];
  const needle = search.trim().toLowerCase();
  const items = needle
    ? assets.filter((a) =>
        [a.name, a.asset_code, a.category, a.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
    : assets;

  const totalValue = assets.reduce((sum, a) => sum + (a.current_value || a.purchase_price || 0), 0);
  const categories = new Set(assets.map((a) => a.category).filter(Boolean)).size;
  const poorCondition = assets.filter((a) => a.condition === "poor" || a.condition === "disposed").length;
  const stats = { total: assets.length, totalValue, categories, poorCondition };

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/inventory/assets", {
          name: form.name,
          asset_code: form.asset_code || undefined,
          category: form.category,
          location: form.location || undefined,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
          current_value: form.current_value ? parseFloat(form.current_value) : undefined,
        })
      ).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["inventory"] }); setShowDialog(false); toast.success("Asset added"); },
    onError: () => toast.error("Failed to add asset"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Inventory</h1><p className="text-muted-foreground">School assets and supply management</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ label: "Total Assets", val: stats.total }, { label: "Total Value", val: `Rs. ${stats.totalValue.toLocaleString()}` }, { label: "Poor / Disposed", val: stats.poorCondition, warn: true }, { label: "Categories", val: stats.categories }].map((s) => (
          <Card key={s.label}><CardContent className="py-4"><p className="text-sm text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.warn && s.val > 0 ? "text-orange-600" : ""}`}>{s.val}</p></CardContent></Card>
        ))}
      </div>

      {isError ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Failed to load inventory. <Button variant="link" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory"] })}>Retry</Button></CardContent></Card>
      ) : (
        <>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Condition</TableHead><TableHead>Purchase Price</TableHead><TableHead>Current Value</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assets recorded</TableCell></TableRow>
                  ) : items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" />{a.name}{a.asset_code ? <span className="text-xs text-muted-foreground">({a.asset_code})</span> : null}</div></TableCell>
                      <TableCell><Badge variant="outline">{a.category || "—"}</Badge></TableCell>
                      <TableCell>{a.condition || "good"}</TableCell>
                      <TableCell>Rs. {(a.purchase_price || 0).toLocaleString()}</TableCell>
                      <TableCell>Rs. {(a.current_value || 0).toLocaleString()}</TableCell>
                      <TableCell>{a.location || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={a.condition === "poor" || a.condition === "disposed" || !a.is_active ? "destructive" : "default"}>
                          {!a.is_active || a.condition === "disposed" ? "Disposed" : a.condition === "poor" ? (<><AlertTriangle className="inline mr-1 h-3 w-3" />Needs attention</>) : "In use"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Asset Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full border rounded-md p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="furniture">Furniture</option><option value="electronics">Electronics</option><option value="stationery">Stationery</option><option value="sports">Sports</option><option value="lab">Lab Equipment</option><option value="cleaning">Cleaning</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Asset Code</Label><Input value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="e.g. AST-001" /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 101" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Purchase Price (Rs.)</Label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Current Value (Rs.)</Label><Input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add Asset</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
