"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { HelpCircle, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

const FAQ_CATEGORIES = ["General", "Admissions", "Fees", "Academics", "Transport", "Other"];

export default function FAQsPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    question: "", answer: "", category: "General", is_active: true, sort_order: 0,
  });

  const { data: faqs, isLoading } = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FAQ[]>>("/faqs");
      return res.data.data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      if (editingFaq) {
        return api.put(`/faqs/${editingFaq.id}`, payload);
      }
      return api.post("/faqs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast.success(editingFaq ? "FAQ updated" : "FAQ created");
      setShowDialog(false);
      setEditingFaq(null);
      setForm({ question: "", answer: "", category: "General", is_active: true, sort_order: 0 });
    },
    onError: () => toast.error("Failed to save FAQ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/faqs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast.success("FAQ deleted");
    },
    onError: () => toast.error("Failed to delete FAQ"),
  });

  const openAdd = () => {
    setEditingFaq(null);
    setForm({ question: "", answer: "", category: "General", is_active: true, sort_order: 0 });
    setShowDialog(true);
  };

  const openEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      is_active: faq.is_active,
      sort_order: faq.sort_order,
    });
    setShowDialog(true);
  };

  if (isLoading) return <PageLoader />;

  const grouped = FAQ_CATEGORIES.reduce<Record<string, FAQ[]>>((acc, cat) => {
    const items = (faqs ?? []).filter((f) => f.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const uncategorized = (faqs ?? []).filter((f) => !FAQ_CATEGORIES.includes(f.category));

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<HelpCircle className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="FAQ Management"
        subtitle="Manage frequently asked questions shown on the school website"
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add FAQ
          </Button>
        }
      />
      <AOSPageBody>
        {/* Stats */}
        <StatGrid>
          <KpiCard label="Total FAQs" value={faqs?.length ?? 0} />
          <KpiCard label="Active" value={faqs?.filter((f) => f.is_active).length ?? 0} />
          <KpiCard label="Categories" value={Object.keys(grouped).length + (uncategorized.length ? 1 : 0)} />
          <KpiCard label="Inactive" value={faqs?.filter((f) => !f.is_active).length ?? 0} />
        </StatGrid>

        {/* FAQ list by category */}
        {faqs?.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<HelpCircle className="h-10 w-10" />}
              title="No FAQs yet"
              description="Add your first FAQ to help students and parents"
              action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add FAQ</Button>}
            />
          </DataPanel>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <DataPanel
                key={cat}
                title={
                  <span className="flex items-center gap-2">
                    {cat}
                    <span className="win11-chip">{items.length}</span>
                  </span>
                }
                bodyClassName="p-0 pt-0"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((faq, idx) => (
                      <>
                        <TableRow key={faq.id} className="cursor-pointer">
                          <TableCell className="text-xs text-[color:var(--w11-text-secondary)]">{idx + 1}</TableCell>
                          <TableCell>
                            <button
                              className="text-left w-full font-medium text-sm"
                              style={{ color: "var(--w11-text-primary)" }}
                              onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                            >
                              <span className="flex items-center gap-2">
                                {faq.question}
                                {expandedId === faq.id
                                  ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                                  : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                              </span>
                            </button>
                            {expandedId === faq.id && (
                              <p className="text-xs mt-2 whitespace-pre-wrap text-[color:var(--w11-text-secondary)]">{faq.answer}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusChip status={faq.is_active ? "active" : "inactive"} label={faq.is_active ? "Active" : "Inactive"} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(faq)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7 text-[#c42b1c]"
                                onClick={() => deleteMutation.mutate(faq.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </>
                    ))}
                  </TableBody>
                </Table>
              </DataPanel>
            ))}
          </div>
        )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
                placeholder="What is...?"
              />
            </div>
            <div>
              <Label>Answer *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                placeholder="The answer to this question..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
              />
              <Label>Active (visible on website)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
              {editingFaq ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
