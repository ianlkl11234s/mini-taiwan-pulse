import { useEffect, useState } from "react";
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

export function useReservoirContextLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  activeCompareId: number | null,
): ReservoirContext | null {
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
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeCompareId == null) {
      setContext(null);
      if (map.isStyleLoaded()) clearSources(map);
      return;
    }

    let stale = false;

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
          ensureSources(map);
          ensureLayers(map);
          applyContext(map, ctx);
          applyWatershedRivers(map, rivers);
        };
        if (!map.isStyleLoaded()) map.once("load", apply);
        else apply();
      } catch (err) {
        console.warn("[ReservoirContext] fetch failed:", err);
        if (!stale) setContext(null);
      }
    };

    run();

    return () => {
      stale = true;
    };
  }, [activeCompareId, mapRef]);

  return context;
}
