"use client";

/**
 * ChildSwitcher — the parent portal's spine (44.2 / Part 39: "child-switcher
 * header (persona)").
 *
 * The backend ALREADY scopes every child endpoint by ?student_id= (see
 * parent_app.py `_pick_students`); the old web pages simply never sent it
 * and silently showed children[0]. This hook owns the selection (persisted
 * per device, shared query cache with the dashboard payload) and the row of
 * persona chips. For one-child accounts the row renders nothing.
 *
 * Research notes: multi-profile switchers (banking/parent apps) put the
 * switcher in the header, above the content it controls, with the active
 * profile unmistakably highlighted — recognition over recall.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ParentChild = {
  id: string;
  name: string;
  class_name?: string;
  roll_no?: number;
  attendance_pct?: number;
  fees_due?: number;
  today_status?: string | null;
  photo_url?: string | null;
};

const STORAGE_KEY = "parent_active_child";

/**
 * Module-level store (pub/sub) so the switcher chips and every child-scoped
 * query on the same page share ONE selection without a provider — the pages
 * call useSelectedChild() independently.
 */
const listeners = new Set<() => void>();
let currentId: string | null = null;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    currentId = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    currentId = null;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot() {
  hydrate();
  return currentId;
}

function setStoredId(id: string) {
  currentId = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  listeners.forEach((fn) => fn());
}

type DashPayload = { children: ParentChild[]; recent_notices?: unknown[] };

export function useParentDashboard() {
  return useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashPayload>>("/parent/dashboard");
      return res.data.data;
    },
  });
}

export function useSelectedChild() {
  const dash = useParentDashboard();
  const children = dash.data?.children || [];
  const stored = React.useSyncExternalStore(subscribe, getSnapshot, () => null);

  const selectedId =
    children.find((c) => c.id === stored)?.id || children[0]?.id || "";

  const setSelected = React.useCallback((id: string) => setStoredId(id), []);

  const selected = children.find((c) => c.id === selectedId) || null;

  /** query-string fragment for child-scoped endpoints ("" when none). */
  const childParam = selectedId ? `student_id=${encodeURIComponent(selectedId)}` : "";

  return { dash, children, selected, selectedId, setSelected, childParam };
}

export function ChildSwitcher() {
  const { children, selectedId, setSelected } = useSelectedChild();
  if (children.length <= 1) return null;
  return (
    <div
      role="tablist"
      aria-label="Select child"
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
    >
      {children.map((c) => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => setSelected(c.id)}
            className={cn(
              "flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "text-white"
                : "hover:bg-[var(--w11-control-hover)]",
            )}
            style={
              active
                ? { background: "var(--w11-accent,#0f6cbd)", borderColor: "var(--w11-accent,#0f6cbd)" }
                : { borderColor: "var(--w11-border-default,rgba(0,0,0,.12))", color: "var(--w11-text-primary,#1b1b1b)" }
            }
          >
            <Avatar name={c.name} src={c.photo_url} size="sm" />
            <span className="max-w-[10rem] truncate">{c.name}</span>
            {c.class_name && (
              <span className={cn("text-xs", active ? "opacity-80" : "opacity-60")}>{c.class_name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
