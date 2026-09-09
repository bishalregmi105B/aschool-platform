"use client";
/**
 * useServerTime — single subscription to the backend's authoritative clock.
 *
 * M-01: the header clock, form "today" defaults and BS picker initial values
 * previously used `new Date()` (the *browser* clock), which lies on
 * misconfigured lab machines. GET /meta/time is unauthenticated, polled
 * every 60s; consumers get the epoch and derive display strings so all
 * components tick in sync. Before the first response we hold null instead of
 * showing a possibly-wrong local time for a frame.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ServerTime {
  /** Milliseconds since epoch, corrected against server-reported time. */
  epochMs: number;
  timezone: string;
  dateAD: string; // YYYY-MM-DD at the server
}

let cachedOffsetMs: number | null = null;
let cachedDateAD: string | null = null;
let cachedTimezone = "Asia/Kathmandu";
const listeners = new Set<(t: ServerTime) => void>();

function broadcast() {
  if (cachedOffsetMs === null) return;
  const snapshot: ServerTime = {
    epochMs: Date.now() + cachedOffsetMs,
    timezone: cachedTimezone,
    dateAD: cachedDateAD ?? new Date(Date.now() + cachedOffsetMs).toISOString().slice(0, 10),
  };
  listeners.forEach((fn) => fn(snapshot));
}

async function sync() {
  try {
    const res = await api.get("/meta/time");
    const d = (res.data?.data ?? res.data) as {
      epoch_ms: number;
      timezone: string;
      date_ad: string;
    };
    if (typeof d?.epoch_ms === "number") {
      // Offset between server clock and browser clock; applied locally each
      // tick so the displayed clock keeps running between polls.
      cachedOffsetMs = d.epoch_ms - Date.now();
      cachedTimezone = d.timezone || cachedTimezone;
      cachedDateAD = d.date_ad || null;
      broadcast();
    }
  } catch {
    // Offline / pre-deploy backend: fall back to the browser clock rather
    // than showing nothing — flagged by `approximate` on first snapshot.
    if (cachedOffsetMs === null) {
      cachedOffsetMs = 0;
      broadcast();
    }
  }
}

export function useServerTime(): ServerTime | null {
  const [time, setTime] = useState<ServerTime | null>(null);

  useEffect(() => {
    const fn = (t: ServerTime) => setTime(t);
    listeners.add(fn);
    if (cachedOffsetMs !== null) broadcast(); // instant first paint
    if (listeners.size === 1) {
      sync();
      const interval = setInterval(sync, 60_000);
      const tick = setInterval(broadcast, 1_000);
      return () => {
        listeners.delete(fn);
        clearInterval(interval);
        clearInterval(tick);
      };
    }
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return time;
}
