"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> FAQ Management
          </h1>
          <p className="text-muted-foreground">
            Manage frequently asked questions shown on the school website
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add FAQ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{faqs?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Total FAQs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{faqs?.filter((f) => f.is_active).length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{Object.keys(grouped).length + (uncategorized.length ? 1 : 0)}</p>
            <p className="text-sm text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{faqs?.filter((f) => !f.is_active).length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* FAQ list by category */}
      {faqs?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No FAQs yet</p>
            <p className="text-sm mt-1">Add your first FAQ to help students and parents</p>
            <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add FAQ</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {cat}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
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
                        <TableRow key={faq.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                          <TableCell>
                            <button
                              className="text-left w-full font-medium text-sm hover:text-primary"
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
                              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{faq.answer}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={faq.is_active ? "default" : "secondary"}>
                              {faq.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(faq)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
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
              </CardContent>
            </Card>
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
    </div>
  );
}
