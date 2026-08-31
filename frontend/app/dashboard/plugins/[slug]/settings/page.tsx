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
 * WP-style schema mode (2026-08-30): when the plugin ships a
 * config_schema.yaml (GET /plugins/<slug>/config-schema → {has_schema,
 * fields}), the declared fields render first as typed controls (dot-path
 * keys address nested config, e.g. ai_settings.working_hours.start); any
 * config keys NOT covered by the schema still get the generic editor below.
 * Without a schema the page falls back to the generic key/value editor.
 *
 * Value-type handling: string → text input, number → number input,
 * boolean → switch, anything else (arrays/objects/"unknown keys") → a JSON
 * textarea. The backend merges by default; the page always sends the FULL
 * dict with ?replace=1 so removed keys actually drop. The platform-reserved
 * `last_payment` key (subscribe audit trail) is never displayed or sent —
 * the server rejects client writes of it.
 */

type FieldKind = "string" | "number" | "boolean" | "json";

interface DraftField {
  kind: FieldKind;
  /** Raw editable representation: string for text/number/json, boolean for bool. */
  text: string;
  bool: boolean;
}

interface SchemaField {
  key: string;
  label?: string;
  type?: FieldKind;
  default?: unknown;
  help?: string;
}

interface ConfigSchema {
  slug: string;
  has_schema: boolean;
  fields: SchemaField[];
}

/** Platform-owned config keys — never client-writable (server 400s on them). */
const RESERVED_KEYS = ["last_payment"];

function classify(value: unknown): FieldKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

function toDraft(value: unknown, kind?: FieldKind): DraftField {
  const k = kind ?? classify(value);
  if (k === "boolean") return { kind: k, text: "", bool: value === true };
  if (k === "json") return { kind: k, text: JSON.stringify(value ?? null, null, 2), bool: false };
  return { kind: k, text: value == null ? "" : String(value), bool: false };
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

function getPath(obj: unknown, dotted: string): unknown {
  let node: unknown = obj;
  for (const part of dotted.split(".")) {
    if (!node || typeof node !== "object" || !(part in (node as Record<string, unknown>))) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function setPath(obj: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let node: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      node[parts[i]] = {};
    }
    node = node[parts[i]] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

function stripReserved(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([k]) => !RESERVED_KEYS.includes(k))
  );
}

function parseJsonDefault(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
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

  // Settings-screen definition from the plugin module (config_schema.yaml).
  const { data: schema } = useQuery({
    queryKey: ["plugin-config-schema", slug],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ConfigSchema>>(
        `/plugins/${slug}/config-schema`
      );
      return res.data.data || null;
    },
    enabled: !!slug,
  });

  const schemaFields = useMemo(
    () => (schema?.has_schema ? schema.fields : []),
    [schema]
  );

  const [schemaDrafts, setSchemaDrafts] = useState<Record<string, DraftField>>({});
  const [extraDrafts, setExtraDrafts] = useState<Record<string, DraftField>>({});
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState<FieldKind>("string");

  // Top-level config keys claimed by schema fields (dot-path roots).
  const schemaTopKeys = useMemo(
    () => new Set(schemaFields.map((f) => f.key.split(".")[0])),
    [schemaFields]
  );

  useEffect(() => {
    if (!data) return;
    const clean = stripReserved(data);
    if (schemaFields.length > 0) {
      setSchemaDrafts(
        Object.fromEntries(
          schemaFields.map((f) => [
            f.key,
            toDraft(getPath(clean, f.key) ?? f.default, f.type),
          ])
        )
      );
      setExtraDrafts(
        Object.fromEntries(
          Object.entries(clean)
            .filter(([k]) => !schemaTopKeys.has(k))
            .map(([k, v]) => [k, toDraft(v)])
        )
      );
    } else {
      setSchemaDrafts({});
      setExtraDrafts(
        Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, toDraft(v)]))
      );
    }
  }, [data, schemaFields, schemaTopKeys]);

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

  const handleSave = () => {
    // Base: the stored config (reserved keys stripped, deep-cloned) so unknown
    // nested structures survive the ?replace=1 full-dict save.
    const payload: Record<string, unknown> = data
      ? (JSON.parse(JSON.stringify(stripReserved(data))) as Record<string, unknown>)
      : {};
    // Extra (schema-undeclared) keys: validate, then REPLACE the top-level
    // keys not claimed by the schema — keys the user removed actually drop.
    const extras: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(extraDrafts)) {
      const parsed = fromDraft(field);
      if (!parsed.ok) {
        toast.error(`"${key}" ${parsed.error}`);
        return;
      }
      extras[key] = parsed.value;
    }
    for (const key of Object.keys(payload)) {
      if (!schemaTopKeys.has(key) && !(key in extras)) {
        delete payload[key];
      }
    }
    Object.assign(payload, extras);
    // Schema values set at their dot-paths last — they win over stored state.
    for (const [key, field] of Object.entries(schemaDrafts)) {
      const parsed = fromDraft(field);
      if (!parsed.ok) {
        toast.error(`"${key}" ${parsed.error}`);
        return;
      }
      setPath(payload, key, parsed.value);
    }
    saveMutation.mutate(payload);
  };

  const addKey = () => {
    const key = newKey.trim();
    if (!key) return;
    if (key.includes(".")) {
      toast.error("Use a plain key (nested paths are managed by the settings form)");
      return;
    }
    if (schemaTopKeys.has(key) || key in extraDrafts) {
      toast.error(`"${key}" already exists`);
      return;
    }
    if (RESERVED_KEYS.includes(key)) {
      toast.error(`"${key}" is reserved by the platform`);
      return;
    }
    setExtraDrafts((prev) => ({
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

  const renderControl = (
    id: string,
    field: DraftField,
    onChange: (next: DraftField) => void
  ) => {
    if (field.kind === "boolean") {
      return (
        <div className="flex h-9 items-center">
          <Switch
            id={id}
            checked={field.bool}
            disabled={!canManage}
            onCheckedChange={(checked) => onChange({ ...field, bool: checked })}
          />
          <span className="ml-3 text-sm text-muted-foreground">
            {field.bool ? "Enabled" : "Disabled"}
          </span>
        </div>
      );
    }
    if (field.kind === "json") {
      return (
        <textarea
          id={id}
          className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={field.text}
          disabled={!canManage}
          onChange={(e) => onChange({ ...field, text: e.target.value })}
        />
      );
    }
    return (
      <Input
        id={id}
        type={field.kind === "number" ? "number" : "text"}
        value={field.text}
        disabled={!canManage}
        onChange={(e) => onChange({ ...field, text: e.target.value })}
      />
    );
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

  const extraKeys = Object.keys(extraDrafts);
  const hasSchema = schemaFields.length > 0;

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

      {hasSchema && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Defined by the plugin&apos;s settings schema — labels and
              defaults come from the plugin itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {schemaFields.map((f) => {
              const field = schemaDrafts[f.key];
              if (!field) return null;
              return (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`cfg-${f.key}`}>{f.label || f.key}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {field.kind}
                      </Badge>
                      {f.key !== f.label && (
                        <span className="font-mono text-[10px] text-muted-foreground">{f.key}</span>
                      )}
                    </div>
                  </div>
                  {renderControl(`cfg-${f.key}`, field, (next) =>
                    setSchemaDrafts((prev) => ({ ...prev, [f.key]: next }))
                  )}
                  {f.help && (
                    <p className="text-xs text-muted-foreground">{f.help}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{hasSchema ? "Other settings" : "Settings"}</CardTitle>
          <CardDescription>
            {hasSchema
              ? "Additional keys this plugin stored that its schema doesn't declare."
              : "Text and number fields save as strings and numbers; checkboxes save as true/false; JSON fields save as their parsed value."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {extraKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {hasSchema
                ? "No additional settings."
                : "This plugin has no settings yet — add the first one below."}
            </p>
          )}

          {extraKeys.map((key) => {
            const field = extraDrafts[key];
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
                        onClick={() =>
                          setExtraDrafts((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          })
                        }
                        title={`Remove ${key} on save`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {renderControl(`cfg-${key}`, field, (next) =>
                  setExtraDrafts((prev) => ({ ...prev, [key]: next }))
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
