"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/aos/kit/page-kit";

/**
 * AOS kit — detail-object components (plan 31.2 G6/G7 + 11.css adoption G3).
 *
 * ObjectHeader: the persona-style header every detail page (A2 archetype)
 * renders — avatar/name/code/status chip + quick actions.
 * EditableField: inline text→input edit (Enter saves, Esc cancels).
 * ListView: pick-one-from-many rows over win11-listview.
 * TreeView: hierarchical browser over win11-treeview (files, layers,
 * curriculum, capabilities).
 */

/* ── ObjectHeader (persona) ─────────────────────────────────────────────── */

export function ObjectHeader({
  name,
  nameNepali,
  code,
  status,
  codeLabel,
  avatar,
  actions,
  meta,
  className,
}: {
  name: React.ReactNode;
  nameNepali?: React.ReactNode;
  /** Roll no / admission no / receipt number — the human-looking identifier. */
  code?: React.ReactNode;
  codeLabel?: string;
  /** Semantic status string — rendered via StatusChip's map. */
  status?: string;
  avatar?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("win11-persona flex items-start gap-4 p-4", className)}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="text-[18px] font-semibold leading-tight truncate"
            style={{ color: "var(--w11-text-primary)" }}
          >
            {name}
          </h1>
          {status && <StatusChip status={status} />}
        </div>
        {nameNepali && (
          <p
            className="text-[13px] truncate"
            style={{ color: "var(--w11-text-secondary)" }}
          >
            {nameNepali}
          </p>
        )}
        {code && (
          <p className="text-[12px] mt-0.5" style={{ color: "var(--w11-text-tertiary)" }}>
            {codeLabel ? `${codeLabel}: ` : ""}
            {code}
          </p>
        )}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

/* ── EditableField (G7) ─────────────────────────────────────────────────── */

export function EditableField({
  value,
  onSave,
  placeholder = "—",
  inputType = "text",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  inputType?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (disabled) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (!editing) {
    return (
      <span className={cn("inline-flex items-center gap-1 group", className)}>
        <span className="truncate">{value || placeholder}</span>
        <button
          type="button"
          aria-label={ariaLabel ? `Edit ${ariaLabel}` : "Edit"}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--w11-text-tertiary)" }}
          onClick={() => {
            setDraft(value || "");
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        type={inputType}
        value={draft}
        disabled={saving}
        aria-label={ariaLabel}
        className="h-7 text-[13px] px-2"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        aria-label="Save"
        disabled={saving}
        onClick={() => void commit()}
        style={{ color: "var(--w11-accent)" }}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Cancel"
        disabled={saving}
        onClick={() => setEditing(false)}
        style={{ color: "var(--w11-text-tertiary)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/* ── ListView (G3) — pick-one-from-many over win11-listview ─────────────── */

export interface ListViewNode {
  id: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
}

export function ListView({
  items,
  selectedId,
  onSelect,
  empty,
  className,
  "aria-label": ariaLabel,
}: {
  items: ListViewNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  if (!items.length && empty) return <>{empty}</>;
  return (
    <ul className={cn("win11-listview", className)} role="listbox" aria-label={ariaLabel}>
      {items.map((item) => (
        <li
          key={item.id}
          role="option"
          aria-selected={item.id === selectedId}
          tabIndex={item.disabled ? -1 : 0}
          className={cn(
            "cursor-pointer",
            item.disabled && "opacity-50 pointer-events-none"
          )}
          onClick={() => onSelect?.(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect?.(item.id);
            }
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] truncate" style={{ color: "var(--w11-text-primary)" }}>
              {item.primary}
            </div>
            {item.secondary && (
              <div className="text-[11px] truncate" style={{ color: "var(--w11-text-tertiary)" }}>
                {item.secondary}
              </div>
            )}
          </div>
          {item.trailing}
        </li>
      ))}
    </ul>
  );
}

/* ── TreeView (G3) — hierarchical browser over win11-treeview ───────────── */

export interface TreeNode {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
}

export function TreeView({
  nodes,
  selectedId,
  onSelect,
  className,
  "aria-label": ariaLabel,
}: {
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("win11-treeview", className)} role="tree" aria-label={ariaLabel}>
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(node.defaultOpen ?? false);
  const hasChildren = !!node.children?.length;
  const selected = node.id === selectedId;
  return (
    <div role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={selected}>
      <div
        className={cn("flex items-center gap-1 cursor-pointer rounded px-1.5 py-1", selected && "win11-selected")}
        style={{ paddingLeft: 8 + depth * 16 }}
        tabIndex={0}
        onClick={() => (hasChildren ? setOpen((o) => !o) : onSelect?.(node.id))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            hasChildren ? setOpen((o) => !o) : onSelect?.(node.id);
          }
          if (e.key === "ArrowRight" && hasChildren) setOpen(true);
          if (e.key === "ArrowLeft" && hasChildren) setOpen(false);
        }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span
          className="text-[13px] truncate flex-1"
          style={{ color: "var(--w11-text-primary)" }}
        >
          {node.label}
        </span>
        {node.trailing}
      </div>
      {hasChildren && open && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
