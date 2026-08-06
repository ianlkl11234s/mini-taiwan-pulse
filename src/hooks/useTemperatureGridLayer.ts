import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, MapSourceDataEvent } from "mapbox-gl";
import type { TemperatureGridData } from "../data/temperatureLoader";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  TEMPERATURE_GRID_SOURCE_ID,
  TEMPERATURE_GRID_FILL_LAYER_ID,
  ensureTemperatureGridLayer,
  setTemperatureGridData,
  setTemperatureGridFrameTime,
  setTemperatureGridOpacity,
  setTemperatureGridVisible,
  temperatureGridToGeoJSON,
} from "../map/temperatureGridLayerFactory";

/**
 * 溫度網格 2D（temperatureGrid）動態圖層。
 *
 * 資料與 3D 溫度波共用 `useTemperatureData`（不另打 RPC）。
 *
 * 開發規則 §8：currentTime 一律不進 React deps —— 這裡訂閱 timeStore 節流回呼，
 * 二分搜尋出相鄰兩 frame + lerpFactor，插值後**只寫 feature-state**（幾何不動）。
 * 節流三道：
 *   1. `subscribeThrottled(100)` — 更新間隔 ≥ 100ms
 *   2. lerpFactor 量化到 0.1 bucket，同 bucket 直接 return（回放時多數 tick 被擋下）
 *   3. 每 cell 與上次已套用值比對，只寫差異
 * 圖層關閉 / 資料未載入 → effect 直接 return，完全不做事。
 */

/** lerpFactor 量化級距（0.1） */
const LERP_BUCKETS = 10;
const MIN_FLUSH_INTERVAL_MS = 100;
/** Int16Array 的「從未套用」哨兵 */
const NEVER_APPLIED = -32768;

/** 二分搜尋：找 t 左側最近的 frame index（同 TemperatureWaveScene.findFrameIndex） */
function findFrameIndex(frames: TemperatureGridData["frames"], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.time <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function useTemperatureGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  data: TemperatureGridData | null,
  visible: boolean,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  /** 已寫進 source 的那份資料（幾何只在資料換掉時重建） */
  const geometryOfRef = useRef<TemperatureGridData | null>(null);
  /** 每個 land cell 上次已套用的溫度（×10 整數），用來只寫差異 */
  const appliedRef = useRef<Int16Array | null>(null);
  const lastBucketKeyRef = useRef("");
  const lastFlushMsRef = useRef(0);
  const firstFlushDoneRef = useRef(false);
  /** mapRef 還沒填時的重試 tick（production 首載 map "load" 可能晚於資料就緒） */
  const [mapRetry, setMapRetry] = useState(0);

  // ── 幾何 + 可見性 + 時間訂閱 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      if (!visible) return;
      const timer = setInterval(() => {
        if (mapRef.current) setMapRetry((v) => v + 1);
      }, 200);
      return () => clearInterval(timer);
    }

    if (!visible) {
      if (map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) setTemperatureGridVisible(map, false);
      return;
    }
    if (!data || data.frames.length === 0) return;

    let cancelled = false;

    const resetAppliedState = () => {
      appliedRef.current = null;
      lastBucketKeyRef.current = "";
      lastFlushMsRef.current = 0;
      firstFlushDoneRef.current = false;
    };

    /** 把 t 對應的插值溫度寫進 feature-state（只寫差異） */
    const flush = (t: number, force: boolean) => {
      if (cancelled) return;
      if (!map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) return;
      // 首刷前 source 須 loaded，否則 setFeatureState 會落空
      if (!firstFlushDoneRef.current && !map.isSourceLoaded(TEMPERATURE_GRID_SOURCE_ID)) return;

      const { frames, landIndices } = data;
      const last = frames.length - 1;
      let idxA: number;
      let idxB: number;
      let lerp: number;
      if (t <= frames[0]!.time) {
        idxA = 0;
        idxB = 0;
        lerp = 0;
      } else if (t >= frames[last]!.time) {
        idxA = last;
        idxB = last;
        lerp = 0;
      } else {
        idxA = findFrameIndex(frames, t);
        idxB = Math.min(idxA + 1, last);
        const tA = frames[idxA]!.time;
        const tB = frames[idxB]!.time;
        lerp = tB > tA ? (t - tA) / (tB - tA) : 0;
      }

      // 量化到 0.1 bucket：同 bucket 不重算
      const bucket = Math.round(lerp * LERP_BUCKETS) / LERP_BUCKETS;
      const bucketKey = `${idxA}:${idxB}:${bucket}`;
      if (!force && bucketKey === lastBucketKeyRef.current) return;
      const now = performance.now();
      if (!force && now - lastFlushMsRef.current < MIN_FLUSH_INTERVAL_MS) return;
      lastBucketKeyRef.current = bucketKey;
      lastFlushMsRef.current = now;

      const frameA = frames[idxA]!;
      const frameB = frames[idxB]!;
      setTemperatureGridFrameTime(
        Math.round(frameA.time + (frameB.time - frameA.time) * bucket),
      );

      let applied = appliedRef.current;
      if (!applied || applied.length !== landIndices.length) {
        applied = new Int16Array(landIndices.length).fill(NEVER_APPLIED);
        appliedRef.current = applied;
      }

      for (let li = 0; li < landIndices.length; li++) {
        const rawA = frameA.values[li];
        const rawB = frameB.values[li];
        if (rawA === undefined || rawB === undefined) continue;
        const v10 = Math.round(rawA + (rawB - rawA) * bucket); // 仍為「溫度 ×10」整數
        if (applied[li] === v10) continue;
        applied[li] = v10;
        map.setFeatureState(
          { source: TEMPERATURE_GRID_SOURCE_ID, id: landIndices[li]! },
          { temp: v10 / 10 },
        );
      }
      firstFlushDoneRef.current = true;
    };

    /** 建 source/layer + 灌幾何 + 開可見性（底圖切換後可重呼） */
    const mount = () => {
      if (cancelled) return;
      if (!ensureTemperatureGridLayer(map, opacityRef.current)) return;
      if (geometryOfRef.current !== data) {
        setTemperatureGridData(map, temperatureGridToGeoJSON(data));
        geometryOfRef.current = data;
        resetAppliedState();
      }
      setTemperatureGridVisible(map, true);
      setTemperatureGridOpacity(map, opacityRef.current);
      flush(timeStore.getTime(), true);
    };

    mount();

    // source 首次 loaded 才能可靠 setFeatureState
    const onSourceData = (e: MapSourceDataEvent) => {
      if (firstFlushDoneRef.current) return;
      if (e.sourceId === TEMPERATURE_GRID_SOURCE_ID && map.isSourceLoaded(TEMPERATURE_GRID_SOURCE_ID)) {
        flush(timeStore.getTime(), true);
      }
    };
    map.on("sourcedata", onSourceData);

    // 底圖切換 → source/layer/feature-state 全被清掉，重建一次
    const onStyleLoad = () => {
      geometryOfRef.current = null;
      resetAppliedState();
      setTimeout(mount, 0);
    };
    map.on("style.load", onStyleLoad);

    const unsubscribe = timeStore.subscribeThrottled(MIN_FLUSH_INTERVAL_MS, (t) => flush(t, false));

    return () => {
      cancelled = true;
      map.off("sourcedata", onSourceData);
      map.off("style.load", onStyleLoad);
      unsubscribe();
      if (map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) setTemperatureGridVisible(map, false);
    };
  }, [mapRef, data, visible, mapRetry, mapTick]);

  // ── 透明度 slider ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    setTemperatureGridOpacity(map, opacity);
  }, [mapRef, opacity, visible, mapTick]);
}
