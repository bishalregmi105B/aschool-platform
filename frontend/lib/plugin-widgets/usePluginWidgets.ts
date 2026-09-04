"use client";

/**
 * usePluginWidgets — fetch the widget specs for a slot, and the data for one.
 *
 * Two hooks, deliberately separate:
 *   * `usePluginWidgets(slot)` asks the server which widgets this school/role may
 *     render there. One request per slot, cached by react-query.
 *   * `useWidgetData(widget)` fetches that widget's own endpoint, honouring its
 *     declared refresh mode and cache TTL.
 *
 * Gating is not re-implemented here: the server already omitted anything the
 * caller may not see, so there is no client-side filter to get wrong.
 */

import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { api, type ApiResponse } from "@/lib/api";
import {
  getPath,
  resolveEndpoint,
  resolveParams,
  type BindingScope,
} from "./bindings";
import type { WidgetSpec, WidgetsResponse } from "./types";

export function usePluginWidgets(
  slot: string,
  surface: "web" | "mobile" = "web",
  enabled = true
) {
  const query = useQuery({
    queryKey: ["plugin-widgets", surface, slot],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<WidgetsResponse>>(
        "/plugins/widgets",
        { params: { surface, slot } }
      );
      if (!res.data.success) throw new Error("Could not load widgets");
      return res.data.data;
    },
  });

  return {
    widgets: query.data?.widgets ?? [],
    defaultLayout: query.data?.default_layout ?? [],
    isLoading: query.isLoading,
    error: query.error ? "Could not load dashboard widgets" : null,
    refetch: query.refetch,
  };
}

export interface UseWidgetDataResult {
  data: unknown;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** True when the endpoint could not be built (missing context value). */
  unresolved: boolean;
}

export function useWidgetData(
  widget: WidgetSpec,
  scope: BindingScope,
  extraParams?: Record<string, string>
): UseWidgetDataResult {
  const source = widget.data?.source ?? (widget.data?.endpoint ? "api" : undefined);
  const endpoint = widget.data?.endpoint
    ? resolveEndpoint(widget.data.endpoint, scope)
    : null;
  const params = React.useMemo(
    () => ({ ...resolveParams(widget.data?.params, scope), ...(extraParams ?? {}) }),
    // scope contains a payload reference that changes every render for
    // dependent widgets; only the identifying parts matter for the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      widget.id,
      JSON.stringify(widget.data?.params ?? {}),
      JSON.stringify(scope.context ?? {}),
      JSON.stringify(scope.route ?? {}),
      JSON.stringify(extraParams ?? {}),
    ]
  );

  const refreshMode = widget.data?.refresh?.mode ?? "none";
  const intervalMs =
    refreshMode === "poll" && widget.data?.refresh?.interval_s
      ? widget.data.refresh.interval_s * 1000
      : false;

  const query = useQuery({
    queryKey: ["plugin-widget-data", widget.id, endpoint, params],
    enabled: source === "api" && Boolean(endpoint),
    staleTime: (widget.data?.cache_ttl_s ?? 60) * 1000,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: refreshMode === "on_focus",
    queryFn: async () => {
      const res = await api.get<ApiResponse<unknown>>(endpoint as string, {
        params,
      });
      if (!res.data.success) {
        throw new Error(
          typeof res.data.error === "string"
            ? res.data.error
            : "Request failed"
        );
      }
      // `select` addresses the whole envelope, so `data.class_wise` works and a
      // widget can also read `meta.pagination`.
      const selector = widget.data?.select;
      return selector ? getPath(res.data, selector) : res.data.data;
    },
  });

  const errorMessage = query.error
    ? (query.error as Error).message || "Could not load this widget"
    : null;

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: errorMessage,
    refetch: query.refetch,
    unresolved: source === "api" && !endpoint,
  };
}
