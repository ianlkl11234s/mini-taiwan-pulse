import { useEffect, useRef, useState } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { GFW_V4_TRACK_BUCKETS, loadGfwV4Release, type GfwV4Release } from "../data/gfwV4ReleaseLoader";
import { resolveGfwV4SpatialArtifactUrl, type GfwV4SpatialArtifact, type GfwV4SpatialTracksRelease, type GfwV4TrackBucket } from "../data/gfwV4SpatialTracksLoader";
import { fixedShardViewportTiles, gfwV4ShardSignature, quantizeGfwV4Viewport, selectGfwV4CurrentNextSpatialFrames, type GfwV4SpatialRequest, type GfwV4ShardTile } from "../data/gfwV4SpatialViewport";
import type { GfwV4SpatialHitGroup } from "../data/gfwV4SpatialFrame";
import { decideGfwV4TrackFrame, type GfwV4TrackWorkerReply } from "../data/gfwV4TrackFrameProtocol";
import { gfwV4TrackDataWindowStore, type GfwV4TrackDataWindowState } from "../state/gfwV4TrackDataWindowStore";
import { setGfwHourlyTracksDetailContext } from "../data/gfwHourlyDetailLoader";
import { withLoading } from "../lib/loadingRegistry";
import { showTransientNotice } from "../components/TransientNotice";
import { createGfwV4TrackCustomLayer, GFW_V4_TRACK_CUSTOM_LAYER_ID } from "../map/gfwV4TrackCustomLayer";
import type { GfwV4SpatialPointFrame } from "../three/GfwV4TrackScene";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

export const GFW_V4_TRACK_HIT_SOURCE_ID = "gfw-v4-track-hit-source";
export const GFW_V4_TRACK_HIT_LAYER_ID = "gfw-v4-track-hit";
export const GFW_V4_TRACK_CLICK_LAYERS = [GFW_V4_TRACK_HIT_LAYER_ID] as const;
/** Fixed acceptance budget from the desktop all-bucket v6 benchmark (82,492 heads). */
export const GFW_V4_TRACK_BUDGET = Object.freeze({ maxHeads: 120_000, maxTrailVertices: 240_000 });
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const SHARD_ZOOM = 6;
/** 移動 / 縮放期間不重選 shard；等 moveend 或這個 trailing debounce 後才換一批 tile。 */
const SHARD_RELOAD_DEBOUNCE_MS = 250;
/** 載入失敗後只在固定間隔重試一次，不逐 tick 重打造成 request storm。 */
const LOAD_RETRY_MS = 3_000;
/** bounds 量化到 0.1°，且一律向外取整 —— 量化只能放大視窗，不能吃掉邊緣 shard。 */
const BOUNDS_QUANTUM = 10;
const FORMAL_BUCKETS = ["fishing", "cargo", "passenger", "carrier", "other", "unknown"] as const;
type FormalBucket = typeof FORMAL_BUCKETS[number];
const trackLabel: Record<FormalBucket | "mixed", string> = { fishing: "漁船 Fishing", cargo: "貨船 Cargo", passenger: "客船 Passenger", carrier: "運輸船 Carrier", other: "其他 Other", unknown: "未知 Unknown", mixed: "混合船種 Mixed" };
const asFormalBucket = (index: number): FormalBucket => FORMAL_BUCKETS[index] ?? "unknown";
let warnedEnsureFailure = false;

function spatialRelease(release: GfwV4Release): GfwV4SpatialTracksRelease {
  const artifacts: GfwV4SpatialArtifact[] = release.artifacts.flatMap((asset) => {
    const bucket = typeof asset.semanticCounts.bucket === "string" ? asset.semanticCounts.bucket.toUpperCase() as GfwV4TrackBucket : null;
    if (!bucket || !["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"].includes(bucket) || !["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket"].includes(asset.type)) return [];
    const observedAt = typeof asset.semanticCounts.observed_at === "string" ? asset.semanticCounts.observed_at : undefined;
    return [{ type: asset.type, path: asset.path, bytes: asset.bytes, sha256: asset.sha256, contentLength: asset.contentLength, contentType: asset.contentType, contentEncoding: asset.contentEncoding, bucket, selectedUtcDate: release.selectedUtcDate, observedAt, format: asset.type === "track_detail_bucket" ? "geojson" : "pmtiles" } as GfwV4SpatialArtifact];
  });
  return { releaseId: release.releaseId, selectedUtcDate: release.selectedUtcDate, artifacts };
}

export function gfwV4TrackHitCollection(groups: readonly GfwV4SpatialHitGroup[], displayDate: string, selectedEpoch: number): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: groups.map((group, index) => {
    const first = group.members[0] ?? {};
    const trackIds = [...new Set(group.trackIds)];
    const bucket = group.buckets.length === 1 ? asFormalBucket(group.buckets[0]!) : "mixed";
    const trackBuckets = group.trackIds.map((trackId, itemIndex) => [trackId, asFormalBucket(group.buckets[itemIndex] ?? 5)]);
    return { type: "Feature", id: index, geometry: { type: "Point", coordinates: [group.lon, group.lat] }, properties: {
      source: "gfw-v4", display_date: displayDate, vessel_count: group.members.length, track_id: trackIds[0] ?? null,
      track_ids_json: JSON.stringify(trackIds), track_buckets_json: JSON.stringify(trackBuckets), member_count: group.members.length,
      ship_type_bucket: bucket, ship_type_label: trackLabel[bucket],
      vessel_id: first.vessel_id ?? null, mmsi: first.mmsi ?? null, ship_name: first.ship_name ?? null,
      vessel_type: first.vessel_type ?? null, flag: first.flag ?? null,
      selected_time: new Date(selectedEpoch * 1000).toISOString(), interpolated: selectedEpoch % 3600 === 0 ? 0 : 1,
      full_fidelity: 1, source_dataset: "public-global-presence", attribution_label: "Global Fishing Watch", attribution_href: "https://globalfishingwatch.org/",
    } as Record<string, unknown> };
  }) };
}

/**
 * Formal schema-4 PMTiles tracks: 常駐 z6 Range Worker、H-1/H/H+1 與 sidecar popup context。
 *
 * 三條時間路徑刻意分開：
 * - 同小時同 shard → 只送 `render`（Worker 重算 typed frame，不碰網路、不重建 hit source）
 * - 同小時但 shard 變了 → 移動中先用既有資料畫，`moveend` / 250ms trailing 後才換 shard
 * - 換小時 / 換 bucket / 換窗長 → 遞增 generation 後送 `load`（Worker 增量補新的那一小時）
 *
 * 任何回覆都先過 `decideGfwV4TrackFrame`：generation 過期或 `loaded:false` 一律
 * **保留現有畫面**，只有「已載入且真的 0 點」才清空。
 */
export function useGfwV4TracksLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, enabled: readonly GfwV4TrackBucket[], trailingHours: number, theme: "dark" | "light" | boolean): boolean {
  const [formalReady, setFormalReady] = useState(false);
  const mapTick = useMapReadyTick(mapRef, visible);
  const pointRef = useRef<GfwV4SpatialPointFrame | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const visibleRef = useRef(visible), opacityRef = useRef(opacity), themeRef = useRef(theme);
  visibleRef.current = visible; opacityRef.current = opacity; themeRef.current = theme;
  const bucketKey = enabled.join(",");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    let release: GfwV4Release | null = null;
    let spatial: GfwV4SpatialTracksRelease | null = null;
    let generation = 0;
    let lastHourKey = "";
    let lastShardKey = "";
    let lastHits: GeoJSON.FeatureCollection = EMPTY;
    let cleared = true;
    let shardTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingShardKey = "";
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let notifiedOutOfWindow = false;
    let notifiedError = false;

    const setHits = (data: GeoJSON.FeatureCollection) => (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
    const ensure = () => {
      try {
        if (!map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) map.addSource(GFW_V4_TRACK_HIT_SOURCE_ID, { type: "geojson", data: EMPTY, attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>' });
        if (!map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) map.addLayer(createGfwV4TrackCustomLayer({ budget: GFW_V4_TRACK_BUDGET, getFrame: () => null, getSpatialFrame: () => pointRef.current, getVisible: () => visibleRef.current, getOpacity: () => opacityRef.current, getTheme: () => themeRef.current }));
        if (!map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) map.addLayer({ id: GFW_V4_TRACK_HIT_LAYER_ID, type: "circle", source: GFW_V4_TRACK_HIT_SOURCE_ID, layout: { visibility: visibleRef.current ? "visible" : "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]], 1, 2.4, 4, 6.5], "circle-color": ["match", ["get", "ship_type_bucket"], "fishing", "#58d68d", "cargo", "#39bff4", "passenger", "#b3a0ff", "carrier", "#ff8f43", "other", "#f0cc66", "unknown", "#f5f1db", "#f5f1db"], "circle-opacity": Math.max(0, Math.min(1, opacityRef.current)), "circle-stroke-color": "#041316", "circle-stroke-width": 0.5 } } as CircleLayer);
      } catch (error) {
        // style 尚未就緒時 addSource/addLayer 會丟；style.load 會再叫一次 ensure()。
        if (!warnedEnsureFailure) { warnedEnsureFailure = true; console.warn("[gfw-v4-tracks] deferred layer mount until style.load", error); }
      }
    };

    const setWindow = (status: GfwV4TrackDataWindowState, requestedUtcDate: string | null) => gfwV4TrackDataWindowStore.set({
      status, startUtcDate: release?.selectedUtcDate ?? null, endUtcDate: release?.selectedUtcDate ?? null, requestedUtcDate,
    });

    /** layer-local 淡出：只清自己的 frame / hit source，絕不 clamp、絕不改動全域 timeStore。 */
    const clearFrame = () => {
      if (cleared) return;
      cleared = true;
      generation += 1; // 任何在途回覆立即過期
      lastHourKey = ""; lastShardKey = "";
      pointRef.current = null;
      if (lastHits !== EMPTY) { lastHits = EMPTY; setHits(EMPTY); }
      map.triggerRepaint();
    };

    const onWorkerMessage = ({ data }: MessageEvent<GfwV4TrackWorkerReply>) => {
      if (disposed || !release) return;
      if (!data.ok) {
        if (data.generation !== generation) return;
        if (!notifiedError) { notifiedError = true; showTransientNotice(`GFW v4 航跡載入失敗：${data.error || "unknown"}`); }
        // 畫面保持 stale，隔一段時間才重試一次。
        if (retryTimer === null) retryTimer = setTimeout(() => { retryTimer = null; lastHourKey = ""; lastShardKey = ""; evaluate(timeStore.getTime(), true); }, LOAD_RETRY_MS);
        return;
      }
      const decision = decideGfwV4TrackFrame({ generation: data.generation, loaded: data.loaded, pointCount: data.buckets.length }, generation);
      if (decision === "keep-stale") return;
      notifiedError = false;
      pointRef.current = { points: data.points, buckets: data.buckets, memberCounts: data.memberCounts, segments: data.segments, segmentBuckets: data.segmentBuckets };
      // hit source 只在 frame 內容實質變更（新 generation apply）時重建；
      // 同小時的插值 tick 不重建 ~11k feature，也就不再 setData。
      if (data.hitGroups) { lastHits = gfwV4TrackHitCollection(data.hitGroups, release.selectedUtcDate, data.frameEpoch); setHits(lastHits); }
      else if (decision === "clear" && lastHits !== EMPTY) { lastHits = EMPTY; setHits(EMPTY); }
      map.triggerRepaint();
    };

    const ensureWorker = (): Worker => {
      const existing = workerRef.current;
      if (existing) return existing;
      // Worker 與 layer 同壽命：換小時只送 load，不 terminate、不重抓 header/directory。
      const created = new Worker(new URL("../data/gfwV4SpatialPmtilesWorker.ts", import.meta.url), { type: "module" });
      created.onmessage = onWorkerMessage;
      workerRef.current = created;
      return created;
    };

    /**
     * 真正的 trailing debounce：只有 shard 集合「又變了」才重設計時器。
     * 每個 render tick 無腦重設會讓計時器在持續播放時永遠不到期，新 shard 永不載入。
     */
    const armShardTimer = (shardKey: string) => {
      if (shardTimer !== null && shardKey === pendingShardKey) return;
      if (shardTimer !== null) clearTimeout(shardTimer);
      pendingShardKey = shardKey;
      shardTimer = setTimeout(() => { shardTimer = null; pendingShardKey = ""; evaluate(timeStore.getTime(), true); }, SHARD_RELOAD_DEBOUNCE_MS);
    };

    const startLoad = (request: GfwV4SpatialRequest, tiles: readonly GfwV4ShardTile[], epoch: number, trailHours: number, hourKey: string, shardKey: string) => {
      if (shardTimer !== null) { clearTimeout(shardTimer); shardTimer = null; }
      pendingShardKey = "";
      lastHourKey = hourKey; lastShardKey = shardKey; cleared = false;
      generation += 1;
      ensureWorker().postMessage({
        type: "load", generation,
        assets: request.assets.map((asset) => ({ url: resolveGfwV4SpatialArtifactUrl(asset, release!.rootUrl), bucket: GFW_V4_TRACK_BUCKETS.indexOf(asset.bucket), identity: `${asset.bucket}|${asset.observedAt}` })),
        tiles, epoch, trailingSeconds: trailHours * 3_600,
      });
    };

    const evaluate = (epoch: number, allowShardReload: boolean) => {
      if (disposed || !visibleRef.current || !release || !spatial) return;
      const requestedDate = new Date(epoch * 1000).toISOString().slice(0, 10);
      if (requestedDate !== release.selectedUtcDate) {
        setWindow("out-of-window", requestedDate);
        clearFrame();
        if (!notifiedOutOfWindow) { notifiedOutOfWindow = true; showTransientNotice(`GFW v4 航跡最新完整日：${release.selectedUtcDate}（UTC；目前選取日期尚無正式資料）`); }
        return;
      }
      notifiedOutOfWindow = false;
      const bounds = map.getBounds(); if (!bounds) return;
      const trailHours = [0.5, 1, 2, 3].includes(trailingHours) ? trailingHours : 0.5;
      const viewport = quantizeGfwV4Viewport({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: map.getZoom() }, BOUNDS_QUANTUM);
      const request = selectGfwV4CurrentNextSpatialFrames(spatial, enabled, epoch, viewport, trailHours);
      if (!request) { setWindow("hour-unavailable", requestedDate); clearFrame(); return; }
      setWindow("in-window", requestedDate);
      const tiles = fixedShardViewportTiles(request.viewport, SHARD_ZOOM);
      const hourKey = `${Math.floor(epoch / 3600) * 3600}|${bucketKey}|${trailHours}`;
      // 真正決定要抓什麼的是 z6 shard tile 集合，不是 bounds 的小數位；
      // 只要 pan/zoom 沒跨出這批 tile，播放中就完全不會重選 shard。
      const shardKey = gfwV4ShardSignature(tiles);
      if (hourKey === lastHourKey && (shardKey === lastShardKey || !allowShardReload)) {
        if (shardKey !== lastShardKey) armShardTimer(shardKey);
        ensureWorker().postMessage({ type: "render", generation, epoch, trailingSeconds: trailHours * 3_600, includeHits: false });
        return;
      }
      startLoad(request, tiles, epoch, trailHours, hourKey, shardKey);
    };

    const render = (epoch: number) => evaluate(epoch, false);

    const start = async () => { try {
      const loaded = await withLoading("gfw-v4-tracks:manifest", "GFW v4 航跡正式 release", loadGfwV4Release());
      if (!loaded) throw new Error("formal schema-4 release unavailable");
      release = loaded;
      // release 一次 effect 只賦值一次 → 542 個 artifact 的 flatMap 只做一次，之後全部複用。
      spatial = spatialRelease(loaded);
      if (disposed) return; setFormalReady(true); ensure();
      const detailPrefix = `releases/${loaded.releaseId}/tracks/`;
      const details = loaded.artifacts.filter((asset) => asset.type === "track_detail_bucket").flatMap((asset) => {
        if (!asset.path.startsWith(detailPrefix)) return [];
        const suffix = asset.path.slice(detailPrefix.length).split("/");
        const [vesselBucket, tracks, detailsDir, displayDate, file] = suffix;
        return FORMAL_BUCKETS.includes(vesselBucket as FormalBucket) && tracks === "tracks" && detailsDir === "details" && displayDate === loaded.selectedUtcDate && /^[0-9a-f]\.json\.gz$/.test(file ?? "")
          ? [{ bucket: `${vesselBucket}:${file![0]}`, path: asset.path, sha256: asset.sha256, bytes: asset.bytes, features: Number(asset.semanticCounts.features ?? 0) }]
          : [];
      });
      if (details.length !== 96 || new Set(details.map((detail) => detail.bucket)).size !== 96) throw new Error("formal track detail namespace contract invalid");
      setGfwHourlyTracksDetailContext({ manifestUrl: loaded.rootUrl, releaseId: loaded.releaseId, latestCompleteDate: loaded.selectedUtcDate, dateStart: loaded.selectedUtcDate, dateEnd: loaded.selectedUtcDate, generatedAt: null, fullFidelity: true, days: new Map([[loaded.selectedUtcDate, { displayDate: loaded.selectedUtcDate, path: "", sha256: "", bytes: 0, features: 0, points: 0, format: "pmtiles", detailBuckets: details }]]), attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" } }, "formal-v4");
      render(timeStore.getTime());
    } catch { if (!disposed) setFormalReady(false); } };
    if (visible) void start();
    // style reload 只需要「重掛圖層 + 補回上一次的 hit source」，
    // 資料更新一律走 subscribeThrottled(100)；不再訂閱高頻的 styledata。
    const onStyleLoad = () => { ensure(); if (lastHits !== EMPTY) setHits(lastHits); render(timeStore.getTime()); };
    const onMoveEnd = () => { if (shardTimer !== null) { clearTimeout(shardTimer); shardTimer = null; pendingShardKey = ""; } evaluate(timeStore.getTime(), true); };
    map.on("style.load", onStyleLoad);
    map.on("moveend", onMoveEnd);
    const unsubscribe = timeStore.subscribeThrottled(100, render);
    return () => {
      disposed = true; unsubscribe();
      if (shardTimer !== null) clearTimeout(shardTimer);
      if (retryTimer !== null) clearTimeout(retryTimer);
      workerRef.current?.terminate(); workerRef.current = null;
      setGfwHourlyTracksDetailContext(null, "formal-v4"); gfwV4TrackDataWindowStore.clear(); pointRef.current = null;
      if (map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_HIT_LAYER_ID);
      if (map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID);
      if (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) map.removeSource(GFW_V4_TRACK_HIT_SOURCE_ID);
      map.off("style.load", onStyleLoad); map.off("moveend", onMoveEnd);
    };
  }, [bucketKey, mapRef, mapTick, trailingHours, visible]);
  useEffect(() => { const map = mapRef.current; if (map?.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) { map.setLayoutProperty(GFW_V4_TRACK_HIT_LAYER_ID, "visibility", visible ? "visible" : "none"); map.setPaintProperty(GFW_V4_TRACK_HIT_LAYER_ID, "circle-opacity", Math.max(0, Math.min(1, opacity))); } map?.triggerRepaint(); }, [mapRef, mapTick, opacity, theme, visible]);
  return formalReady;
}
