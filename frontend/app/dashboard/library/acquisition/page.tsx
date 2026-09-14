"use client";

/**
 * Library Acquisition (plan 34-24 v2 depth): purchase orders + vendors as
 * Tabs over DataTables. Endpoints: GET/POST /library/vendors,
 * GET/POST /library/purchase-orders, POST /library/purchase-orders/<id>/receive.
 * PO creation keeps the ≤7-visible-fields rule (vendor, expected date,
 * then one line item per add — quantity/price fields inside the item row).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, StatGrid, KpiCard,
  StatusChip, AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Package, Truck, Plus, Boxes, Check } from "lucide-react";

interface PoItem {
  id: string; title: string | null; author: string | null; isbn: string | null;
  quantity: number; quantity_received: number; unit_price: number;
}
interface PurchaseOrder {
  id: string; po_number: string; vendor: string | null; status: string;
  expected_date: string | null; total: number; items: PoItem[];
}
interface Vendor {
  id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null;
}

const PO_TONE: Record<string, "subtle" | "warning" | "success" | "error"> = {
  ordered: "subtle",
  partially_received: "warning",
  received: "success",
  paid: "success",
  cancelled: "error",
};

export default function AcquisitionPage() {
  return <AppGate slug="library"><AcquisitionContent /></AppGate>;
}

function AcquisitionContent() {
  const [tab, setTab] = useState("pos");
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: pos, isLoading: poLoading } = useQuery({
    queryKey: ["library-pos"],
    queryFn: async () => (await api.get("/library/purchase-orders")).data?.data as PurchaseOrder[],
  });
  const { data: vendors, isLoading: vLoading } = useQuery({
    queryKey: ["library-vendors"],
    queryFn: async () => (await api.get("/library/vendors")).data?.data as Vendor[],
  });
  const [showPo, setShowPo] = useState(false);
  const [showVendor, setShowVendor] = useState(false);

  const receive = useMutation({
    mutationFn: async (po: PurchaseOrder) => {
      const items = po.items
        .filter((i) => (i.quantity || 0) > (i.quantity_received || 0))
        .map((i) => ({ item_id: i.id, quantity: i.quantity - i.quantity_received }));
      return (await api.post(`/library/purchase-orders/${po.id}/receive`, { items })).data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["library-pos"] }); toast.success("Stock received into the catalog"); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Receive failed"),
  });

  const openCount = (pos || []).filter((p) => p.status === "ordered" || p.status === "partially_received").length;

  const PO_COLUMNS: Column<PurchaseOrder>[] = [
    { key: "po", label: "PO #", sortable: true, value: (p) => p.po_number, render: (p) => <span className="font-mono text-xs font-medium">{p.po_number}</span> },
    { key: "vendor", label: "Vendor", sortable: true, value: (p) => p.vendor ?? "", render: (p) => p.vendor || <span style={{ color: "var(--w11-text-secondary)" }}>—</span> },
    { key: "items", label: "Items", align: "right", value: (p) => p.items.length, render: (p) => p.items.map((i) => i.title).join(", ") || `${p.items.length} line(s)` },
    { key: "total", label: "Total", align: "right", sortable: true, value: (p) => p.total, render: (p) => <span className="tabular-nums font-medium">Rs {p.total.toFixed(0)}</span> },
    { key: "expected", label: "Expected", sortable: true, value: (p) => p.expected_date ?? "", render: (p) => p.expected_date ?? "—" },
    { key: "status", label: "Status", sortable: true, value: (p) => p.status, render: (p) => <StatusChip status={PO_TONE[p.status] ?? "subtle"} label={p.status} className="capitalize" /> },
    {
      key: "actions", label: "", align: "right", noExport: true,
      render: (p) =>
        (p.status === "ordered" || p.status === "partially_received") ? (
          <Button size="sm" variant="outline" disabled={receive.isPending}
            onClick={(e) => {
              e.stopPropagation();
              const left = p.items.reduce((a, i) => a + Math.max(0, i.quantity - (i.quantity_received || 0)), 0);
              confirm({
                title: "Receive this order?",
                body: `${left} unit(s) will be added to the catalog as copies.`,
                confirmLabel: "Receive",
              }).then((ok) => { if (ok) receive.mutate(p); });
            }}>
            <Check className="h-3.5 w-3.5 mr-1" /> Receive
          </Button>
        ) : null,
    },
  ];

  const VENDOR_COLUMNS: Column<Vendor>[] = [
    { key: "name", label: "Vendor", sortable: true, value: (v) => v.name, render: (v) => <span className="font-medium">{v.name}</span> },
    { key: "contact", label: "Contact", value: (v) => v.contact_name ?? "", render: (v) => v.contact_name || "—" },
    { key: "phone", label: "Phone", value: (v) => v.phone ?? "" },
    { key: "email", label: "Email", value: (v) => v.email ?? "", render: (v) => v.email || "—" },
  ];

  if (poLoading || vLoading) return <AOSModuleLoadingState label="Loading acquisition…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Truck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Acquisition"
        subtitle="Purchase orders and book vendors"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowVendor(true)}><Plus className="h-4 w-4 mr-2" /> Vendor</Button>
            <Button onClick={() => setShowPo(true)}><Plus className="h-4 w-4 mr-2" /> Purchase Order</Button>
          </div>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Open orders" value={openCount} icon={<Package className="h-4 w-4" style={{ color: "#d83b01" }} />} color="#d83b01" />
          <KpiCard label="Ordered value" value={`Rs ${((pos || []).reduce((a, p) => a + (p.total || 0), 0)).toFixed(0)}`} icon={<Boxes className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Vendors" value={(vendors || []).length} icon={<Truck className="h-4 w-4" style={{ color: "#107c10" }} />} color="#107c10" />
        </StatGrid>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pos" badge={(pos || []).length}>Purchase Orders</TabsTrigger>
            <TabsTrigger value="vendors" badge={(vendors || []).length}>Vendors</TabsTrigger>
          </TabsList>
          <TabsContent value="pos">
            <DataPanel bodyClassName="p-0">
              <DataTable<PurchaseOrder>
                columns={PO_COLUMNS}
                rows={pos || []}
                rowKey={(p) => p.id}
                searchable
                exportFileName="purchase-orders"
                empty={{ icon: Package, title: "No purchase orders", body: "Raise a PO to start acquiring stock from a vendor.", action: { label: "New PO", onClick: () => setShowPo(true) } }}
              />
            </DataPanel>
          </TabsContent>
          <TabsContent value="vendors">
            <DataPanel bodyClassName="p-0">
              <DataTable<Vendor>
                columns={VENDOR_COLUMNS}
                rows={vendors || []}
                rowKey={(v) => v.id}
                searchable
                exportFileName="library-vendors"
                empty={{ icon: Truck, title: "No vendors yet", body: "Add the book suppliers you buy from.", action: { label: "Add Vendor", onClick: () => setShowVendor(true) } }}
              />
            </DataPanel>
          </TabsContent>
        </Tabs>

        <NewPoDialog
          open={showPo}
          vendors={vendors || []}
          onClose={() => setShowPo(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["library-pos"] }); setShowPo(false); }}
        />
        <NewVendorDialog
          open={showVendor}
          onClose={() => setShowVendor(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["library-vendors"] }); setShowVendor(false); }}
        />
      </AOSPageBody>
    </AOSPage>
  );
}

/** PO dialog: header fields + an append-only item list (each add = 4 fields). */
function NewPoDialog({ open, vendors, onClose, onSaved }: { open: boolean; vendors: Vendor[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ vendor_id: "", expected_date: "", notes: "" });
  const [item, setItem] = useState({ title: "", author: "", isbn: "", quantity: "1", unit_price: "0" });
  const [items, setItems] = useState<typeof item[]>([]);
  const total = useMemo(() => items.reduce((a, i) => a + (parseInt(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0), [items]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.post("/library/purchase-orders", {
        vendor_id: f.vendor_id || undefined,
        expected_date: f.expected_date || undefined,
        notes: f.notes || undefined,
        items: items.map((i) => ({
          title: i.title, author: i.author || undefined, isbn: i.isbn || undefined,
          quantity: parseInt(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0,
        })),
      })).data,
    onSuccess: () => { toast.success("PO raised"); setItems([]); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to raise PO"),
  });

  const addItem = () => {
    if (!item.title.trim()) { toast.error("Item title required"); return; }
    setItems((xs) => [...xs, item]);
    setItem({ title: "", author: "", isbn: "", quantity: "1", unit_price: "0" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <AdvancedSelect clearable value={f.vendor_id} onChange={(v) => setF({ ...f, vendor_id: v })}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))} placeholder="Select vendor" />
            </div>
            <div className="space-y-1.5">
              <Label>Expected (BS)</Label>
              <BSDateInput emit="ad" value={f.expected_date} onChange={(v) => setF({ ...f, expected_date: v })} placeholder="Date" />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-[var(--w11-border-subtle)] p-3">
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>Add line item</p>
            <Input placeholder="Book title *" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Author" value={item.author} onChange={(e) => setItem({ ...item, author: e.target.value })} />
              <Input placeholder="Quantity" type="number" min="1" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
              <Input placeholder="Unit price" type="number" value={item.unit_price} onChange={(e) => setItem({ ...item, unit_price: e.target.value })} />
            </div>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add item</Button>
          </div>

          {items.length > 0 && (
            <div className="space-y-1 text-[12px]">
              <p className="font-semibold uppercase" style={{ color: "var(--w11-text-secondary)" }}>Order lines</p>
              {items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 border-b border-[var(--w11-border-subtle)] py-1">
                  <span className="truncate">{i.title} × {i.quantity}</span>
                  <span className="tabular-nums">Rs {(parseInt(i.quantity) * parseFloat(i.unit_price || "0")).toFixed(0)}</span>
                </div>
              ))}
              <p className="pt-1 text-right font-semibold tabular-nums">Total: Rs {total.toFixed(0)}</p>
            </div>
          )}

          <Input placeholder="Notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={items.length === 0 || save.isPending}>
            {save.isPending ? "Raising…" : `Raise PO (${items.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewVendorDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", contact_name: "", phone: "", email: "", address: "" });
  const save = useMutation({
    mutationFn: async () => (await api.post("/library/vendors", f)).data,
    onSuccess: () => { toast.success("Vendor added"); setF({ name: "", contact_name: "", phone: "", email: "", address: "" }); onSaved(); },
    onError: () => toast.error("Failed to add vendor"),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Contact person</Label><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!f.name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
