"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { getPluginDisplayName } from "@/lib/plugins";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

/**
 * Per-plugin settings — a friendly form over SchoolPlugin.config (audit E166),
 * saved via PUT /plugins/<slug>/config (JSON-dict validated, size-capped,
 * works while the plugin is active OR deactivated; 404 once uninstalled).
 *
 * Value-type handling: string → text input, number → number input,
 * boolean → switch, anything else (arrays/objects/"unknown keys") → a JSON
 * textarea. New keys can be added with an explicit type; the backend merges
 * the saved dict over the stored config.
 */

type FieldKind = "string" | "number" | "boolean" | "json";

interface DraftField {
  kind: FieldKind;
  /** Raw editable representation: string for text/number/json, boolean for bool. */
  text: string;
  bool: boolean;
}

function classify(value: unknown): FieldKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

function toDraft(value: unknown): DraftField {
  const kind = classify(value);
  if (kind === "boolean") return { kind, text: "", bool: value as boolean };
  if (kind === "json") return { kind, text: JSON.stringify(value, null, 2), bool: false };
  return { kind, text: String(value), bool: false };
}

function fromDraft(field: DraftField): { ok: true; value: unknown } | { ok: false; error: string } {
  if (field.kind === "boolean") return { ok: true, value: field.bool };
  if (field.kind === "string") return { ok: true, value: field.text };
  if (field.kind === "number") {
    const n = Number(field.text.trim());
    if (field.text.trim() === "" || Number.isNaN(n)) {
      return { ok: false, error: "must be a number" };
    }
    return { ok: true, value: n };
  }
  try {
    return { ok: true, value: JSON.parse(field.text) };
  } catch {
    return { ok: false, error: "contains invalid JSON" };
  }
}

export default function PluginSettingsPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = user?.role === "superadmin" || user?.role === "school_admin";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["plugins-config", slug],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Record<string, unknown>>>(
        `/plugins/${slug}/config`
      );
      return res.data.data || {};
    },
    enabled: !!slug,
  });

  const [drafts, setDrafts] = useState<Record<string, DraftField>>({});
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState<FieldKind>("string");

  useEffect(() => {
    if (data) {
      setDrafts(
        Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toDraft(v)]))
      );
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // ?replace=1: the form always sends the FULL dict (so removed keys are
      // actually dropped — the default backend semantics merge over the old
      // config and would keep them).
      const res = await api.put<ApiResponse<Record<string, unknown>>>(
        `/plugins/${slug}/config?replace=1`,
        payload
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins-config", slug] });
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Settings saved");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data
              ?.error ?? "Could not save settings")
          : "Could not save settings";
      toast.error(typeof msg === "string" ? msg : "Could not save settings");
    },
  });

  const keys = useMemo(() => Object.keys(drafts), [drafts]);

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    for (const key of keys) {
      const parsed = fromDraft(drafts[key]);
      if (!parsed.ok) {
        toast.error(`"${key}" ${parsed.error}`);
        return;
      }
      payload[key] = parsed.value;
    }
    saveMutation.mutate(payload);
  };

  const addKey = () => {
    const key = newKey.trim();
    if (!key) return;
    if (keys.includes(key)) {
      toast.error(`"${key}" already exists`);
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [key]:
        newKind === "boolean"
          ? { kind: "boolean", text: "", bool: false }
          : newKind === "json"
            ? { kind: "json", text: "{\n  \n}", bool: false }
            : { kind: newKind, text: "", bool: false },
    }));
    setNewKey("");
  };

  const removeKey = (key: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    const status =
      (error as { response?: { status?: number } })?.response?.status ?? null;
    return (
      <div className="space-y-4 pb-10">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/plugins">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Installed Plugins
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{getPluginDisplayName(slug)}</CardTitle>
            <CardDescription>
              {status === 404
                ? "This plugin is not installed on your school — install it from the marketplace to configure it."
                : "Settings could not be loaded. Please try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/plugins">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Installed Plugins
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          {getPluginDisplayName(slug)}
          <Badge variant="secondary" className="font-mono text-xs">{slug}</Badge>
        </h1>
        <p className="text-muted-foreground mt-2">
          Per-school configuration for this plugin. Changes apply immediately
          after saving.
          {!canManage && " (Only school admins can save changes.)"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Text and number fields save as strings and numbers; checkboxes save
            as true/false; JSON fields save as their parsed value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {keys.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This plugin has no settings yet — add the first one below.
            </p>
          )}

          {keys.map((key) => {
            const field = drafts[key];
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`cfg-${key}`} className="font-mono text-xs text-muted-foreground">
                    {key}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {field.kind}
                    </Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-muted-foreground hover:text-red-600"
                        onClick={() => removeKey(key)}
                        title={`Remove ${key} on save`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {field.kind === "boolean" ? (
                  <div className="flex h-9 items-center">
                    <Switch
                      id={`cfg-${key}`}
                      checked={field.bool}
                      disabled={!canManage}
                      onCheckedChange={(checked) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], bool: checked },
                        }))
                      }
                    />
                    <span className="ml-3 text-sm text-muted-foreground">
                      {field.bool ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ) : field.kind === "json" ? (
                  <textarea
                    id={`cfg-${key}`}
                    className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={field.text}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], text: e.target.value },
                      }))
                    }
                  />
                ) : (
                  <Input
                    id={`cfg-${key}`}
                    type={field.kind === "number" ? "number" : "text"}
                    value={field.text}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], text: e.target.value },
                      }))
                    }
                  />
                )}
              </div>
            );
          })}

          {canManage && (
            <div className="border-t pt-4 space-y-2">
              <Label className="text-sm font-medium">Add a setting</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-[220px]"
                  placeholder="setting key (e.g. banner_text)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <Select value={newKind} onValueChange={(v) => setNewKind(v as FieldKind)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">On/Off</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addKey}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {canManage && (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
