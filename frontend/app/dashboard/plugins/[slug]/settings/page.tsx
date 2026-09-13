"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAOSPathParam } from "@/lib/aos-window-route";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  FormRenderer,
  getPath as frGetPath,
  setPath as frSetPath,
  type V2Schema,
} from "@/components/config/form-renderer";
import { ArrowLeft, Plus, Save, Trash2, Plug } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

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
  const slug = useAOSPathParam(2) || (typeof params?.slug === "string" ? params.slug : "");
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
  // v2 dialects (schema_version: 2) render through FormRenderer; v1 keeps
  // the original typed-drafts editor below.
  const { data: schema } = useQuery({
    queryKey: ["plugin-config-schema", slug],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ConfigSchema & { schema_version?: number }>>(
        `/plugins/${slug}/config-schema`
      );
      return res.data.data || null;
    },
    enabled: !!slug,
  });

  const isV2 = Boolean(
    schema?.has_schema && (schema as { schema_version?: number }).schema_version === 2
  );
  const v2Schema = (isV2 ? (schema as unknown as V2Schema) : null);

  const schemaFields = useMemo(
    () => (schema?.has_schema ? schema.fields : []),
    [schema]
  );

  const [schemaDrafts, setSchemaDrafts] = useState<Record<string, DraftField>>({});
  const [v2Values, setV2Values] = useState<Record<string, unknown>>({});
  const [v2Errors, setV2Errors] = useState<Record<string, string>>({});
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
    if (v2Schema) {
      // Stored values first; undeclared defaults filled for display only.
      const base: Record<string, unknown> = JSON.parse(JSON.stringify(clean));
      for (const f of v2Schema.fields) {
        const current = frGetPath(base, f.key);
        if (current === undefined && f.default !== undefined) {
          frSetPath(base, f.key, f.default);
        }
      }
      setV2Values(base);
      return;
    }
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
  }, [data, schemaFields, schemaTopKeys, v2Schema]);

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
      setV2Errors({});
      toast.success("Settings saved");
    },
    onError: (err: unknown) => {
      // v2 validation: 422 with a field-keyed errors dict → render inline.
      const resp = (err as { response?: { status?: number; data?: { data?: { errors?: Record<string, string> }; error?: string } } })
        ?.response;
      if (resp?.status === 422 && resp.data?.data?.errors) {
        setV2Errors(resp.data.data.errors);
        toast.error("Fix the highlighted fields and save again");
        return;
      }
      const msg =
        err && typeof err === "object" && "response" in err
          ? (resp?.data?.error ?? "Could not save settings")
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

    if (v2Schema) {
      // v2: schema values live at their dot-paths inside v2Values (which
      // started from the stored config). Secret envelopes untouched by the
      // user pass through unchanged; the server re-validates everything.
      const merged = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
      // Drop removed extras (keys not in v2Values' top level and not claimed
      // by the schema) so ?replace=1 keeps the editor's delete affordance.
      for (const key of Object.keys(merged)) {
        const claimed = v2Schema.fields.some((f) => f.key.split(".")[0] === key);
        if (!claimed && !(key in v2Values)) delete merged[key];
      }
      for (const [key, value] of Object.entries(v2Values)) {
        frSetPath(merged, key, value);
      }
      saveMutation.mutate(merged);
      return;
    }

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

  if (isLoading) return <AOSModuleLoadingState label="Loading plugin settings…" />;

  if (isError || !data) {
    const status =
      (error as { response?: { status?: number } })?.response?.status ?? null;
    return (
      <AOSPage>
        <AOSPageHeader
          title={getPluginDisplayName(slug)}
          subtitle="Per-school configuration for this plugin"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/plugins">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Installed Plugins
              </Link>
            </Button>
          }
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl" title={getPluginDisplayName(slug)}>
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              {status === 404
                ? "This plugin is not installed on your school — install it from the marketplace to configure it."
                : "Settings could not be loaded. Please try again."}
            </p>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const extraKeys = Object.keys(extraDrafts);
  const hasSchema = schemaFields.length > 0;

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Plug className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={
          <span className="flex items-center gap-3">
            {getPluginDisplayName(slug)}
            <Badge variant="secondary" className="font-mono text-xs">{slug}</Badge>
          </span>
        }
        subtitle={
          <>
            Per-school configuration for this plugin. Changes apply immediately
            after saving.
            {!canManage && " (Only school admins can save changes.)"}
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/plugins">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Installed Plugins
            </Link>
          </Button>
        }
      />
      <AOSPageBody>
        <div className="space-y-4 max-w-3xl">

      {v2Schema && (
        <FormRenderer
          schema={v2Schema}
          values={v2Values}
          errors={v2Errors}
          disabled={!canManage}
          onChange={(key, value) => {
            setV2Values((prev) => {
              const next = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
              frSetPath(next, key, value);
              return next;
            });
            setV2Errors((prev) => {
              if (!(key in prev)) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }}
        />
      )}

      {v2Schema && canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      )}

      {!v2Schema && hasSchema && (
        <DataPanel title="Settings">
          <div className="space-y-5">
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
              Defined by the plugin&apos;s settings schema — labels and
              defaults come from the plugin itself.
            </p>
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
                        <span className="font-mono text-[10px]" style={{ color: "var(--w11-text-tertiary)" }}>{f.key}</span>
                      )}
                    </div>
                  </div>
                  {renderControl(`cfg-${f.key}`, field, (next) =>
                    setSchemaDrafts((prev) => ({ ...prev, [f.key]: next }))
                  )}
                  {f.help && (
                    <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{f.help}</p>
                  )}
                </div>
              );
            })}
          </div>
        </DataPanel>
      )}

      {!v2Schema && (
      <DataPanel title={hasSchema ? "Other settings" : "Settings"}>
        <div className="space-y-5">
          <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
            {hasSchema
              ? "Additional keys this plugin stored that its schema doesn't declare."
              : "Text and number fields save as strings and numbers; checkboxes save as true/false; JSON fields save as their parsed value."}
          </p>
          {extraKeys.length === 0 && (
            <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
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
                  <Label htmlFor={`cfg-${key}`} className="font-mono text-xs" style={{ color: "var(--w11-text-secondary)" }}>
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
                        className="h-6 px-2"
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
            <div className="border-t border-[var(--w11-border-subtle)] pt-4 space-y-2">
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
            <div className="flex justify-end border-t border-[var(--w11-border-subtle)] pt-4">
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
        </div>
      </DataPanel>
      )}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
