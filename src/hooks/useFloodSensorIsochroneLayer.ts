import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";
import { fetchFloodSensorLatest, type FloodSensorRow } from "../data/floodSensorLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 雙北 USWG 3-min 步行等時圈
 *
 * PMTiles 來自 taipei-gis-analytics 的 osmnx batch（pipeline 待開發）：
 *   public/flood/uswg_isochrone_3min.pmtiles
 *   - source-layer: "isochrone"
 *   - properties: iow_station_id, name, county_name
 *
 * 著色：以 iow_station_id 查 floodSensorLatest 的 depth_cm，以
 *       mapbox `match` expression 著色（0 灰、>0 黃→紅）。
 *       depth 改變時用 setPaintProperty 重組 match expression。
 *
 * 若 PMTiles 檔不存在（osmnx pipeline 尚未跑），fetch 會 404 但 layer 不會出錯，只是看不到。
 */

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

let sourceTypeRegistered = false;
function registerSourceTypeOnce() {
  if (sourceTypeRegistered) return;
  sourceTypeRegistered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (t: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(SOURCE_TYPE, PmTilesSource);
  } catch {
    // 其他 PMTiles factory 已註冊過
  }
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}flood`;
const SOURCE_ID = "flood-sensor-isochrone";
const SOURCE_LAYER = "isochrone";
const FILL_ID = "flood-sensor-isochrone-fill";
const LINE_ID = "flood-sensor-isochrone-line";
const REFRESH_MS = 10 * 60 * 1000;

/** 把 depth_cm 對應的顏色塞成 mapbox match expression by iow_station_id */
function buildColorExpression(rows: FloodSensorRow[]) {
  // 預設色（沒在 latest 裡 / 站值=0）：深灰
  const DEFAULT = "#404040";
  const pairs: Array<[string, string]> = [];
  for (const r of rows) {
    const v = r.value ?? 0;
    let color = "";
    if (v >= 30) color = "#7f1d1d";
    else if (v >= 15) color = "#ef4444";
    else if (v >= 5) color = "#fb923c";
    else if (v > 0) color = "#fde047";
    if (color) pairs.push([r.iow_station_id, color]);
  }
  // mapbox match 至少需 1 對 (input,output)，若全部站都 0 cm → 退回單一常數
  if (pairs.length === 0) {
    return DEFAULT as unknown as mapboxgl.ExpressionSpecification;
  }
  const expr: unknown[] = ["match", ["get", "iow_station_id"]];
  for (const [id, color] of pairs) expr.push(id, color);
  expr.push(DEFAULT);
  return expr as unknown as mapboxgl.ExpressionSpecification;
}

/** 只顯示雙北（PMTiles features 的 county_name 預期已是「臺北市」/「新北市」）*/
const TAIPEI_FILTER: FilterSpecification = [
  "in", ["get", "county_name"], ["literal", ["臺北市", "新北市"]],
] as unknown as FilterSpecification;

export function useFloodSensorIsochroneLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const latestRowsRef = useRef<FloodSensorRow[]>([]);

  useEffect(() => {
    if (!visible) {
      const map = mapRef.current;
      if (map?.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, "visibility", "none");
      if (map?.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, "visibility", "none");
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayer = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) return;
      registerSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: SOURCE_TYPE,
          url: `${BASE}/uswg_isochrone_3min.pmtiles`,
          minzoom: 8,
          maxzoom: 14,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(FILL_ID)) {
        map.addLayer({
          id: FILL_ID,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 8,
          filter: TAIPEI_FILTER,
          paint: {
            "fill-color": buildColorExpression(latestRowsRef.current),
            "fill-opacity": 0.45 * opacity,
            "fill-antialias": false,
          },
        });
      }
      if (!map.getLayer(LINE_ID)) {
        map.addLayer({
          id: LINE_ID,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 10,
          filter: TAIPEI_FILTER,
          paint: {
            "line-color": "#1f2937",
            "line-width": 0.5,
            "line-opacity": 0.5 * opacity,
          },
        });
      }
      map.setLayoutProperty(FILL_ID, "visibility", "visible");
      map.setLayoutProperty(LINE_ID, "visibility", "visible");
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    if (map.isStyleLoaded()) ensureLayer();
    else pollTimer = setInterval(ensureLayer, 200);

    const refreshColors = async () => {
      try {
        const rows = await fetchFloodSensorLatest();
        if (cancelled) return;
        latestRowsRef.current = rows;
        if (map.getLayer(FILL_ID)) {
          map.setPaintProperty(FILL_ID, "fill-color", buildColorExpression(rows));
        }
        console.log(`[FloodIsochrone] colors refreshed (${rows.filter((r) => (r.value ?? 0) > 0).length} wet stations)`);
      } catch (err) {
        console.warn("[FloodIsochrone] color refresh failed:", err);
      }
    };

    refreshColors();
    refreshTimer = setInterval(refreshColors, REFRESH_MS);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      try {
        if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, "visibility", "none");
        if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, "visibility", "none");
      } catch { /* map 可能已銷毀 */ }
    };
  }, [mapRef, visible, opacity, mapTick]);
}
