import { useEffect, useRef, useCallback } from "react";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  CircleLayer,
  GeoJSONSource,
} from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { unitColor } from "../engines/DispatchEngine";
import type { ScenarioEngine, FireState } from "../engines/ScenarioEngine";

/**
 * 消防想定動態圖層（火場 + 出動單位），仿 useFreewayLayer：
 * 自管一個 GeoJSON source，訂閱 timeStore 每幀重建 features。
 * 火場足跡用真實地理 polygon（公尺→度換算），確保各 zoom 下大小正確。
 */

const SOURCE_ID = "fire-scenario";
const LAYER_FIRE_FILL = "fireScenario-fill";
const LAYER_FIRE_GLOW = "fireScenario-glow";
const LAYER_ROUTE = "fireScenario-route";
const LAYER_UNIT = "fireScenario-unit";
const ALL_LAYERS = [LAYER_FIRE_FILL, LAYER_FIRE_GLOW, LAYER_ROUTE, LAYER_UNIT];

const M_PER_DEG_LAT = 111320;
const ELLIPSE_SEGMENTS = 48;

/** 把火場狀態轉成地理橢圓 polygon ring（風向沿 bearing 拉長 stretch 倍） */
function fireRing(fire: FireState): [number, number][] {
  const [lng, lat] = fire.origin;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const stretch = fire.wind?.stretch ?? 1;
  const a = fire.radiusM * stretch; // 沿風向半徑
  const b = fire.radiusM; // 側向半徑
  const phi = ((fire.wind?.bearingDeg ?? 0) * Math.PI) / 180; // 自北順時針
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const ring: [number, number][] = [];
  for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
    const t = (i / ELLIPSE_SEGMENTS) * 2 * Math.PI;
    const u = a * Math.cos(t); // 沿風向
    const v = b * Math.sin(t); // 側向
    const eastM = u * sinP + v * cosP;
    const northM = u * cosP - v * sinP;
    ring.push([lng + eastM / mPerDegLng, lat + northM / M_PER_DEG_LAT]);
  }
  return ring;
}

function buildGeoJSON(
  engine: ScenarioEngine | null,
  unix: number,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (engine) {
    for (const fire of engine.getActiveFires(unix)) {
      features.push({
        type: "Feature",
        properties: { kind: "fire", radiusM: Math.round(fire.radiusM) },
        geometry: { type: "Polygon", coordinates: [fireRing(fire)] },
      });
    }
    for (const route of engine.getActiveRoutes(unix)) {
      features.push({
        type: "Feature",
        properties: { kind: "route" },
        geometry: { type: "LineString", coordinates: route },
      });
    }
    for (const unit of engine.getDispatchUnits(unix)) {
      features.push({
        type: "Feature",
        properties: { kind: "unit", color: unitColor(unit.unitKind), arrived: unit.arrived },
        geometry: { type: "Point", coordinates: unit.position },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function buildLayers(map: MapboxMap, isDark: boolean): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  if (!map.getLayer(LAYER_FIRE_FILL)) {
    map.addLayer({
      id: LAYER_FIRE_FILL,
      type: "fill",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "fire"],
      paint: { "fill-color": "#ff4d00", "fill-opacity": isDark ? 0.32 : 0.28 },
    } as FillLayer);
  }
  if (!map.getLayer(LAYER_FIRE_GLOW)) {
    map.addLayer({
      id: LAYER_FIRE_GLOW,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "fire"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffb000", "line-width": 2, "line-blur": 3, "line-opacity": 0.85 },
    } as LineLayer);
  }
  if (!map.getLayer(LAYER_ROUTE)) {
    map.addLayer({
      id: LAYER_ROUTE,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "route"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": isDark ? "#8fd3ff" : "#2b6cb0",
        "line-width": 2,
        "line-dasharray": [2, 2],
        "line-opacity": 0.6,
      },
    } as LineLayer);
  }
  if (!map.getLayer(LAYER_UNIT)) {
    map.addLayer({
      id: LAYER_UNIT,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "unit"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 13, 8, 16, 12],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.95,
      },
    } as CircleLayer);
  }
  return true;
}

export function useFireScenarioLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  engineRef: React.RefObject<ScenarioEngine | null>,
) {
  const layersReadyRef = useRef(false);

  const ensureLayers = useCallback(
    (map: MapboxMap) => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!layersReadyRef.current || !map.getLayer(LAYER_UNIT)) {
        layersReadyRef.current = buildLayers(map, isDark);
      }
      return layersReadyRef.current;
    },
    [isDark],
  );

  const refresh = useCallback((map: MapboxMap, unix: number) => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildGeoJSON(engineRef.current, unix));
  }, [engineRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!visible) {
      for (const id of ALL_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
      return;
    }

    if (!ensureLayers(map)) return;
    for (const id of ALL_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }

    const tick = (unix: number) => {
      const m = mapRef.current;
      if (m) refresh(m, unix);
    };
    tick(timeStore.getTime()); // 初始 + seek/暫停時的單次重繪
    return timeStore.subscribe(tick); // 每幀更新（單位數量少，成本可忽略）
  }, [visible, ensureLayers, refresh, mapRef]);
}
