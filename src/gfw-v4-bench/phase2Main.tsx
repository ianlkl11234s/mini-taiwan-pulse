import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GFW_V4_DEFAULT_TRACK_BUCKETS,
  GFW_V4_TRACK_BUCKETS,
  parseGfwV4SpatialRoot,
  parseGfwV4SpatialTracksRelease,
  resolveGfwV4SpatialArtifactUrl,
  type GfwV4SpatialTracksRelease,
  type GfwV4TrackBucket,
} from "../data/gfwV4SpatialTracksLoader";
import { fixedShardViewportTiles, selectGfwV4CurrentNextSpatialFrames, spatialFrameNeedsPmtilesWorker, type GfwV4Viewport } from "../data/gfwV4SpatialViewport";
import { GfwV4TrackScene } from "../three/GfwV4TrackScene";
import { GFW_V4_TRACK_BUDGET } from "../hooks/useGfwV4TracksLayer";

const profiles = {
  desktop: { west: 115.93462, south: 20.36314, east: 134.73486, north: 36.52495, zoom: 4.6 },
  mobile: { west: 120.3, south: 21.8, east: 123.6, north: 26.2, zoom: 6 },
} as const satisfies Record<string, GfwV4Viewport>;
const FIXED_SHARD_ZOOM = 6;
const rootUrl = () => new URLSearchParams(location.search).get("root") ?? "/__gfw-v4-stage/manifest.json";
type Metrics = { profile: string; selectedUtcHour: string; buckets: string[]; frameCount: number; fixedShardZoom: number; shardTiles: number; rangeBytes: number; decodedBytes: number; cold: { requestCount: number; wireBytes: number; status206: number; status200: number }; warm: { requestCount: number; wireBytes: number; status206: number; status200: number }; frameWork: { updates: number; p95Ms: number; maxMs: number }; heap: { status: "measured"; source: "ua-specific" | "chrome-precise"; beforeBytes: number; afterBytes: number; deltaBytes: number } | { status: "unavailable" }; workerMs: number; mainMs: number; visible: number };
const displayHour = (release: GfwV4SpatialTracksRelease, hour: number) => `${release.selectedUtcDate}T${String(hour).padStart(2, "0")}:00:00Z`;
async function heapBytes(): Promise<{ source: "ua-specific" | "chrome-precise"; bytes: number } | null> {
  const ua = (performance as Performance & { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> }).measureUserAgentSpecificMemory;
  if (ua) return { source: "ua-specific", bytes: (await ua.call(performance)).bytes };
  const precise = new URLSearchParams(location.search).get("preciseHeap") === "1";
  const chrome = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
  return precise && typeof chrome === "number" ? { source: "chrome-precise", bytes: chrome } : null;
}

function App() {
  const [release, setRelease] = useState<GfwV4SpatialTracksRelease | null>(null);
  const [enabled, setEnabled] = useState<Set<GfwV4TrackBucket>>(() => new Set(GFW_V4_DEFAULT_TRACK_BUCKETS));
  const [profile, setProfile] = useState<keyof typeof profiles>("desktop");
  // Midday guarantees H-1/H/H+1 are all inside this selected-day sample.
  const [selectedHour, setSelectedHour] = useState(12);
  const [status, setStatus] = useState("loading frozen spatial candidate…");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => { const load = async () => { try { const rootResponse = await fetch(rootUrl(), { cache: "no-store" }); if (!rootResponse.ok) throw new Error(`root HTTP ${rootResponse.status}`); const root = parseGfwV4SpatialRoot(await rootResponse.json()); if (!root) throw new Error("invalid schema-4 stage root pointer"); const releaseResponse = await fetch(new URL(root.releaseManifestPath, rootResponse.url), { cache: "no-store" }); if (!releaseResponse.ok) throw new Error(`release HTTP ${releaseResponse.status}`); const parsed = parseGfwV4SpatialTracksRelease(await releaseResponse.json()); if (!parsed) throw new Error("invalid frozen spatial release"); setRelease(parsed); setStatus(`ready ${parsed.releaseId}; stage-only, canonical selector untouched`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } }; void load(); return () => worker.current?.terminate(); }, []);
  const request = useMemo(() => release ? selectGfwV4CurrentNextSpatialFrames(release, [...enabled], Date.parse(displayHour(release, selectedHour)) / 1_000, profiles[profile], 1) : null, [enabled, profile, release, selectedHour]);
  const assets = useMemo(() => request?.assets.filter((asset) => asset.type === "track_frame_pmtiles") ?? [], [request]);
  const tiles = useMemo(() => request ? fixedShardViewportTiles(request.viewport, FIXED_SHARD_ZOOM) : [], [request]);
  const run = () => {
    if (!release || !request || assets.length === 0 || !spatialFrameNeedsPmtilesWorker({ ...request, assets })) { setStatus("no valid PMTiles H-1/H/H+1 request; gzip frames are deliberately not a benchmark fallback"); return; }
    worker.current?.terminate(); const next = new Worker(new URL("../data/gfwV4SpatialPmtilesWorker.ts", import.meta.url), { type: "module" }); worker.current = next; const started = performance.now();
    const heapBefore = heapBytes();
    next.onmessage = async ({ data }) => { if (!data.ok) { setStatus(data.error); return; }
      if (data.buckets.length === 0) { setStatus("selected-H identity envelope produced zero visible points; refusing a false ready result"); return; }
      const scene = new GfwV4TrackScene(GFW_V4_TRACK_BUDGET);
      const samples: number[] = [];
      for (let index = 0; index < 96; index += 1) { const mark = performance.now(); scene.updateSpatialPoints({ points: data.points, buckets: data.buckets, segments: data.segments, segmentBuckets: data.segmentBuckets }, profiles[profile].zoom); samples.push(performance.now() - mark); }
      scene.dispose(); samples.sort((a, b) => a - b);
      const before = await heapBefore, after = await heapBytes();
      const heap: Metrics["heap"] = before && after && before.source === after.source ? { status: "measured", source: after.source, beforeBytes: before.bytes, afterBytes: after.bytes, deltaBytes: Math.max(0, after.bytes - before.bytes) } : { status: "unavailable" };
      const result: Metrics = { profile, selectedUtcHour: displayHour(release, selectedHour), buckets: [...enabled], frameCount: assets.length, fixedShardZoom: FIXED_SHARD_ZOOM, shardTiles: tiles.length, rangeBytes: data.rangeBytes, decodedBytes: data.decodedBytes, cold: { requestCount: data.cold.requestCount, wireBytes: data.cold.wireBytes, status206: data.cold.status206, status200: data.cold.status200 }, warm: { requestCount: data.warm.requestCount, wireBytes: data.warm.wireBytes, status206: data.warm.status206, status200: data.warm.status200 }, frameWork: { updates: samples.length, p95Ms: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] ?? 0, maxMs: samples[samples.length - 1] ?? 0 }, heap, workerMs: data.workerMs, mainMs: performance.now() - started, visible: data.buckets.length }; setMetrics(result); setStatus(`ready: ${data.buckets.length.toLocaleString()} unique viewport identities; cold/warm Range wire plus typed-GPU frame work measured`); };
    next.postMessage({ assets: assets.map((asset) => ({ url: resolveGfwV4SpatialArtifactUrl(asset, rootUrl()), bucket: GFW_V4_TRACK_BUCKETS.indexOf(asset.bucket), identity: `${asset.bucket}|${asset.observedAt}` })), selectedIdentities: [...enabled].map((bucket) => `${bucket}|${displayHour(release, selectedHour).replace("Z", "+00:00")}`), tiles });
  };
  return <main style={{ fontFamily: "ui-monospace, monospace", maxWidth: 900, margin: "2rem auto", lineHeight: 1.5 }}><h1>GFW v4 Phase-2 spatial bench</h1><p role="status">{status}</p><p>Measured path is only enabled buckets × H-1/H/H+1 PMTiles at fixed z{FIXED_SHARD_ZOOM}; no whole-day GeoJSON fallback.</p><label>Viewport <select value={profile} onChange={(event) => setProfile(event.target.value as keyof typeof profiles)}><option value="desktop">desktop East Asia</option><option value="mobile">mobile Taiwan</option></select></label>{" "}<label>UTC hour <input aria-label="selected UTC hour" type="number" min={1} max={22} value={selectedHour} onChange={(event) => setSelectedHour(Math.max(1, Math.min(22, Number(event.target.value) || 12)))} /></label><fieldset><legend>Buckets</legend>{GFW_V4_TRACK_BUCKETS.map((bucket) => <label key={bucket}><input type="checkbox" checked={enabled.has(bucket)} onChange={() => setEnabled((current) => { const next = new Set(current); next.has(bucket) ? next.delete(bucket) : next.add(bucket); return next; })} />{bucket} </label>)}</fieldset><button type="button" onClick={run} disabled={!release || enabled.size === 0}>Run PMTiles H-1/H/H+1</button><pre aria-label="phase2-metrics">{metrics ? JSON.stringify(metrics, null, 2) : "No PMTiles Range run yet"}</pre></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
