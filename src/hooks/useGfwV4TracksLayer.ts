import { useEffect, useRef, useState } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { loadGfwV4Release, type GfwV4Release } from "../data/gfwV4ReleaseLoader";
import { resolveGfwV4SpatialArtifactUrl, type GfwV4SpatialArtifact, type GfwV4SpatialTracksRelease, type GfwV4TrackBucket } from "../data/gfwV4SpatialTracksLoader";
import { fixedShardViewportTiles, selectGfwV4CurrentNextSpatialFrames } from "../data/gfwV4SpatialViewport";
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
type HitGroup = { lon: number; lat: number; members: Record<string, unknown>[]; trackIds: string[]; buckets: number[] };
type WorkerResult = { ok: boolean; error?: string; frameEpoch: number; points: Float32Array; buckets: Uint8Array; memberCounts: Uint16Array; segments: Float32Array; segmentBuckets: Uint8Array; hitGroups: HitGroup[] };
const FORMAL_BUCKETS = ["fishing", "cargo", "passenger", "carrier", "other", "unknown"] as const;
type FormalBucket = typeof FORMAL_BUCKETS[number];
const trackLabel: Record<FormalBucket | "mixed", string> = { fishing: "漁船 Fishing", cargo: "貨船 Cargo", passenger: "客船 Passenger", carrier: "運輸船 Carrier", other: "其他 Other", unknown: "未知 Unknown", mixed: "混合船種 Mixed" };
const asFormalBucket = (index: number): FormalBucket => FORMAL_BUCKETS[index] ?? "unknown";

function spatialRelease(release: GfwV4Release): GfwV4SpatialTracksRelease {
  const artifacts: GfwV4SpatialArtifact[] = release.artifacts.flatMap((asset) => {
    const bucket = typeof asset.semanticCounts.bucket === "string" ? asset.semanticCounts.bucket.toUpperCase() as GfwV4TrackBucket : null;
    if (!bucket || !["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"].includes(bucket) || !["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket"].includes(asset.type)) return [];
    const observedAt = typeof asset.semanticCounts.observed_at === "string" ? asset.semanticCounts.observed_at : undefined;
    return [{ type: asset.type, path: asset.path, bytes: asset.bytes, sha256: asset.sha256, contentLength: asset.contentLength, contentType: asset.contentType, contentEncoding: asset.contentEncoding, bucket, selectedUtcDate: release.selectedUtcDate, observedAt, format: asset.type === "track_detail_bucket" ? "geojson" : "pmtiles" } as GfwV4SpatialArtifact];
  });
  return { releaseId: release.releaseId, selectedUtcDate: release.selectedUtcDate, artifacts };
}

export function gfwV4TrackHitCollection(groups: readonly HitGroup[], displayDate: string, selectedEpoch: number): GeoJSON.FeatureCollection {
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

/** Formal schema-4 PMTiles tracks: fixed z6 Range Worker, H-1/H/H+1 and sidecar popup context. */
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
    let lastKey = "";
    const setHits = (data: GeoJSON.FeatureCollection) => (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
    const ensure = () => {
      if (!map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) map.addSource(GFW_V4_TRACK_HIT_SOURCE_ID, { type: "geojson", data: EMPTY, attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>' });
      if (!map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) map.addLayer(createGfwV4TrackCustomLayer({ budget: GFW_V4_TRACK_BUDGET, getFrame: () => null, getSpatialFrame: () => pointRef.current, getVisible: () => visibleRef.current, getOpacity: () => opacityRef.current, getTheme: () => themeRef.current }));
      if (!map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) map.addLayer({ id: GFW_V4_TRACK_HIT_LAYER_ID, type: "circle", source: GFW_V4_TRACK_HIT_SOURCE_ID, layout: { visibility: visibleRef.current ? "visible" : "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]], 1, 2.4, 4, 6.5], "circle-color": ["match", ["get", "ship_type_bucket"], "fishing", "#58d68d", "cargo", "#39bff4", "passenger", "#b3a0ff", "carrier", "#ff8f43", "other", "#f0cc66", "unknown", "#f5f1db", "#f5f1db"], "circle-opacity": Math.max(0, Math.min(1, opacityRef.current)), "circle-stroke-color": "#041316", "circle-stroke-width": 0.5 } } as CircleLayer);
    };
    const render = (epoch: number) => {
      if (disposed || !visibleRef.current || !release) return;
      const requestedDate = new Date(epoch * 1000).toISOString().slice(0, 10);
      if (requestedDate !== release.selectedUtcDate) { workerRef.current?.terminate(); workerRef.current = null; lastKey = ""; pointRef.current = null; setHits(EMPTY); map.triggerRepaint(); showTransientNotice(`GFW v4 航跡最新完整日：${release.selectedUtcDate}（UTC；目前選取日期尚無正式資料）`); return; }
      const bounds = map.getBounds(); if (!bounds) return;
      const trailHours = [0.5, 1, 2, 3].includes(trailingHours) ? trailingHours : 0.5;
      const request = selectGfwV4CurrentNextSpatialFrames(spatialRelease(release), enabled, epoch, { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth(), zoom: map.getZoom() }, trailHours);
      if (!request) { workerRef.current?.terminate(); workerRef.current = null; lastKey = ""; pointRef.current = null; setHits(EMPTY); return; }
      const selectedEpoch = Math.floor(epoch / 3600) * 3600;
      const key = `${selectedEpoch}|${bucketKey}|${trailHours}|${bounds.toArray().flat().map((v) => v.toFixed(3)).join("|")}`;
      // Within a selected hour, time only asks the existing Worker to rebuild the
      // local typed frame. It never terminates it or repeats PMTiles Range reads.
      if (key === lastKey && workerRef.current) { workerRef.current.postMessage({ type: "render", epoch, trailingSeconds: trailHours * 3_600 }); return; }
      lastKey = key;
      workerRef.current?.terminate();
      const worker = new Worker(new URL("../data/gfwV4SpatialPmtilesWorker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => { if (disposed || worker !== workerRef.current) return; if (!data.ok) { showTransientNotice(`GFW v4 航跡載入失敗：${data.error ?? "unknown"}`); return; } pointRef.current = { points: data.points, buckets: data.buckets, memberCounts: data.memberCounts, segments: data.segments, segmentBuckets: data.segmentBuckets }; setHits(gfwV4TrackHitCollection(data.hitGroups, release!.selectedUtcDate, data.frameEpoch)); map.triggerRepaint(); };
      worker.postMessage({ type: "load", assets: request.assets.map((asset) => ({ url: resolveGfwV4SpatialArtifactUrl(asset, release!.rootUrl), bucket: ["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"].indexOf(asset.bucket), identity: `${asset.bucket}|${asset.observedAt}` })), tiles: fixedShardViewportTiles(request.viewport, SHARD_ZOOM), epoch, trailingSeconds: trailHours * 3_600 });
    };
    const start = async () => { try {
      const loaded = await withLoading("gfw-v4-tracks:manifest", "GFW v4 航跡正式 release", loadGfwV4Release());
      if (!loaded) throw new Error("formal schema-4 release unavailable");
      release = loaded;
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
    const style = () => { ensure(); render(timeStore.getTime()); };
    map.on("styledata", style);
    const unsubscribe = timeStore.subscribeThrottled(100, render);
    return () => { disposed = true; unsubscribe(); workerRef.current?.terminate(); workerRef.current = null; setGfwHourlyTracksDetailContext(null, "formal-v4"); pointRef.current = null; if (map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_HIT_LAYER_ID); if (map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID); if (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) map.removeSource(GFW_V4_TRACK_HIT_SOURCE_ID); map.off("styledata", style); };
  }, [bucketKey, mapRef, mapTick, trailingHours, visible]);
  useEffect(() => { const map = mapRef.current; if (map?.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) { map.setLayoutProperty(GFW_V4_TRACK_HIT_LAYER_ID, "visibility", visible ? "visible" : "none"); map.setPaintProperty(GFW_V4_TRACK_HIT_LAYER_ID, "circle-opacity", Math.max(0, Math.min(1, opacity))); } map?.triggerRepaint(); }, [mapRef, mapTick, opacity, theme, visible]);
  return formalReady;
}
