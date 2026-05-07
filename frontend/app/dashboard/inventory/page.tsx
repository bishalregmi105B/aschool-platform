"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Package, Search, Plus, AlertTriangle } from "lucide-react";

export default function InventoryPage() {
  return <PluginGate slug="inventory"><InventoryContent /></PluginGate>;
}

function InventoryContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", category: "furniture", quantity: "", unit_price: "", reorder_level: "", location: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", search],
    queryFn: async () => { const r = await api.get("/inventory/assets", { params: { search: search || undefined } }); return r.data; },
  });

  const items = data?.data || [];
  const stats = data?.stats || {};

  const create = useMutation({
    mutationFn: async () => (await api.post("/inventory/assets", { ...form, quantity: parseInt(form.quantity) || 0, unit_price: parseFloat(form.unit_price) || 0, reorder_level: parseInt(form.reorder_level) || 0 })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["inventory"] }); setShowDialog(false); toast.success("Item added"); },
    onError: () => toast.error("Failed to add item"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Inventory</h1><p className="text-muted-foreground">School assets and supply management</p></div>
        <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ label: "Total Items", val: stats.total || items.length }, { label: "Total Value", val: `Rs. ${(stats.total_value || 0).toLocaleString()}` }, { label: "Low Stock", val: stats.low_stock || 0, warn: true }, { label: "Categories", val: stats.categories || 0 }].map((s) => (
          <Card key={s.label}><CardContent className="py-4"><p className="text-sm text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.warn && s.val > 0 ? "text-orange-600" : ""}`}>{s.val}</p></CardContent></Card>
        ))}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Total Value</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No inventory items</TableCell></TableRow>
              ) : items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" />{i.name}</div></TableCell>
                  <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                  <TableCell>{i.quantity}{i.quantity <= (i.reorder_level || 5) ? <AlertTriangle className="inline ml-1 h-3 w-3 text-orange-500" /> : null}</TableCell>
                  <TableCell>Rs. {i.unit_price?.toLocaleString() || 0}</TableCell>
                  <TableCell>Rs. {((i.quantity || 0) * (i.unit_price || 0)).toLocaleString()}</TableCell>
                  <TableCell>{i.location || "—"}</TableCell>
                  <TableCell><Badge variant={i.quantity <= (i.reorder_level || 5) ? "destructive" : "default"}>{i.quantity <= (i.reorder_level || 5) ? "Low Stock" : "In Stock"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Item Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full border rounded-md p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="furniture">Furniture</option><option value="electronics">Electronics</option><option value="stationery">Stationery</option><option value="sports">Sports</option><option value="lab">Lab Equipment</option><option value="cleaning">Cleaning</option><option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 101" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Unit Price</Label><Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{create.isPending ? <Spinner className="mr-2" /> : null} Add Item</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
