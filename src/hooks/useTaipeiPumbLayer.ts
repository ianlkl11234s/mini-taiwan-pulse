import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { fetchTaipeiPumbLatest, type PumbLatestRow } from "../data/wicTaipeiLoader";
import { useMapReadyTick } from "./useMapReadyTick";

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
 * 運轉中（pumb_status='運轉'）: 描白邊 stroke-width 2
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

function dotRadiusExpression(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    8, 3 * scale,
    12, 6 * scale,
    16, 11 * scale,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": dotRadiusExpression(scale * 2.2),
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
        "circle-radius": dotRadiusExpression(scale),
        "circle-color": riskColorExpression(),
        "circle-opacity": opacity,
        "circle-stroke-width": [
          "case", ["==", ["get", "pumb_running"], true], 2, 0,
        ],
        "circle-stroke-color": "#ffffff",
      },
    });
  } else {
    map.setPaintProperty(LAYER_DOT, "circle-radius", dotRadiusExpression(scale));
    map.setPaintProperty(LAYER_DOT, "circle-opacity", opacity);
    map.setPaintProperty(LAYER_GLOW, "circle-radius", dotRadiusExpression(scale * 2.2));
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", ["*", opacity, 0.25] as unknown as ExpressionSpecification);
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
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<PumbLatestRow[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const apply = () => {
      try { ensureLayers(map, scale, opacity); } catch { return; }
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

    apply();
    if (visible && dataRef.current.length === 0) refresh();
    if (visible) {
      const t = window.setInterval(refresh, REFRESH_MS);
      return () => { cancelled = true; window.clearInterval(t); };
    }
    return () => { cancelled = true; };
  }, [mapRef, visible, scale, opacity, mapTick]);
}
