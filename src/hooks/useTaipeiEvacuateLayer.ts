import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { fetchTaipeiEvacuateLatest, type EvacuateLatestRow } from "../data/wicTaipeiLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 北市疏散門 latest layer
 *
 * 配色（gate_state，從 fo/fc/flt 推導）:
 *   - faulted  黃   #fbbf24  任一門 flt=+
 *   - closed   紅   #ef4444  任一門 fc=+（防護啟動）
 *   - open     綠   #22c55e  全 fo=+
 *   - unknown  灰   #6b7280
 *
 * 每 60 秒重新拉。
 */

const SOURCE_ID = "taipei-evac-src";
const LAYER_DOT = "taipei-evac-dot";

const REFRESH_MS = 60_000;

function stateColorExpression(): ExpressionSpecification {
  return [
    "match",
    ["get", "gate_state"],
    "faulted", "#fbbf24",
    "closed",  "#ef4444",
    "open",    "#22c55e",
    /* default */ "#6b7280",
  ] as unknown as ExpressionSpecification;
}

function dotRadiusExpression(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    8, 4 * scale,
    12, 7 * scale,
    16, 12 * scale,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(LAYER_DOT)) {
    map.addLayer({
      id: LAYER_DOT,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": dotRadiusExpression(scale),
        "circle-color": stateColorExpression(),
        "circle-opacity": opacity,
        "circle-stroke-width": 1.2,
        "circle-stroke-color": "#ffffff",
      },
    });
  } else {
    map.setPaintProperty(LAYER_DOT, "circle-radius", dotRadiusExpression(scale));
    map.setPaintProperty(LAYER_DOT, "circle-opacity", opacity);
  }
}

function deriveState(r: EvacuateLatestRow): string {
  const any = (...vs: (string | null)[]) => vs.some((v) => v === "+");
  if (any(r.flt01, r.flt02)) return "faulted";
  if (any(r.fc01, r.fc02)) return "closed";
  if (any(r.fo01, r.fo02)) return "open";
  return "unknown";
}

function setData(map: MapboxMap, rows: EvacuateLatestRow[]) {
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
          gate_num: r.gate_num,
          gate_state: deriveState(r),
          fo01: r.fo01, fc01: r.fc01, flt01: r.flt01,
          fo02: r.fo02, fc02: r.fc02, flt02: r.flt02,
          observed_at: r.observed_at,
        },
      })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  if (map.getLayer(LAYER_DOT)) map.setLayoutProperty(LAYER_DOT, "visibility", visible ? "visible" : "none");
}

export function useTaipeiEvacuateLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  scale: number,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<EvacuateLatestRow[]>([]);

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
        const rows = await fetchTaipeiEvacuateLatest();
        if (cancelled) return;
        dataRef.current = rows;
        apply();
      } catch (e) {
        console.warn("[TaipeiEvacuate] fetch failed:", e);
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
