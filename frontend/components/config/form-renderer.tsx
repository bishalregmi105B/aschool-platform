"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

/**
 * FormRenderer — the config dialect v2 form (PTTA §3.2, 18 typed fields).
 *
 * One component, no plugin code: plugins declare, the host renders. The
 * server is the validator — client-side `visible_when` evaluation only
 * mirrors what validate_config enforces, so a stale client can never grant
 * itself a field the server would reject.
 */

export interface V2Field {
  key: string;
  group?: string;
  type: string;
  label?: string;
  label_ne?: string | null;
  help?: string;
  help_ne?: string | null;
  placeholder?: string;
  default?: unknown;
  unit?: string;
  validate?: {
    min?: number;
    max?: number;
    step?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    min_items?: number;
    max_items?: number;
  };
  visible_when?: Record<string, unknown>;
  roles?: string[];
  requires_plugins?: string[];
  advanced?: boolean;
  readonly?: boolean;
  options?: Array<{ value: string; label: string }>;
  entity?: string;
  entity_filter?: Record<string, unknown>;
  accept?: string[];
  max_size_mb?: number;
  keys?: string[];
  item_fields?: V2Field[];
  multiple?: boolean;
  multiline?: boolean;
  format?: string;
  write_only?: boolean;
}

export interface V2Schema {
  schema_version: number;
  config_version: number;
  groups?: Array<{
    key: string;
    label?: string;
    label_ne?: string | null;
    description?: string;
    collapsed?: boolean;
  }>;
  fields: V2Field[];
}

// ── dot-path helpers ───────────────────────────────────────────────────────

export function getPath(obj: unknown, dotted: string): unknown {
  let node: unknown = obj;
  for (const part of dotted.split(".")) {
    if (!node || typeof node !== "object" || !(part in (node as Record<string, unknown>))) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

export function setPath(obj: Record<string, unknown>, dotted: string, value: unknown): void {
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

// ── visibility (mirrors backend _cond_met) ─────────────────────────────────

function num(v: unknown): number {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function condMet(cond: Record<string, unknown> | undefined, values: Record<string, unknown>): boolean {
  if (!cond) return true;
  if ("all_of" in cond) {
    return (cond.all_of as Record<string, unknown>[]).every((c) => condMet(c, values));
  }
  if ("any_of" in cond) {
    return (cond.any_of as Record<string, unknown>[]).some((c) => condMet(c, values));
  }
  const actual = getPath(values, String(cond.field ?? ""));
  if ("eq" in cond) return actual === cond.eq;
  if ("ne" in cond) return actual !== cond.ne;
  if ("truthy" in cond) return Boolean(actual) === Boolean(cond.truthy);
  if ("gt" in cond) return num(actual) > num(cond.gt);
  if ("lt" in cond) return num(actual) < num(cond.lt);
  if ("in" in cond) {
    const wanted = (cond.in as unknown[]) || [];
    if (Array.isArray(actual)) return actual.some((a) => wanted.includes(a));
    return wanted.includes(actual);
  }
  return true;
}

// ── entity-picker search endpoints ─────────────────────────────────────────

const ENTITY_SOURCES: Record<string, { url: string; label: (r: Record<string, unknown>) => string }> = {
  student: { url: "/students", label: (r) => String(r.full_name || r.name || r.id) },
  teacher: { url: "/staff?role=teacher", label: (r) => String(r.full_name || r.name || r.id) },
  user: { url: "/staff", label: (r) => String(r.full_name || r.name || r.id) },
  class: { url: "/academics/classes", label: (r) => String(r.name || r.id) },
  section: { url: "/academics/sections", label: (r) => String(r.name || r.id) },
  subject: { url: "/academics/subjects", label: (r) => String(r.name || r.id) },
};

// ── field controls ─────────────────────────────────────────────────────────

interface ControlProps {
  field: V2Field;
  id: string;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}

function StringControl({ field, id, value, disabled, onChange }: ControlProps) {
  if (field.multiline || field.type === "text" || field.type === "markdown") {
    return (
      <Textarea
        id={id}
        rows={field.type === "markdown" ? 6 : 3}
        value={value == null ? "" : String(value)}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={value == null ? "" : String(value)}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.unit && (
        <span className="text-muted-foreground whitespace-nowrap text-sm">{field.unit}</span>
      )}
    </div>
  );
}

function NumberControl({ field, id, value, disabled, onChange }: ControlProps) {
  const v = value == null ? "" : String(value);
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="number"
        min={field.validate?.min}
        max={field.validate?.max}
        step={field.validate?.step ?? (field.type === "int" ? 1 : "any")}
        value={v}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = field.type === "int" ? parseInt(raw, 10) : Number(raw);
          onChange(Number.isNaN(n) ? raw : n);
        }}
      />
      {field.unit && (
        <span className="text-muted-foreground whitespace-nowrap text-sm">{field.unit}</span>
      )}
    </div>
  );
}

function EnumControl({ field, id, value, disabled, onChange }: ControlProps) {
  const options = field.options || [];
  const searchable = options.length > 8;
  return (
    <Select
      value={value == null ? "" : String(value)}
      disabled={disabled}
      onValueChange={(v) => onChange(v)}
    >
      <SelectTrigger id={id} className="w-[260px]">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {searchable && (
          <div className="p-1.5">
            <Input
              placeholder="Search…"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                // filter items by data-value match
                const q = e.target.value.toLowerCase();
                const content = e.target.closest("[role=listbox], [data-radix-popper-content-wrapper]");
                content?.querySelectorAll<HTMLElement>("[data-value]").forEach((item) => {
                  item.style.display = item.textContent?.toLowerCase().includes(q) ? "" : "none";
                });
              }}
            />
          </div>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiEnumControl({ field, id, value, disabled, onChange }: ControlProps) {
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div id={id} className="flex flex-wrap gap-3">
      {(field.options || []).map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
          <Checkbox
            disabled={disabled}
            checked={selected.includes(o.value)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, o.value]
                  : selected.filter((v) => v !== o.value)
              )
            }
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function SecretControl({ field, id, value, error, disabled, onChange }: ControlProps) {
  const [replacing, setReplacing] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const envelope =
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  if (envelope?.__secret__ && !replacing) {
    return (
      <div className="flex items-center gap-2">
        <Input value={`••••••••${envelope.last4 ?? ""}`} readOnly disabled={disabled} />
        {!disabled && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-red-600"
              onClick={() => onChange(null)}
            >
              Clear
            </Button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {Boolean(envelope?.__secret__) && (
        <p className="text-muted-foreground text-xs">
          Leave empty and save to keep the stored value.
        </p>
      )}
    </div>
  );
}

function ColorControl({ field, id, value, disabled, onChange }: ControlProps) {
  const v = typeof value === "string" ? value : "";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={field.label}
        className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
        value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#2563eb"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        id={id}
        className="max-w-[140px] font-mono"
        value={v}
        placeholder="#2563EB"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ColorMapControl({ field, id, value, disabled, onChange }: ControlProps) {
  const map = (value && typeof value === "object" ? value : {}) as Record<string, string>;
  return (
    <div className="space-y-2">
      {(field.keys || []).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-28 text-sm capitalize">{k.replace(/[_-]/g, " ")}</span>
          <input
            type="color"
            aria-label={`${field.label} ${k}`}
            className="h-8 w-10 cursor-pointer rounded border border-input"
            value={/^#[0-9a-fA-F]{6}$/.test(map[k] || "") ? map[k] : "#2563eb"}
            disabled={disabled}
            onChange={(e) => onChange({ ...map, [k]: e.target.value })}
          />
          <Input
            className="max-w-[120px] font-mono text-xs"
            value={map[k] || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...map, [k]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function EntityPickerControl({ field, id, value, disabled, onChange }: ControlProps) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const source = ENTITY_SOURCES[field.entity || "user"] ?? ENTITY_SOURCES.user;

  const { data: options, isFetching } = useQuery({
    queryKey: ["entity-picker", field.entity, search],
    queryFn: async () => {
      const sep = source.url.includes("?") ? "&" : "?";
      const res = await api.get(`${source.url}${sep}search=${encodeURIComponent(search)}&per_page=20`);
      return (res.data?.data?.items || res.data?.data || []) as Array<Record<string, unknown>>;
    },
    enabled: open,
  });

  const displayId = typeof value === "string" ? value : "";

  return (
    <div className="relative">
      <Input
        id={id}
        value={open ? search : displayId || ""}
        placeholder={displayId ? undefined : `Search ${field.entity}…`}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="bg-popover absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md">
          {isFetching && (
            <div className="text-muted-foreground flex items-center gap-2 p-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!isFetching && (options || []).length === 0 && (
            <div className="text-muted-foreground p-2 text-sm">No matches.</div>
          )}
          {(options || []).map((row) => {
            const rid = String(row.id);
            return (
              <button
                key={rid}
                type="button"
                className="hover:bg-accent block w-full px-3 py-1.5 text-left text-sm"
                onClick={() => {
                  onChange(rid);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {source.label(row)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JsonControl({ field, id, value, error, disabled, onChange }: ControlProps) {
  const [text, setText] = React.useState(() =>
    value == null ? "" : JSON.stringify(value, null, 2)
  );
  const [localError, setLocalError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (value == null) return;
    setText(JSON.stringify(value, null, 2));
  }, [value]);
  return (
    <div className="space-y-1">
      <textarea
        id={id}
        className="border-input bg-background focus-visible:ring-ring flex min-h-[110px] w-full rounded-md border px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            onChange(next.trim() === "" ? null : JSON.parse(next));
            setLocalError(null);
          } catch {
            setLocalError("Invalid JSON");
          }
        }}
      />
      {(localError || error) && <p className="text-destructive text-xs">{localError || error}</p>}
    </div>
  );
}

function CronControl({ field, id, value, disabled, onChange }: ControlProps) {
  const v = typeof value === "string" ? value : "";
  const parts = v.split(/\s+/);
  const presets: Array<[string, string]> = [
    ["Daily 08:00", "0 8 * * *"],
    ["Daily 16:00", "0 16 * * *"],
    ["Hourly", "0 * * * *"],
    ["Every 15 min", "*/15 * * * *"],
    ["Mondays 07:00", "0 7 * * 1"],
  ];
  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        className="max-w-[220px] font-mono"
        value={v}
        placeholder="0 8 * * *"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([label, cron]) => (
          <Button
            key={cron}
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={disabled}
            onClick={() => onChange(cron)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ListControl({ field, id, value, disabled, onChange, renderSubField }: ControlProps & {
  renderSubField: (sub: V2Field, item: Record<string, unknown>, setItem: (next: Record<string, unknown>) => void, idx: number) => React.ReactNode;
}) {
  const items: Array<Record<string, unknown>> = Array.isArray(value)
    ? (value as Array<Record<string, unknown>>)
    : [];
  const setItem = (idx: number, next: Record<string, unknown>) => {
    const copy = [...items];
    copy[idx] = next;
    onChange(copy);
  };
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">#{idx + 1}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-6 px-2 hover:text-red-600"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {(field.item_fields || []).map((sub) =>
            renderSubField(sub, item, (next) => setItem(idx, next), idx)
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            field.validate?.max_items != null && items.length >= field.validate.max_items
          }
          onClick={() => onChange([...items, {}])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add item
        </Button>
      )}
    </div>
  );
}

function FileControl({ field, id, value, disabled, onChange }: ControlProps) {
  const ref =
    value && typeof value === "object"
      ? (value as { id?: string; name?: string; url?: string })
      : null;
  return (
    <div className="space-y-1.5">
      {ref?.id ? (
        <div className="flex items-center gap-2">
          <a
            href={ref.url || "#"}
            target="_blank"
            rel="noreferrer"
            className="text-primary max-w-[280px] truncate text-sm underline"
          >
            {ref.name || ref.id}
          </a>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 className="text-muted-foreground h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept={(field.accept || []).join(",")}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange({ id: null, name: file.name, size: file.size, url: null, _pending: file });
          }}
        />
      )}
      {field.max_size_mb && (
        <p className="text-muted-foreground text-xs">Up to {field.max_size_mb} MB.</p>
      )}
    </div>
  );
}

function DateControl({ field, id, value, disabled, onChange }: ControlProps) {
  if (field.type === "bs_date") {
    return (
      <BSDateInput
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(v) => onChange(v)}
      />
    );
  }
  return (
    <BSDateInput
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(v) => onChange(v)}
    />
  );
}

// ── the renderer ───────────────────────────────────────────────────────────

export interface FormRendererProps {
  schema: V2Schema;
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  disabled?: boolean;
  installedPlugins?: string[];
  onChange: (key: string, value: unknown) => void;
}

export function FormRenderer({
  schema,
  values,
  errors = {},
  disabled,
  installedPlugins = [],
  onChange,
}: FormRendererProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries((schema.groups || []).map((g) => [g.key, !!g.collapsed]))
  );

  const visible = schema.fields.filter((f) => {
    if (f.advanced && !showAdvanced) return false;
    if (!condMet(f.visible_when, values)) return false;
    if (f.requires_plugins?.length && f.requires_plugins.some((p) => !installedPlugins.includes(p)))
      return false;
    if (f.write_only && disabled) return false;
    return true;
  });

  const renderField = (f: V2Field, overrideValues?: Record<string, unknown>, overrideChange?: (key: string, v: unknown) => void) => {
    const vals = overrideValues ?? values;
    const change = overrideChange ?? onChange;
    const baseId = `cfg-${f.key.replace(/\./g, "-")}`;
    const value = getPath(vals, f.key);
    const error = errors[f.key];
    const disabledHere = disabled || !!f.readonly;
    const props: ControlProps = {
      field: f,
      id: baseId,
      value,
      error,
      disabled: disabledHere,
      onChange: (next) => change(f.key, next),
    };

    let control: React.ReactNode;
    switch (f.type) {
      case "boolean":
        control = (
          <div className="flex h-9 items-center gap-3">
            <Switch
              id={baseId}
              checked={value === true}
              disabled={disabledHere}
              onCheckedChange={(checked) => change(f.key, checked)}
            />
            <span className="text-muted-foreground text-sm">
              {value === true ? "Enabled" : "Disabled"}
            </span>
          </div>
        );
        break;
      case "int":
      case "number":
        control = <NumberControl {...props} />;
        break;
      case "enum":
        control = <EnumControl {...props} />;
        break;
      case "multi-enum":
        control = <MultiEnumControl {...props} />;
        break;
      case "color":
        control = <ColorControl {...props} />;
        break;
      case "color-map":
        control = <ColorMapControl {...props} />;
        break;
      case "secret":
        control = <SecretControl {...props} />;
        break;
      case "cron":
        control = <CronControl {...props} />;
        break;
      case "date":
      case "bs_date":
        control = <DateControl {...props} />;
        break;
      case "json":
        control = <JsonControl {...props} />;
        break;
      case "entity-picker":
        control = f.multiple ? (
          <p className="text-muted-foreground text-sm">Multi-select picker ships with the next wave.</p>
        ) : (
          <EntityPickerControl {...props} />
        );
        break;
      case "file":
        control = <FileControl {...props} />;
        break;
      case "list":
        control = (
          <ListControl
            {...props}
            renderSubField={(sub, item, setItem) => {
              const subValue = getPath(item, sub.key);
              return (
                <div key={sub.key} className="space-y-1">
                  <Label className="text-xs">{sub.label || sub.key}</Label>
                  {renderControlFor(sub, subValue, (next) => {
                    const copy = { ...item };
                    setPath(copy, sub.key, next);
                    setItem(copy);
                  })}
                </div>
              );
            }}
          />
        );
        break;
      case "time":
        control = (
          <TimePicker
            value={typeof value === "string" ? value : ""}
            disabled={disabledHere}
            onChange={(v) => change(f.key, v)}
          />
        );
        break;
      default:
        control = <StringControl {...props} />;
    }

    const showKey = f.key !== f.label && !f.label;

    return (
      <div key={`${vals === values ? "" : "sub-"}${f.key}`} className="space-y-1.5">
        {f.type !== "boolean" && (
          <div className="flex items-center justify-between">
            <Label htmlFor={baseId}>{f.label || f.key}</Label>
            <div className="flex items-center gap-2">
              {f.type !== "string" && f.type !== "text" && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {f.type}
                </Badge>
              )}
              {showKey && (
                <span className="text-muted-foreground font-mono text-[10px]">{f.key}</span>
              )}
            </div>
          </div>
        )}
        {control}
        {error && <p className="text-destructive text-xs">{error}</p>}
        {f.help && !error && <p className="text-muted-foreground text-xs">{f.help}</p>}
      </div>
    );
  };

  function renderControlFor(sub: V2Field, value: unknown, change: (next: unknown) => void) {
    const shallow: V2Field = { ...sub, visible_when: undefined };
    return renderField(shallow, { [sub.key]: value }, (key, v) => change(v));
  }

  const groups = schema.groups || [];
  const ungrouped = visible.filter((f) => !f.group);
  const byGroup = (key: string) => visible.filter((f) => f.group === key);

  const hasMultipleGroups =
    groups.filter((g) => byGroup(g.key).length > 0).length > 1 || (ungrouped.length > 0 && groups.some((g) => byGroup(g.key).length > 0));

  const renderFieldset = (fields: V2Field[]) => (
    <div className="space-y-5">{fields.map((f) => renderField(f))}</div>
  );

  if (hasMultipleGroups) {
    const firstGroupKey =
      ungrouped.length > 0 ? "__general" : groups.find((g) => byGroup(g.key).length > 0)!.key;
    return (
      <div className="space-y-4">
        <Tabs defaultValue={firstGroupKey}>
          <TabsList className="flex-wrap">
            {ungrouped.length > 0 && <TabsTrigger value="__general">General</TabsTrigger>}
            {groups
              .filter((g) => byGroup(g.key).length > 0)
              .map((g) => (
                <TabsTrigger key={g.key} value={g.key}>
                  {g.label || g.key}
                </TabsTrigger>
              ))}
          </TabsList>
          {ungrouped.length > 0 && (
            <TabsContent value="__general" className="pt-4">
              {renderFieldset(ungrouped)}
            </TabsContent>
          )}
          {groups
            .filter((g) => byGroup(g.key).length > 0)
            .map((g) => (
              <TabsContent key={g.key} value={g.key} className="pt-4">
                {g.description && (
                  <p className="text-muted-foreground mb-4 text-sm">{g.description}</p>
                )}
                {renderFieldset(byGroup(g.key))}
              </TabsContent>
            ))}
        </Tabs>
        {schema.fields.some((f) => f.advanced) && (
          <AdvancedToggle show={showAdvanced} onToggle={() => setShowAdvanced((s) => !s)} />
        )}
      </div>
    );
  }

  // Fieldset mode: single group or none — collapsible when the group says so.
  const singleGroup = groups.find((g) => byGroup(g.key).length > 0 && ungrouped.length === 0);
  const allFields = [...ungrouped, ...(singleGroup ? byGroup(singleGroup.key) : [])];
  const isCollapsed = singleGroup ? collapsed[singleGroup.key] : false;

  return (
    <div className="space-y-4">
      {singleGroup ? (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setCollapsed((c) => ({ ...c, [singleGroup.key]: !isCollapsed }))}
          >
            <CardTitle className="flex items-center gap-2 text-base">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {singleGroup.label || singleGroup.key}
            </CardTitle>
            {singleGroup.description && !isCollapsed && (
              <CardDescription>{singleGroup.description}</CardDescription>
            )}
          </CardHeader>
          {!isCollapsed && <CardContent>{renderFieldset(allFields)}</CardContent>}
        </Card>
      ) : (
        renderFieldset(allFields)
      )}
      {schema.fields.some((f) => f.advanced) && (
        <AdvancedToggle show={showAdvanced} onToggle={() => setShowAdvanced((s) => !s)} />
      )}
    </div>
  );
}

function AdvancedToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      onClick={onToggle}
    >
      {show ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {show ? "Hide advanced settings" : "Show advanced settings"}
    </button>
  );
}
