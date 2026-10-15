/**
 * useJmaRiskFloodLayer — 洪水キキクル（向量 pbf），瀏覽器直連 JMA。
 *
 * - 時刻：targetTimes.json（上游約保留 6 小時、10 分一幀）；每 2 分鐘重取（上游 max-age 60s）。
 *   即時＝最晚的 ≤ now；回放落在保留範圍內照樣選幀，更早 → 隱藏＋圖例「只提供即時」。
 * - 偶數 zoom：上游只產 z4/6/…/14 的磚（JMA viewer zoomUse="even"）。每個偶數層一個 source（minzoom=maxzoom=z），
 *   對應 layer 只在 [z, z+2) 顯示 → 奇數 zoom 用前一個偶數層 overzoom，永遠不請求奇數 zoom 的磚。
 *   mapbox 只為「此 zoom 有可見 layer」的 source 抓磚，所以同時只有一層在請求。
 * - 空磚（200＋0 bytes）＝目前無警戒，不是錯誤。
 * - 時間不進 deps：timeStore.subscribeThrottled(1000)（development-rules §8）。
 */

import { useEffect, useRef } from "react";
import type { LineLayerSpecification, Map as MapboxMap, VectorTileSource } from "mapbox-gl";
import {
  JMA_FLOOD_ATTRIBUTION, JMA_FLOOD_SOURCE_ZOOMS,
  jmaFloodLineColorExpr, jmaFloodLineWidthExpr, jmaFloodTileUrl,
} from "../data/jmaTypes";
import { FLOOD_STATUS_KEY, fetchFloodTargetTimes, pickFloodFrame, type JmaRiskFrame } from "../data/jmaUpstreamLoaders";
import { setJmaImageryStatus } from "../data/jmaImageryLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { isHistoryMode } from "./useTimeStoreTime";
import { useMapReadyTick } from "./useMapReadyTick";

const REFRESH_MS = 2 * 60_000;

export const jmaFloodSourceId = (z: number) => `jma-risk-flood-z${z}-src`;
export const jmaFloodLayerId = (z: number) => `jma-risk-flood-z${z}-layer`;
export const JMA_FLOOD_LAYER_IDS = JMA_FLOOD_SOURCE_ZOOMS.map(jmaFloodLayerId);

function layerSpec(z: number, opacity: number): LineLayerSpecification {
  const last = z === JMA_FLOOD_SOURCE_ZOOMS[JMA_FLOOD_SOURCE_ZOOMS.length - 1];
  return {
    id: jmaFloodLayerId(z), type: "line", source: jmaFloodSourceId(z), "source-layer": "flood",
    minzoom: z, maxzoom: last ? 24 : z + 2,
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: {
      "line-color": jmaFloodLineColorExpr() as never,
      "line-width": jmaFloodLineWidthExpr() as never,
      "line-opacity": opacity,
    },
  };
}

interface Options {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  opacity: number;
}

export function useJmaRiskFloodLayer({ mapRef, visible, opacity }: Options) {
  const mapTick = useMapReadyTick(mapRef);
  const framesRef = useRef<JmaRiskFrame[] | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  /** 最後一次建圖層用的 map（unmount 清理用；不把 mapRef 放進清理 effect 的 deps） */
  const mapInstRef = useRef<MapboxMap | null>(null);
  const runRef = useRef<((t: number) => void) | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // ── targetTimes ──
  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    const load = async () => {
      try {
        const frames = await fetchFloodTargetTimes();
        if (disposed) return;
        framesRef.current = frames;
        runRef.current?.(timeStore.getTime());
      } catch (err) {
        if (disposed) return;
        console.warn("[JMA flood] targetTimes failed", err);
        setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "error", validTimeIso: null, message: err instanceof Error ? err.message : String(err) });
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [visible]);

  // ── layer 生命週期＋選幀 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    mapInstRef.current = map;

    const setVis = (on: boolean) => {
      for (const id of JMA_FLOOD_LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    const run = (tSec: number) => {
      if (!visible) {
        setVis(false);
        setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "idle", validTimeIso: null });
        return;
      }
      const frames = framesRef.current;
      if (frames == null) { setVis(false); setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "loading", validTimeIso: null }); return; }
      const live = !isHistoryMode(tSec);
      const pick = pickFloodFrame(frames, live ? Date.now() : tSec * 1000, live);
      if (pick.kind === "uncovered") {
        setVis(false);
        setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "uncovered", validTimeIso: null, reason: pick.reason });
        return;
      }
      const f = pick.frame;
      const url = jmaFloodTileUrl(f.basetime, f.member, f.validtime);
      const changed = currentUrlRef.current !== url;
      for (const z of JMA_FLOOD_SOURCE_ZOOMS) {
        const sid = jmaFloodSourceId(z);
        const src = map.getSource(sid) as VectorTileSource | undefined;
        if (!src) {
          map.addSource(sid, { type: "vector", tiles: [url], minzoom: z, maxzoom: z, attribution: JMA_FLOOD_ATTRIBUTION });
        } else if (changed) {
          src.setTiles([url]);
        }
        if (!map.getLayer(jmaFloodLayerId(z))) map.addLayer(layerSpec(z, opacityRef.current));
      }
      if (changed) {
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, "jma-risk-flood:render", "洪水キキクル 載入中", null, 5000);
      }
      setVis(true);
      setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "shown", validTimeIso: new Date(f.validMs).toISOString() });
    };
    runRef.current = run;

    let disposed = false;
    let retryPending = false;
    const retry = () => { retryPending = false; if (!disposed) safeRun(timeStore.getTime()); };
    const safeRun = (t: number) => {
      try { run(t); } catch {
        if (!disposed && !retryPending) { retryPending = true; map.once("idle", retry); }
      }
    };
    const onStyleLoad = () => { currentUrlRef.current = null; safeRun(timeStore.getTime()); };

    safeRun(timeStore.getTime());
    const unsubTime = visible ? timeStore.subscribeThrottled(1000, safeRun) : null;
    map.on("style.load", onStyleLoad);
    return () => {
      disposed = true;
      unsubTime?.();
      map.off("style.load", onStyleLoad);
      if (retryPending) map.off("idle", retry);
      if (runRef.current === run) runRef.current = null;
    };
  }, [mapRef, visible, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !map) return;
    try {
      for (const id of JMA_FLOOD_LAYER_IDS) if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", opacity);
    } catch { /* style 轉換中 */ }
  }, [mapRef, opacity, visible, mapTick]);

  useEffect(() => () => {
    const map = mapInstRef.current;
    try {
      for (const z of JMA_FLOOD_SOURCE_ZOOMS) {
        if (map?.getLayer(jmaFloodLayerId(z))) map.removeLayer(jmaFloodLayerId(z));
        if (map?.getSource(jmaFloodSourceId(z))) map.removeSource(jmaFloodSourceId(z));
      }
    } catch { /* map 可能已銷毀 */ }
    currentUrlRef.current = null;
    setJmaImageryStatus(FLOOD_STATUS_KEY, { state: "idle", validTimeIso: null });
  }, []);
}
