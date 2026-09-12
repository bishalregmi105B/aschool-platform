"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

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

  if (isLoading) return <AOSModuleLoadingState label="Loading templates…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="WhatsApp Templates" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load templates. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
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
    <AOSPage>
      <AOSPageHeader
        icon={<MessageSquare className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="WhatsApp Templates"
        subtitle={`${rules?.length || 0} auto-reply ${rules?.length === 1 ? "template" : "templates"} the bot sends when a parent message matches`}
      />
      <AOSPageBody>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <DataPanel
            title={
              <span className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                Templates ({rules?.length || 0})
              </span>
            }
          >
            <div className="space-y-3">
              {(rules || []).length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-[var(--w11-border-default)] p-6 text-center text-sm"
                  style={{ color: "var(--w11-text-secondary)" }}
                >
                  No templates yet. Create the first auto-reply template.
                </div>
              ) : (
                (rules || []).map((rule, index) => (
                  <div key={`${rule.keyword}-${index}`} className="rounded-lg border border-[var(--w11-border-subtle)] p-4">
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
                          <AdvancedSelect
                            value={editDraft.match_type}
                            onChange={(v) => setEditDraft({ ...editDraft, match_type: v })}
                            options={MATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                          />
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
                            <p className="font-medium" style={{ color: "var(--w11-text-primary)" }}>{rule.keyword}</p>
                            <span className="win11-chip subtle text-xs">
                              {MATCH_TYPES.find((t) => t.value === rule.match_type)?.label || rule.match_type}
                            </span>
                          </div>
                          <p className="mt-1 text-sm" style={{ color: "var(--w11-text-secondary)" }}>{rule.response}</p>
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
                            <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DataPanel>

          <DataPanel title={<span className="text-sm">Add Template</span>}>
            <div className="space-y-3">
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
                <AdvancedSelect
                  value={draft.match_type}
                  onChange={(v) => setDraft({ ...draft, match_type: v })}
                  options={MATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                />
              </div>
              <Button onClick={submitCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Template
              </Button>
            </div>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
