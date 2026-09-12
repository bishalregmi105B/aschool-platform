"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { Package, Plus, AlertTriangle } from "lucide-react";

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

  const ASSET_COLUMNS: Column<any>[] = [
    {
      key: "name",
      label: "Asset",
      sortable: true,
      value: (a) => a.name ?? "",
      render: (a) => (
        <div className="flex items-center gap-2 font-medium">
          <Package className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />
          {a.name}
          {a.asset_code ? <span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>({a.asset_code})</span> : null}
        </div>
      ),
    },
    { key: "category", label: "Category", sortable: true, value: (a) => a.category ?? "", render: (a) => <span className="win11-chip subtle">{a.category || "—"}</span> },
    { key: "condition", label: "Condition", sortable: true, value: (a) => a.condition ?? "good", render: (a) => <span className="capitalize">{a.condition || "good"}</span> },
    { key: "purchase_price", label: "Purchase Price", align: "right", sortable: true, value: (a) => a.purchase_price ?? 0, render: (a) => <>Rs. {(a.purchase_price || 0).toLocaleString()}</> },
    { key: "current_value", label: "Current Value", align: "right", sortable: true, value: (a) => a.current_value ?? 0, render: (a) => <>Rs. {(a.current_value || 0).toLocaleString()}</> },
    { key: "location", label: "Location", value: (a) => a.location ?? "", render: (a) => a.location || "—" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (a) => (!a.is_active || a.condition === "disposed" ? "disposed" : a.condition === "poor" ? "attention" : "in-use"),
      render: (a) => (
        <StatusChip
          status={a.condition === "poor" || a.condition === "disposed" || !a.is_active ? "failed" : "active"}
          label={
            !a.is_active || a.condition === "disposed"
              ? "Disposed"
              : a.condition === "poor"
                ? (<><AlertTriangle className="inline mr-1 h-3 w-3" />Needs attention</>)
                : "In use"
          }
        />
      ),
    },
  ];

  if (isLoading) return <AOSModuleLoadingState label="Loading inventory…" />;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Package className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Inventory"
        subtitle={`${stats.total} assets · Rs. ${stats.totalValue.toLocaleString()} total value`}
        actions={
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Asset</Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Total Assets" value={stats.total} />
          <KpiCard label="Total Value" value={`Rs. ${stats.totalValue.toLocaleString()}`} />
          <KpiCard label="Poor / Disposed" value={stats.poorCondition} color={stats.poorCondition > 0 ? "#d83b01" : undefined} />
          <KpiCard label="Categories" value={stats.categories} />
        </StatGrid>

        {isError ? (
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center" style={{ color: "var(--w11-text-secondary)" }}>
              Failed to load inventory. <Button variant="link" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory"] })}>Retry</Button>
            </div>
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              columns={ASSET_COLUMNS}
              rows={items}
              rowKey={(a) => a.id}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search assets..."
              exportFileName="inventory"
              empty={{ icon: Package, title: "No assets recorded", body: "Add furniture, electronics and other school assets.", action: { label: "Add Asset", onClick: () => setShowDialog(true) } }}
            />
          </DataPanel>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Asset Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <AdvancedSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                    options={[{ value: 'furniture', label: 'Furniture' }, { value: 'electronics', label: 'Electronics' }, { value: 'stationery', label: 'Stationery' }, { value: 'sports', label: 'Sports' }, { value: 'lab', label: 'Lab Equipment' }, { value: 'cleaning', label: 'Cleaning' }, { value: 'other', label: 'Other' }]} />
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
      </AOSPageBody>
    </AOSPage>
  );
}
