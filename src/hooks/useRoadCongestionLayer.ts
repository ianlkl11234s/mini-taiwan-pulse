import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, LineLayer, ExpressionSpecification, MapSourceDataEvent } from "mapbox-gl";
import {
  fetchRoadCongestionDay,
  levelFromChar,
  slotIndexAt,
  type RoadCongestionDayData,
} from "../data/roadCongestionLoader";
import { timeStore } from "../state/timeStore";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 省道路況（TDX live_highway）動態圖層 — v1 highway only。
 *
 * ⚠️ 全站首個「PMTiles 幾何 + Mapbox feature-state 染色」圖層。
 * 不像 freeway 每 tick 重建整包 GeoJSON setData；這裡幾何是靜態 PMTiles，
 * 只用 timeStore 訂閱算出「當前 5 分鐘槽」，對每段查 timeline 字元 → level，
 * 只在 level 變化時 map.setFeatureState 染色（feature id = section_uid = promoteId）。
 *
 * feature-state 會被 Mapbox 依 source/sourceLayer/id 快取，套用到任何載入的 tile
 * （即使當下未在視窗內），所以只需在「當前槽變動」或「切換日期」時 flush 差異。
 */

const SOURCE_ID = "road-congestion";
const SOURCE_LAYER = "road_congestion_highway";
const SOURCE_URL = "./road/road_congestion_highway.pmtiles";
const LAYER_LINE = "road-congestion-line";
const LAYER_HIT = "road-congestion-hit"; // 透明加寬命中層（四鐵則③：細線點擊命中率極差）

/** feature-state.level → 顏色（無 state / level 0 → fallback 灰） */
const COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["coalesce", ["feature-state", "level"], 0],
  1, "#22c55e",
  2, "#eab308",
  3, "#f97316",
  4, "#ef4444",
  "#808080",
] as unknown as ExpressionSpecification;

function widthExpr(width: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    6, 0.6 * width,
    10, 1.6 * width,
    13, 3.2 * width,
    16, 5 * width,
  ] as unknown as ExpressionSpecification;
}

export function useRoadCongestionLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  width: number,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dayRef = useRef<RoadCongestionDayData | null>(null);
  const activeDateRef = useRef<string>("");
  const fetchingRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  // section_uid → 上次已套用的 level，用來只寫差異（避免每次全刷 6818）
  const lastAppliedRef = useRef<Map<string, number>>(new Map());
  const lastSlotRef = useRef<number>(-1);
  const firstFlushDoneRef = useRef(false);

  /** 確保 source + line + hit layers 存在 */
  const ensureLayers = useCallback(
    (map: MapboxMap) => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: SOURCE_URL,
          minzoom: 5,
          maxzoom: 14,
          // feature-state 染色鍵：feature id = section_uid
          promoteId: { [SOURCE_LAYER]: "section_uid" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": COLOR_EXPR,
            "line-width": widthExpr(width),
            "line-opacity": opacity,
          },
        } as unknown as LineLayer);
      }
      if (!map.getLayer(LAYER_HIT)) {
        map.addLayer({
          id: LAYER_HIT,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          paint: {
            "line-color": "#000000",
            "line-width": 12,
            "line-opacity": 0,
          },
        } as unknown as LineLayer);
      }
      layersReadyRef.current = !!map.getLayer(LAYER_LINE);
      return layersReadyRef.current;
    },
    [width, opacity],
  );

  /**
   * 把 currentTime 對應槽的 level 差異套到 feature-state。
   * - 首次 flush 前 source 須 loaded（避免 race）；之後 feature-state 由 Mapbox
   *   自行快取套到後續載入的 tile，不必每次 tile 載入重刷。
   * - 只寫「level 與上次不同」的段；無資料(0) 且從未寫過的段跳過（預設即灰）。
   */
  const flush = useCallback(
    (map: MapboxMap, t: number, force: boolean) => {
      const day = dayRef.current;
      if (!day || !map.getSource(SOURCE_ID)) return;
      if (!firstFlushDoneRef.current && !map.isSourceLoaded(SOURCE_ID)) return;
      // clamp 到最新有資料的 slot：realtime「當下」常在尚未刷新的槽，
      // 不 clamp 會全灰（見 RoadCongestionDayData.lastPopulatedSlot）。
      const slot = Math.min(slotIndexAt(t), day.lastPopulatedSlot);
      if (!force && slot === lastSlotRef.current) return;
      lastSlotRef.current = slot;
      const applied = lastAppliedRef.current;
      for (const sec of day.sections) {
        const level = levelFromChar(sec.timeline[slot]);
        const prev = applied.get(sec.section_uid);
        if (prev === level) continue;
        if (prev === undefined && level === 0) continue; // 預設已是灰
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: sec.section_uid },
          { level },
        );
        applied.set(sec.section_uid, level);
      }
      firstFlushDoneRef.current = true;
    },
    [],
  );

  /** 切換日期載入當日 timeline */
  const loadDay = useCallback(
    (dateStr: string) => {
      if (!dateStr || dateStr === activeDateRef.current || dateStr === fetchingRef.current) return;
      fetchingRef.current = dateStr;
      fetchRoadCongestionDay(dateStr)
        .then((day) => {
          if (fetchingRef.current !== dateStr) return;
          dayRef.current = day;
          activeDateRef.current = dateStr;
          lastSlotRef.current = -1; // 強制下一次 flush 重算
          const map = mapRef.current;
          if (map && ensureLayers(map)) flush(map, timeStore.getTime(), true);
        })
        .catch((err) => console.warn(`[RoadCongestion] load ${dateStr} failed:`, err))
        .finally(() => {
          if (fetchingRef.current === dateStr) fetchingRef.current = "";
        });
    },
    [ensureLayers, flush, mapRef],
  );

  // ── 訂閱日期變化載入當日資料 ──
  useEffect(() => {
    if (!visible) return;
    const handler = (dateStr: string) => { if (dateStr) loadDay(dateStr); };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [visible, loadDay]);

  // ── 可見性 + 節流訂閱 flush + source loaded 首刷 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of [LAYER_LINE, LAYER_HIT]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
      return;
    }
    if (!ensureLayers(map)) return;
    for (const id of [LAYER_LINE, LAYER_HIT]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }

    // source 首次 loaded 才能可靠 setFeatureState（避免 race）
    const onSourceData = (e: MapSourceDataEvent) => {
      if (firstFlushDoneRef.current) return;
      if (e.sourceId === SOURCE_ID && map.isSourceLoaded(SOURCE_ID)) {
        flush(map, timeStore.getTime(), true);
      }
    };
    map.on("sourcedata", onSourceData);

    const tick = (t: number) => {
      const m = mapRef.current;
      if (m) flush(m, t, false);
    };
    tick(timeStore.getTime());
    // 1s 節流足夠（資料本身 5min 粒度）
    const unsub = timeStore.subscribeThrottled(1000, tick);
    return () => {
      map.off("sourcedata", onSourceData);
      unsub();
    };
  }, [visible, ensureLayers, flush, mapRef, mapTick]);

  // ── 寬度 / 透明度變更 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (map.getLayer(LAYER_LINE)) {
      map.setPaintProperty(LAYER_LINE, "line-width", widthExpr(width));
      map.setPaintProperty(LAYER_LINE, "line-opacity", opacity);
    }
  }, [width, opacity, mapRef, mapTick]);
}
