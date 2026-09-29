import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { fetchTaipeiPumbLatest, type PumbLatestRow } from "../data/wicTaipeiLoader";
import { useMapReadyTick } from "./useMapReadyTick";
import { POINT_STROKE, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

/**
 * 北市抽水站 latest layer — 即時運轉狀態 + 內池警戒比
 *
 * 配色（risk_ratio = inner_value / max_allowable_water_level）:
 *   - >0.9    深紅 #7f1d1d
 *   - >0.8    紅   #ef4444
 *   - >0.6    橘   #fb923c
 *   - >0.4    黃   #fde047
 *   - else    青   #06b6d4
 *
 * 運轉中（pumb_status='運轉'）: 2px 外框（資料編碼；暗底圖白、淡底圖深灰 #111827，淡底圖上白框看不見）；
 * 其餘站點用底圖色細縫。
 *
 * 每 60 秒重新拉一次 latest（上游 10 分鐘更新）。
 */

const SOURCE_ID = "taipei-pumb-src";
const LAYER_DOT = "taipei-pumb-dot";
const LAYER_GLOW = "taipei-pumb-glow";

const REFRESH_MS = 60_000;

function riskColorExpression(): ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "risk_ratio"], 0],
    "#06b6d4",
    0.4, "#fde047",
    0.6, "#fb923c",
    0.8, "#ef4444",
    0.9, "#7f1d1d",
  ] as unknown as ExpressionSpecification;
}

const OPACITY_DEFAULT = Number(paramDefault("taipeiPumb", "taipeiPumbOpacity"));
const RUNNING_STROKE_WIDTH = 2;
const RUNNING_STROKE_COLOR = { dark: "#ffffff", light: "#111827" } as const;
const IS_RUNNING: ExpressionSpecification = ["==", ["get", "pumb_running"], true];

function pumbStrokePaint(isDark: boolean, opacity: number) {
  const seam = pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
  return {
    "circle-stroke-color": ["case", IS_RUNNING, RUNNING_STROKE_COLOR[isDark ? "dark" : "light"], seam["circle-stroke-color"]] as unknown as ExpressionSpecification,
    "circle-stroke-width": ["case", IS_RUNNING, RUNNING_STROKE_WIDTH, POINT_STROKE.width] as unknown as ExpressionSpecification,
    "circle-stroke-opacity": seam["circle-stroke-opacity"],
  };
}

function ensureLayers(map: MapboxMap, scale: number, opacity: number, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": pointRadius("M", scale) * 2,
        "circle-color": riskColorExpression(),
        "circle-opacity": ["*", opacity, 0.25],
        "circle-blur": 0.8,
      },
    });
  }
  if (!map.getLayer(LAYER_DOT)) {
    map.addLayer({
      id: LAYER_DOT,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": pointRadius("M", scale),
        "circle-color": riskColorExpression(),
        "circle-opacity": opacity,
        ...pumbStrokePaint(isDark, opacity),
      },
    });
  } else {
    map.setPaintProperty(LAYER_DOT, "circle-radius", pointRadius("M", scale));
    map.setPaintProperty(LAYER_DOT, "circle-opacity", opacity);
    map.setPaintProperty(LAYER_GLOW, "circle-radius", pointRadius("M", scale) * 2);
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", ["*", opacity, 0.25] as unknown as ExpressionSpecification);
    for (const [k, v] of Object.entries(pumbStrokePaint(isDark, opacity))) {
      map.setPaintProperty(LAYER_DOT, k as "circle-stroke-color", v as never);
    }
  }
}

function setData(map: MapboxMap, rows: PumbLatestRow[]) {
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
          stn_id: r.stn_id,
          stn_name: r.stn_name,
          inner_value: r.inner_value,
          outer_value: r.outer_value,
          max_allowable: r.max_allowable_water_level,
          risk_ratio: r.risk_ratio,
          pumb_status: r.pumb_status,
          door_status: r.door_status,
          pumb_running: r.pumb_status === "運轉",
          observed_at: r.observed_at,
        },
      })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_DOT, LAYER_GLOW]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function useTaipeiPumbLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  scale: number,
  opacity: number,
  isDark: boolean = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<PumbLatestRow[]>([]);
  // 樣式走 ref：輪詢 effect 不依賴 scale/opacity/isDark，拖滑桿或切主題不會重設 5 分鐘計時器
  const styleRef = useRef({ scale, opacity, isDark });
  styleRef.current = { scale, opacity, isDark };

  // 樣式／可見度變動：只重套 paint 與資料，不碰輪詢
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { ensureLayers(map, scale, opacity, isDark); } catch { return; }
    setData(map, dataRef.current);
    setVisible(map, visible);
  }, [mapRef, visible, scale, opacity, isDark, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const apply = () => {
      const { scale: s, opacity: o, isDark: d } = styleRef.current;
      try { ensureLayers(map, s, o, d); } catch { return; }
      setData(map, dataRef.current);
      setVisible(map, visible);
    };

    const refresh = async () => {
      try {
        const rows = await fetchTaipeiPumbLatest();
        if (cancelled) return;
        dataRef.current = rows;
        apply();
      } catch (e) {
        console.warn("[TaipeiPumb] fetch failed:", e);
      }
    };

    if (visible && dataRef.current.length === 0) refresh();
    if (visible) {
      const t = window.setInterval(refresh, REFRESH_MS);
      return () => { cancelled = true; window.clearInterval(t); };
    }
    return () => { cancelled = true; };
  }, [mapRef, visible, mapTick]);
}
