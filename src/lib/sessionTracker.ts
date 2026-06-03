import { supabase, supabaseConfigured } from "./supabase";
import type { LayerVisibility } from "../types";

interface EventEntry {
  type: string;
  ts: number;
  data: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 150_000; // 2.5 分鐘
const BUFFER_LIMIT = 200;
const MAP_VIEW_THROTTLE_MS = 5_000;

let sessionId: string | null = null;
let site = "mini-taiwan-pulse";
let buffer: EventEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let lastMapViewTs = 0;
let ua: string | undefined;
let screen: string | undefined;

function visibleLayers(vis: LayerVisibility): string[] {
  return (Object.keys(vis) as (keyof LayerVisibility)[]).filter((k) => vis[k]);
}

function buildPayload(): {
  body: string;
  count: number;
} | null {
  if (buffer.length === 0 || !sessionId) return null;
  const events = buffer.splice(0);
  const body = JSON.stringify({
    p_session_id: sessionId,
    p_site: site,
    p_events: events,
    p_event_count: events.length,
    p_ua: ua,
    p_screen: screen,
  });
  return { body, count: events.length };
}

function flushViaBeacon(): void {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const payload = buildPayload();
  if (!payload) return;
  // sendBeacon + application/json triggers CORS preflight which sendBeacon can't handle.
  // Use fetch with keepalive instead — survives page close like sendBeacon.
  fetch(`${url}/rest/v1/rpc/log_session_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: payload.body,
    keepalive: true,
  }).catch(() => {});
}

function flushViaRpc(): void {
  if (!supabaseConfigured) return;
  const events = buffer.splice(0);
  if (events.length === 0 || !sessionId) return;
  supabase
    .rpc("log_session_events", {
      p_session_id: sessionId,
      p_site: site,
      p_events: events,
      p_event_count: events.length,
      p_ua: ua,
      p_screen: screen,
    })
    .then(({ error }) => {
      if (error) console.warn("[analytics] flush error:", error.message);
    });
}

function onVisibilityChange(): void {
  if (document.hidden) flushViaBeacon();
}

function onBeforeUnload(): void {
  flushViaBeacon();
}

function pushEvent(entry: EventEntry): void {
  buffer.push(entry);
  if (buffer.length >= BUFFER_LIMIT) flushViaRpc();
}

export const sessionTracker = {
  init(siteId: string = "mini-taiwan-pulse"): void {
    if (sessionId) return; // already initialized
    if (!supabaseConfigured) return;

    sessionId = crypto.randomUUID();
    site = siteId;
    ua = navigator.userAgent;
    screen = `${window.screen.width}x${window.screen.height}`;

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    flushTimer = setInterval(flushViaRpc, FLUSH_INTERVAL_MS);
  },

  log(type: string, data: Record<string, unknown> = {}): void {
    if (!sessionId) return;
    pushEvent({ type, ts: Date.now(), data });
  },

  logWithSnapshot(
    type: string,
    data: Record<string, unknown>,
    visibility: LayerVisibility,
  ): void {
    if (!sessionId) return;
    pushEvent({
      type,
      ts: Date.now(),
      data: { ...data, layers: visibleLayers(visibility) },
    });
  },

  logMapView(zoom: number, lat: number, lng: number, pitch: number): void {
    if (!sessionId) return;
    const now = Date.now();
    if (now - lastMapViewTs < MAP_VIEW_THROTTLE_MS) return;
    lastMapViewTs = now;
    pushEvent({
      type: "map_view",
      ts: now,
      data: { zoom, lat, lng, pitch },
    });
  },

  destroy(): void {
    flushViaBeacon();
    if (flushTimer) clearInterval(flushTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onBeforeUnload);
    sessionId = null;
    buffer = [];
  },
};
