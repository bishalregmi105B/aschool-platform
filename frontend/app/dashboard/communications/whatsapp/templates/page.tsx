"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface AutoReplyRule {
  keyword: string;
  response: string;
  match_type: string;
}

const MATCH_TYPES = [
  { value: "contains", label: "Contains" },
  { value: "exact", label: "Exact match" },
  { value: "regex", label: "Pattern (regex)" },
];

const emptyDraft = { keyword: "", response: "", match_type: "contains" };

export default function WhatsAppTemplatesPage() {
  return (
    <PluginGate slug="whatsapp_bot">
      <WhatsAppTemplatesContent />
    </PluginGate>
  );
}

function WhatsAppTemplatesContent() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AutoReplyRule>(emptyDraft);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<AutoReplyRule>(emptyDraft);

  const {
    data: rules,
    isLoading,
    isError,
    refetch,
  } = useQuery<AutoReplyRule[]>({
    queryKey: ["whatsapp-auto-replies"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/whatsapp-bot/auto-replies");
      return (res.data.data as AutoReplyRule[]) || [];
    },
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: AutoReplyRule) =>
      (await api.post("/whatsapp-bot/auto-replies", payload)).data,
    onSuccess: () => {
      toast.success("Template added");
      setDraft(emptyDraft);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-replies"] });
    },
    onError: () => toast.error("Failed to add template"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ index, payload }: { index: number; payload: AutoReplyRule }) =>
      (await api.put(`/whatsapp-bot/auto-replies/${index}`, payload)).data,
    onSuccess: () => {
      toast.success("Template updated");
      setEditIndex(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-replies"] });
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (index: number) =>
      (await api.delete(`/whatsapp-bot/auto-replies/${index}`)).data,
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-replies"] });
    },
    onError: () => toast.error("Failed to delete template"),
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load templates. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const submitCreate = () => {
    if (!draft.keyword.trim() || !draft.response.trim()) {
      toast.error("Keyword and response are required");
      return;
    }
    createMutation.mutate(draft);
  };

  const submitEdit = () => {
    if (editIndex === null) return;
    if (!editDraft.keyword.trim() || !editDraft.response.trim()) {
      toast.error("Keyword and response are required");
      return;
    }
    updateMutation.mutate({ index: editIndex, payload: editDraft });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/communications/whatsapp">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
          <p className="text-muted-foreground">
            Auto-reply templates the WhatsApp bot sends when a parent message matches.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              Templates ({rules?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(rules || []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No templates yet. Create the first auto-reply template.
              </div>
            ) : (
              (rules || []).map((rule, index) => (
                <div key={`${rule.keyword}-${index}`} className="rounded-lg border p-4">
                  {editIndex === index ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Keyword</Label>
                        <Input
                          value={editDraft.keyword}
                          onChange={(e) => setEditDraft({ ...editDraft, keyword: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Response</Label>
                        <Textarea
                          rows={3}
                          value={editDraft.response}
                          onChange={(e) => setEditDraft({ ...editDraft, response: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Match Type</Label>
                        <select
                          value={editDraft.match_type}
                          onChange={(e) => setEditDraft({ ...editDraft, match_type: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {MATCH_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={submitEdit} disabled={updateMutation.isPending}>
                          {updateMutation.isPending && <Spinner className="mr-2 h-3 w-3" />}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditIndex(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{rule.keyword}</p>
                          <Badge variant="outline" className="text-xs">
                            {MATCH_TYPES.find((t) => t.value === rule.match_type)?.label || rule.match_type}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{rule.response}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Edit template"
                          onClick={() => {
                            setEditIndex(index);
                            setEditDraft({ ...rule });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete template"
                          onClick={() => {
                            if (confirm(`Delete template "${rule.keyword}"?`)) {
                              deleteMutation.mutate(index);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Keyword</Label>
              <Input
                value={draft.keyword}
                onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
                placeholder="fees"
              />
            </div>
            <div className="space-y-1">
              <Label>Response</Label>
              <Textarea
                rows={4}
                value={draft.response}
                onChange={(e) => setDraft({ ...draft, response: e.target.value })}
                placeholder="Please send your ward's admission number to check fee status."
              />
            </div>
            <div className="space-y-1">
              <Label>Match Type</Label>
              <select
                value={draft.match_type}
                onChange={(e) => setDraft({ ...draft, match_type: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MATCH_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Template
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
