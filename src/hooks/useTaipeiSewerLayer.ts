import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { fetchTaipeiSewerLatest, type SewerLatestRow } from "../data/wicTaipeiLoader";
import { useMapReadyTick } from "./useMapReadyTick";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

/**
 * 北市雨水下水道水位 latest layer
 *
 * 配色（ground_far = 距地面深度 m，越小越接近溢出）:
 *   - <0.5  深紅 #7f1d1d  危險（接近地面）
 *   - <1    紅   #ef4444
 *   - <2    橘   #fb923c
 *   - <3    黃   #fde047
 *   - else  藍   #3b82f6  安全
 *
 * 每 60 秒重新拉。
 */

const SOURCE_ID = "taipei-sewer-src";
const LAYER_DOT = "taipei-sewer-dot";

const REFRESH_MS = 60_000;

function depthColorExpression(): ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "ground_far"], 999],
    "#7f1d1d",
    0.5, "#ef4444",
    1.0, "#fb923c",
    2.0, "#fde047",
    3.0, "#3b82f6",
  ] as unknown as ExpressionSpecification;
}

const OPACITY_DEFAULT = Number(paramDefault("taipeiSewer", "taipeiSewerOpacity"));

function ensureLayers(map: MapboxMap, scale: number, opacity: number, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(LAYER_DOT)) {
    map.addLayer({
      id: LAYER_DOT,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": pointRadius("M", scale),
        "circle-color": depthColorExpression(),
        "circle-opacity": opacity,
        ...pointStrokePaint(isDark, opacity / OPACITY_DEFAULT),
        "circle-blur": 0.1,
      },
    });
  } else {
    map.setPaintProperty(LAYER_DOT, "circle-radius", pointRadius("M", scale));
    map.setPaintProperty(LAYER_DOT, "circle-opacity", opacity);
    {
      const stroke = pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
      map.setPaintProperty(LAYER_DOT, "circle-stroke-color", stroke["circle-stroke-color"]);
      map.setPaintProperty(LAYER_DOT, "circle-stroke-width", stroke["circle-stroke-width"]);
      map.setPaintProperty(LAYER_DOT, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
    }
  }
}

function setData(map: MapboxMap, rows: SewerLatestRow[]) {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: rows
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng as number, r.lat as number] },
        properties: {
          station_no: r.station_no,
          station_name: r.station_name,
          level_out: r.level_out,
          ground_far: r.ground_far,
          observed_at: r.observed_at,
        },
      })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  if (map.getLayer(LAYER_DOT)) map.setLayoutProperty(LAYER_DOT, "visibility", visible ? "visible" : "none");
}

export function useTaipeiSewerLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  scale: number,
  opacity: number,
  isDark: boolean = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<SewerLatestRow[]>([]);
  // 樣式值走 ref：拖透明度／切主題只更新 paint，不重建抓資料的 effect 與輪詢
  const styleRef = useRef({ scale, opacity, isDark });
  styleRef.current = { scale, opacity, isDark };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const apply = () => {
      const st = styleRef.current;
      try { ensureLayers(map, st.scale, st.opacity, st.isDark); } catch { return; }
      setData(map, dataRef.current);
      setVisible(map, visible);
    };

    const refresh = async () => {
      try {
        const rows = await fetchTaipeiSewerLatest();
        if (cancelled) return;
        dataRef.current = rows;
        apply();
      } catch (e) {
        console.warn("[TaipeiSewer] fetch failed:", e);
      }
    };

    apply();
    if (visible && dataRef.current.length === 0) refresh();
    if (visible) {
      const t = window.setInterval(refresh, REFRESH_MS);
      return () => { cancelled = true; window.clearInterval(t); };
    }
    return () => { cancelled = true; };
  }, [mapRef, visible, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_DOT)) return;
    try { ensureLayers(map, scale, opacity, isDark); } catch { /* style 未就緒 */ }
  }, [mapRef, scale, opacity, isDark, mapTick]);
}
