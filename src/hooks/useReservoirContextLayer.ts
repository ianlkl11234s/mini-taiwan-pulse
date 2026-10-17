import { useEffect, useRef, useState } from "react";
import { useMapReadyTick } from "./useMapReadyTick";
import { setPaintPropertyGuarded } from "../map/overlayManager";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  GeoJSONSource,
} from "mapbox-gl";
import {
  fetchReservoirContext,
  fetchReservoirWatershedRivers,
  type ReservoirContext,
} from "../data/reservoirContextLoader";

/**
 * 點擊水庫後的 context 動態疊層
 *
 * 當 activeCompareId 有值時：
 *   1. 呼叫 get_reservoir_context(compareId)
 *   2. 動態建立 3 個 mapbox source + layer：
 *      - reservoir-ctx-watershed  集水區 polygon（半透明填色 + 外框）
 *      - reservoir-ctx-basin-outline  所在流域 polygon 外框（粗線強調）
 *      - reservoir-ctx-river-line  最近河川線（亮色強調）
 *
 * 當 activeCompareId 變回 null（panel 關閉）或切換到其他水庫：
 *   - 清除所有疊層（setData 空 FeatureCollection）
 *
 * 回傳 context 供 FeatureInfoPanel 顯示內容。
 *
 * 疊層是「臨時高亮」性質，不受 LayerSidebar toggle 控制。
 */

const SRC_WATERSHED = "reservoir-ctx-watershed";
const SRC_BASIN = "reservoir-ctx-basin";
const SRC_RIVER = "reservoir-ctx-river";
const SRC_NETWORK = "reservoir-ctx-watershed-rivers";

const L_WATERSHED_FILL = "reservoir-ctx-watershed-fill";
const L_WATERSHED_LINE = "reservoir-ctx-watershed-line";
const L_BASIN_LINE = "reservoir-ctx-basin-line";
const L_RIVER_GLOW = "reservoir-ctx-river-glow";
const L_RIVER_LINE = "reservoir-ctx-river-line";
const L_NETWORK_GLOW = "reservoir-ctx-watershed-rivers-glow";
const L_NETWORK_LINE = "reservoir-ctx-watershed-rivers-line";

const COLOR_WATERSHED = "#22d3ee";
const COLOR_BASIN = "#a78bfa";
const COLOR_RIVER = "#38bdf8";
const COLOR_NETWORK = "#7dd3fc";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function ensureSources(map: MapboxMap) {
  for (const id of [SRC_WATERSHED, SRC_BASIN, SRC_RIVER, SRC_NETWORK]) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: "geojson", data: EMPTY_FC });
    }
  }
}

function ensureLayers(map: MapboxMap) {
  // 集水區內河網（先畫，在 watershed fill 之上、其他 line 之下做底）
  if (!map.getLayer(L_NETWORK_GLOW)) {
    map.addLayer({
      id: L_NETWORK_GLOW,
      type: "line",
      source: SRC_NETWORK,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_NETWORK,
        "line-width": 3.5,
        "line-blur": 4,
        "line-opacity": 0.35,
      },
    } as LineLayer);
  }
  if (!map.getLayer(L_NETWORK_LINE)) {
    map.addLayer({
      id: L_NETWORK_LINE,
      type: "line",
      source: SRC_NETWORK,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_NETWORK,
        "line-width": 1.2,
        "line-opacity": 0.85,
      },
    } as LineLayer);
  }
  if (!map.getLayer(L_WATERSHED_FILL)) {
    map.addLayer({
      id: L_WATERSHED_FILL,
      type: "fill",
      source: SRC_WATERSHED,
      paint: {
        "fill-color": COLOR_WATERSHED,
        "fill-opacity": 0.12,
      },
    } as FillLayer);
  }
  if (!map.getLayer(L_WATERSHED_LINE)) {
    map.addLayer({
      id: L_WATERSHED_LINE,
      type: "line",
      source: SRC_WATERSHED,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_WATERSHED,
        "line-width": 2.2,
        "line-opacity": 0.85,
      },
    } as LineLayer);
  }
  if (!map.getLayer(L_BASIN_LINE)) {
    map.addLayer({
      id: L_BASIN_LINE,
      type: "line",
      source: SRC_BASIN,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_BASIN,
        "line-width": 1.5,
        "line-opacity": 0.6,
        "line-dasharray": [3, 2],
      },
    } as LineLayer);
  }
  if (!map.getLayer(L_RIVER_GLOW)) {
    map.addLayer({
      id: L_RIVER_GLOW,
      type: "line",
      source: SRC_RIVER,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_RIVER,
        "line-width": 8,
        "line-blur": 6,
        "line-opacity": 0.35,
      },
    } as LineLayer);
  }
  if (!map.getLayer(L_RIVER_LINE)) {
    map.addLayer({
      id: L_RIVER_LINE,
      type: "line",
      source: SRC_RIVER,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLOR_RIVER,
        "line-width": 2.6,
        "line-opacity": 0.95,
      },
    } as LineLayer);
  }
}

function clearSources(map: MapboxMap) {
  for (const id of [SRC_WATERSHED, SRC_BASIN, SRC_RIVER, SRC_NETWORK]) {
    const src = map.getSource(id) as GeoJSONSource | undefined;
    if (src) src.setData(EMPTY_FC);
  }
}

function applyContext(map: MapboxMap, ctx: ReservoirContext) {
  const watershedSrc = map.getSource(SRC_WATERSHED) as GeoJSONSource | undefined;
  if (watershedSrc) {
    const geom = ctx.watershed?.geojson;
    watershedSrc.setData(
      geom
        ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: geom, properties: {} }] }
        : EMPTY_FC,
    );
  }

  const riverSrc = map.getSource(SRC_RIVER) as GeoJSONSource | undefined;
  if (riverSrc) {
    // nearest_river 因 river_lines 有 2,445 km outlier MultiLineString，KNN 命中後
    // 會全台都亮。集水區內河網改由 watershed_rivers RPC 呈現，這個 source 暫置空，
    // 不再畫 context.nearest_river。保留欄位結構以便未來有清理過的資料再啟用。
    riverSrc.setData(EMPTY_FC);
    void ctx.nearest_river; // silence unused warning
  }

  // basin outline：get_reservoir_context 沒回 basin geometry，這裡暫不畫
  // 未來若要畫，可在 RPC 擴 'basin_geojson' 或前端以 basin_no 到 waterBasins static 圖層查
}

function applyWatershedRivers(map: MapboxMap, fc: GeoJSON.FeatureCollection) {
  const src = map.getSource(SRC_NETWORK) as GeoJSONSource | undefined;
  if (src) src.setData(fc);
}

/** 被 dim 覆蓋的 paint：原值（dim 前）＋我們寫入的 dim 值。key = `${layerId}|${prop}` */
type DimRecord = Map<string, { layerId: string; prop: string; original: unknown; dimmed: unknown }>;

const DIM_TARGETS: ReadonlyArray<readonly [layerId: string, prop: string, active: number, dim: number]> = [
  // 蓄水範圍 polygon（fill + outline + glow）
  ["water-reservoir-poly-fill", "fill-opacity", 0.6, 0.05],
  ["water-reservoir-poly-outline", "line-opacity", 1.0, 0.15],
  ["water-reservoir-poly-glow", "line-opacity", 0.4, 0.05],
  // 壩體節點（3 層 circle）
  ["water-reservoir-dams-glow-2", "circle-opacity", 0.5, 0.1],
  ["water-reservoir-dams-glow-1", "circle-opacity", 0.85, 0.2],
  ["water-reservoir-dams-core", "circle-opacity", 1.0, 0.3],
];

/**
 * 依 active compare_id 調整靜態水庫圖層 opacity：
 *   - 有 active 時：active 水庫保留原亮度、其他水庫 opacity × ~0.15
 *   - 無 active：還原 dim 前的原 paint（沒 dim 過就什麼都不做）
 * 解決「點水庫後全台蓄水面都亮導致焦點散掉」的問題。
 *
 * A0：以前 activeId=null 時無條件寫死 dark 主題值 —— mount 時就對隱藏 layer 改 paint，
 * 留下永不清除的 transition prior（地圖無限重畫），淺色主題也被蓋成暗色值。
 * 現在只還原自己 dim 過的屬性，且若期間 overlayManager 已改寫（theme/opacity param）
 * 就不覆蓋。寫入一律走 setPaintPropertyGuarded：All Off 後還原時 layer 已隱藏，
 * 會延後到圖層重新顯示才寫入。
 * 回傳新的 dim 記錄（無 dim → null）。
 */
function applyReservoirDim(map: MapboxMap, activeId: number | null, record: DimRecord | null): DimRecord | null {
  if (activeId == null) {
    if (record) {
      for (const { layerId, prop, original, dimmed } of record.values()) {
        if (!map.getLayer(layerId)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = (map.getPaintProperty as any)(layerId, prop);
        if (JSON.stringify(current) !== JSON.stringify(dimmed)) continue;
        setPaintPropertyGuarded(map, layerId, prop, original);
      }
    }
    return null;
  }

  const next: DimRecord = new Map();
  for (const [layerId, prop, activeValue, dimValue] of DIM_TARGETS) {
    if (!map.getLayer(layerId)) continue;
    const key = `${layerId}|${prop}`;
    const dimmed = [
      "case",
      ["==", ["coalesce", ["get", "compare_id"], -1], activeId],
      activeValue,
      dimValue,
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (map.getPaintProperty as any)(layerId, prop);
    // 目前值仍是上一次 dim 的結果（切換到另一座水庫）→ 沿用最初的原值；
    // 否則（首次 dim，或期間被 overlayManager / style reload 改寫）以目前值為原值
    const prev = record?.get(key);
    const original = prev && JSON.stringify(current) === JSON.stringify(prev.dimmed) ? prev.original : current;
    // 注意 theme 切換時 overlayManager 會 rebuild paint 把這裡覆蓋掉，需再次 trigger。
    setPaintPropertyGuarded(map, layerId, prop, dimmed);
    next.set(key, { layerId, prop, original, dimmed });
  }
  return next;
}

export function useReservoirContextLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  activeCompareId: number | null,
): ReservoirContext | null {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  const [context, setContext] = useState<ReservoirContext | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 若 map 還沒載入 style，等它好再建 sources/layers
    const init = () => {
      ensureSources(map);
      ensureLayers(map);
      clearSources(map);
    };
    if (map.isStyleLoaded()) init();
    else map.once("load", init);
  }, [mapRef, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeCompareId == null) {
      setContext(null);
      let disposed = false;
      let retryPending = false;
      const clear = () => {
        retryPending = false;
        if (disposed) return;
        try { clearSources(map); } catch {
          retryPending = true;
          map.once("idle", clear);
        }
      };
      // All Off 清 featureInfo 時要立刻清 context，不能因 tile busy 跳過。
      clear();
      return () => {
        disposed = true;
        if (retryPending) map.off("idle", clear);
      };
    }

    let stale = false;
    let retryPending = false;
    let retryApply: (() => void) | null = null;

    const run = async () => {
      try {
        // 平行打兩支 RPC：context（panel 資料 + watershed polygon）+ watershed_rivers（集水區河網）
        const [ctx, rivers] = await Promise.all([
          fetchReservoirContext(activeCompareId),
          fetchReservoirWatershedRivers(activeCompareId).catch((err) => {
            console.warn("[ReservoirContext] watershed rivers failed:", err);
            return { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
          }),
        ]);
        if (stale) return;
        setContext(ctx);
        const apply = () => {
          retryPending = false;
          if (stale) return;
          try {
            ensureSources(map);
            ensureLayers(map);
            applyContext(map, ctx);
            applyWatershedRivers(map, rivers);
          } catch {
            retryPending = true;
            map.once("idle", apply);
          }
        };
        retryApply = apply;
        apply();
      } catch (err) {
        console.warn("[ReservoirContext] fetch failed:", err);
        if (!stale) setContext(null);
      }
    };

    run();

    return () => {
      stale = true;
      if (retryPending && retryApply) map.off("idle", retryApply);
    };
  }, [activeCompareId, mapRef, mapTick]);

  // ── 依 activeCompareId 調整其他水庫圖層 opacity（突顯當前、淡化其他） ──
  const dimRecordRef = useRef<DimRecord | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // 若 layer 還沒建（overlayManager 還沒 load），下次 effect trigger 再試
    dimRecordRef.current = applyReservoirDim(map, activeCompareId, dimRecordRef.current);
  }, [activeCompareId, mapRef, mapTick]);

  return context;
}
