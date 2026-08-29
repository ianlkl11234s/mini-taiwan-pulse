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
import {
  decideGfwV4TrackFrame,
  type GfwV4TrackTileCacheTelemetry,
  type GfwV4TrackWorkerReply,
  type GfwV4TrackWorkerRequest,
} from "../data/gfwV4TrackFrameProtocol";
import { GfwV4TrackScene } from "../three/GfwV4TrackScene";
import { GFW_V4_TRACK_BUDGET } from "../hooks/useGfwV4TracksLayer";

const profiles = {
  desktop: { west: 115.93462, south: 20.36314, east: 134.73486, north: 36.52495, zoom: 4.6 },
  mobile: { west: 120.3, south: 21.8, east: 123.6, north: 26.2, zoom: 6 },
} as const satisfies Record<string, GfwV4Viewport>;
const FIXED_SHARD_ZOOM = 6;
/** Tier 2 一直是 1 小時尾跡；保持與舊 evidence 相同的請求形狀。 */
const TRAILING_HOURS = 1;
const GPU_UPDATES = 96;
/** 同小時插值往返取樣數 —— 這是新架構真正的播放熱路徑。 */
const RENDER_TICKS = 12;
const REPLY_TIMEOUT_MS = 60_000;
const rootUrl = () => new URLSearchParams(location.search).get("root") ?? "/__gfw-v4-stage/manifest.json";
type Samples = { updates: number; p95Ms: number; maxMs: number };
type Metrics = {
  profile: string; selectedUtcHour: string; buckets: string[]; frameCount: number; fixedShardZoom: number; shardTiles: number;
  /** 同一個常駐 Worker 上的第幾次 run；run 2 起 tile 快取應全命中。 */
  runIndex: number; generation: number; loaded: boolean;
  rangeBytes: number; decodedBytes: number;
  /** 舊欄位 `cold` 更名；第二 pass 已刪除，`warm` 不再存在。 */
  wire: { requestCount: number; wireBytes: number; status206: number; status200: number };
  /** `warm.wireBytes === 0` 的等價驗證點：duplicateFetches / evictions 必須是 0。 */
  tileCache: GfwV4TrackTileCacheTelemetry;
  frameWork: Samples; renderTick: Samples;
  heap: { status: "measured"; source: "ua-specific" | "chrome-precise"; beforeBytes: number; afterBytes: number; deltaBytes: number } | { status: "unavailable" };
  workerMs: number; mainMs: number;
  /** 同座標會被 buildGfwV4SpatialFrame 聚合 → 這是 head **group** 數，不是唯一 identity 數。 */
  visible: number;
  segments: number;
};
const displayHour = (release: GfwV4SpatialTracksRelease, hour: number) => `${release.selectedUtcDate}T${String(hour).padStart(2, "0")}:00:00Z`;
const summarize = (samples: number[]): Samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { updates: sorted.length, p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0, maxMs: sorted[sorted.length - 1] ?? 0 };
};
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
  const [busy, setBusy] = useState(false);
  // 與 production 一樣是常駐 Worker：跨 run 保留 PMTiles archive 與 tile 快取，
  // 所以 run 2 起的 tile 快取命中率就是舊 warm pass 想證明的那件事。
  const worker = useRef<Worker | null>(null);
  const pending = useRef<((reply: GfwV4TrackWorkerReply) => void) | null>(null);
  const generationRef = useRef(0);
  const runIndexRef = useRef(0);
  useEffect(() => { const load = async () => { try { const rootResponse = await fetch(rootUrl(), { cache: "no-store" }); if (!rootResponse.ok) throw new Error(`root HTTP ${rootResponse.status}`); const root = parseGfwV4SpatialRoot(await rootResponse.json()); if (!root) throw new Error("invalid schema-4 stage root pointer"); const releaseResponse = await fetch(new URL(root.releaseManifestPath, rootResponse.url), { cache: "no-store" }); if (!releaseResponse.ok) throw new Error(`release HTTP ${releaseResponse.status}`); const parsed = parseGfwV4SpatialTracksRelease(await releaseResponse.json()); if (!parsed) throw new Error("invalid frozen spatial release"); setRelease(parsed); setStatus(`ready ${parsed.releaseId}; stage-only, canonical selector untouched`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } }; void load(); return () => { worker.current?.terminate(); worker.current = null; }; }, []);
  const request = useMemo(() => release ? selectGfwV4CurrentNextSpatialFrames(release, [...enabled], Date.parse(displayHour(release, selectedHour)) / 1_000, profiles[profile], TRAILING_HOURS) : null, [enabled, profile, release, selectedHour]);
  const assets = useMemo(() => request?.assets.filter((asset) => asset.type === "track_frame_pmtiles") ?? [], [request]);
  const tiles = useMemo(() => request ? fixedShardViewportTiles(request.viewport, FIXED_SHARD_ZOOM) : [], [request]);

  const ensureWorker = (): Worker => {
    const existing = worker.current;
    if (existing) return existing;
    const created = new Worker(new URL("../data/gfwV4SpatialPmtilesWorker.ts", import.meta.url), { type: "module" });
    created.onmessage = ({ data }: MessageEvent<GfwV4TrackWorkerReply>) => { const resolve = pending.current; pending.current = null; resolve?.(data); };
    worker.current = created;
    return created;
  };
  /** 嚴格照 SSOT 協定發問；bench 一次只有一個在途請求，所以 generation 就足以對號。 */
  const ask = (target: Worker, message: GfwV4TrackWorkerRequest) => new Promise<GfwV4TrackWorkerReply>((resolve, reject) => {
    const timer = setTimeout(() => { pending.current = null; reject(new Error(`worker reply timeout after ${REPLY_TIMEOUT_MS}ms`)); }, REPLY_TIMEOUT_MS);
    pending.current = (reply) => { clearTimeout(timer); resolve(reply); };
    target.postMessage(message);
  });

  const run = async () => {
    if (busy) return;
    if (!release || !request || assets.length === 0 || !spatialFrameNeedsPmtilesWorker({ ...request, assets })) { setStatus("no valid PMTiles H-1/H/H+1 request; gzip frames are deliberately not a benchmark fallback"); return; }
    setBusy(true);
    try {
      const target = ensureWorker();
      const generation = (generationRef.current += 1);
      const runIndex = (runIndexRef.current += 1);
      const epoch = Date.parse(displayHour(release, selectedHour)) / 1_000;
      const trailingSeconds = TRAILING_HOURS * 3_600;
      const started = performance.now();
      const heapBefore = heapBytes();
      const loaded = await ask(target, { type: "load", generation, epoch, trailingSeconds, tiles, assets: assets.map((asset) => ({ url: resolveGfwV4SpatialArtifactUrl(asset, rootUrl()), bucket: GFW_V4_TRACK_BUCKETS.indexOf(asset.bucket), identity: `${asset.bucket}|${asset.observedAt}` })) });
      if (!loaded.ok) { setStatus(`worker error: ${loaded.error}`); return; }
      const decision = decideGfwV4TrackFrame({ generation: loaded.generation, loaded: loaded.loaded, pointCount: loaded.buckets.length }, generation);
      if (decision !== "apply") { setStatus(`refusing a false ready result: decision=${decision}, loaded=${loaded.loaded}, generation=${loaded.generation}/${generation}, points=${loaded.buckets.length}`); return; }
      // Typed-GPU frame work, exactly the buffers production uploads (memberCounts included).
      const scene = new GfwV4TrackScene(GFW_V4_TRACK_BUDGET);
      const frameSamples: number[] = [];
      for (let index = 0; index < GPU_UPDATES; index += 1) {
        const mark = performance.now();
        scene.updateSpatialPoints({ points: loaded.points, buckets: loaded.buckets, memberCounts: loaded.memberCounts, segments: loaded.segments, segmentBuckets: loaded.segmentBuckets }, profiles[profile].zoom);
        frameSamples.push(performance.now() - mark);
      }
      scene.dispose();
      // 同小時插值：不重抓、不重建 hit source，只量 Worker 重算 typed frame 的往返。
      const renderSamples: number[] = [];
      for (let index = 1; index <= RENDER_TICKS; index += 1) {
        const mark = performance.now();
        const tick = await ask(target, { type: "render", generation, epoch: epoch + Math.round(index * 3_600 / (RENDER_TICKS + 1)), trailingSeconds, includeHits: false });
        if (!tick.ok || !tick.loaded) { setStatus(`in-hour render tick ${index} was not served by the committed generation; readiness protocol violated`); return; }
        renderSamples.push(performance.now() - mark);
      }
      const before = await heapBefore, after = await heapBytes();
      const heap: Metrics["heap"] = before && after && before.source === after.source
        ? { status: "measured", source: after.source, beforeBytes: before.bytes, afterBytes: after.bytes, deltaBytes: Math.max(0, after.bytes - before.bytes) }
        : { status: "unavailable" };
      const wire = loaded.wire ?? { requestCount: 0, wireBytes: 0, decodedBytes: 0, status206: 0, status200: 0 };
      const tileCache = loaded.tiles ?? { lookups: 0, cacheHits: 0, networkFetches: 0, duplicateFetches: 0, evictions: 0, trackingSaturated: false };
      setMetrics({
        profile, selectedUtcHour: displayHour(release, selectedHour), buckets: [...enabled], frameCount: assets.length,
        fixedShardZoom: FIXED_SHARD_ZOOM, shardTiles: tiles.length, runIndex, generation, loaded: loaded.loaded,
        rangeBytes: wire.wireBytes, decodedBytes: wire.decodedBytes,
        wire: { requestCount: wire.requestCount, wireBytes: wire.wireBytes, status206: wire.status206, status200: wire.status200 },
        tileCache, frameWork: summarize(frameSamples), renderTick: summarize(renderSamples), heap,
        workerMs: loaded.workerMs ?? 0, mainMs: performance.now() - started,
        visible: loaded.buckets.length, segments: loaded.segmentBuckets.length,
      });
      setStatus(`ready: ${loaded.buckets.length.toLocaleString()} viewport head groups (same-coordinate identities aggregated) on run ${runIndex}; Range wire, tile-cache reuse and typed-GPU frame work measured (duplicate tile fetches ${tileCache.duplicateFetches})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };

  return <main style={{ fontFamily: "ui-monospace, monospace", maxWidth: 900, margin: "2rem auto", lineHeight: 1.5 }}><h1>GFW v4 Phase-2 spatial bench</h1><p role="status">{status}</p><p>Measured path is only enabled buckets × H-1/H/H+1 PMTiles at fixed z{FIXED_SHARD_ZOOM}; no whole-day GeoJSON fallback, and no benchmark-only second decode pass. Re-run the same profile on this page to measure warm tile-cache reuse: run 2 must report <code>wire.requestCount 0</code> and <code>tileCache.duplicateFetches 0</code>.</p><label>Viewport <select value={profile} onChange={(event) => setProfile(event.target.value as keyof typeof profiles)}><option value="desktop">desktop East Asia</option><option value="mobile">mobile Taiwan</option></select></label>{" "}<label>UTC hour <input aria-label="selected UTC hour" type="number" min={1} max={22} value={selectedHour} onChange={(event) => setSelectedHour(Math.max(1, Math.min(22, Number(event.target.value) || 12)))} /></label><fieldset><legend>Buckets</legend>{GFW_V4_TRACK_BUCKETS.map((bucket) => <label key={bucket}><input type="checkbox" checked={enabled.has(bucket)} onChange={() => setEnabled((current) => { const next = new Set(current); next.has(bucket) ? next.delete(bucket) : next.add(bucket); return next; })} />{bucket} </label>)}</fieldset><button type="button" onClick={() => void run()} disabled={!release || enabled.size === 0 || busy}>{busy ? "Running…" : "Run PMTiles H-1/H/H+1"}</button><pre aria-label="phase2-metrics">{metrics ? JSON.stringify(metrics, null, 2) : "No PMTiles Range run yet"}</pre></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
