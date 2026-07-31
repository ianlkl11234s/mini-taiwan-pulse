import mapboxgl from "mapbox-gl";
import type {
  Map as MapboxMap,
  CircleLayer,
  ExpressionSpecification,
  FillLayerSpecification,
} from "mapbox-gl";
import {
  CWA_INTENSITY_BANDS,
  SHAKEMAP_CELL_DEG,
  type EqReplayGridCell,
  type EqReplayStation,
  type EarthquakeReplayEvent,
} from "../data/earthquakeReplayTypes";
import { beachballSvg, type FocalMechanism } from "../lib/beachball";
import { registerPmtilesSourceTypeOnce } from "./pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "./pmtilesConstants";

/**
 * 地震回放（earthquakeReplay）— Mapbox source / layer 組裝。
 *
 * 五個視覺元件，全部是「回放時鐘的純函數」（見 useEarthquakeReplayLayer）：
 *   1. 震央核心 + S 波前圈（單一 feature，直接寫 paint 數值，不用表達式）
 *   2. 測站 circle（GeoJSON，feature id = index，feature-state `lit` / `flash`）
 *   3. 等震度網格 fill（GeoJSON polygon，幾何**只建一次**，feature-state `on` 控淡入）
 *   4. 鄉鎮面量圖 fill（PMTiles 幾何 + promoteId TOWNCODE，feature-state `eqi`）
 *   5. 沙灘球 Marker（beachball.ts 純 SVG，走 mapboxgl.Marker 不進 style）
 *
 * ⚠️ 鄉鎮走**自建 source**（不進 overlayManager / overlayRegistry 的通用路徑）——
 * 比照 useRoadCongestionLayer：通用路徑不支援 promoteId + feature-state 染色。
 * ⚠️ 網格 3,300+ polygon：時間變化一律只走 setFeatureState，絕不 setData（會卡死）。
 */

export const EQ_REPLAY_EPICENTER_SOURCE = "eq-replay-epicenter";
export const EQ_REPLAY_STATION_SOURCE = "eq-replay-stations";
export const EQ_REPLAY_GRID_SOURCE = "eq-replay-grid";
export const EQ_REPLAY_TOWN_SOURCE = "eq-replay-township";
export const EQ_REPLAY_TOWN_SOURCE_LAYER = "township_boundary";
const EQ_REPLAY_TOWN_URL = "./base_map/township_boundary.pmtiles";

export const EQ_REPLAY_GRID_LAYER = "eq-replay-grid-fill";
export const EQ_REPLAY_TOWN_LAYER = "eq-replay-town-fill";
export const EQ_REPLAY_STATION_LAYER = "eq-replay-station-circle";
export const EQ_REPLAY_WAVE_LAYER = "eq-replay-wavefront";
export const EQ_REPLAY_EPICENTER_LAYER = "eq-replay-epicenter-core";

/** 由下而上；dispose 時反向移除 */
const ALL_LAYERS = [
  EQ_REPLAY_GRID_LAYER,
  EQ_REPLAY_TOWN_LAYER,
  EQ_REPLAY_STATION_LAYER,
  EQ_REPLAY_WAVE_LAYER,
  EQ_REPLAY_EPICENTER_LAYER,
];
const ALL_SOURCES = [
  EQ_REPLAY_EPICENTER_SOURCE,
  EQ_REPLAY_STATION_SOURCE,
  EQ_REPLAY_GRID_SOURCE,
  EQ_REPLAY_TOWN_SOURCE,
];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 網格底色壓一階，避免蓋掉測站 / 鄉鎮 */
const GRID_BASE_ALPHA = 0.62;

// ── 色階表達式（CWA_INTENSITY_BANDS 單一資料源）────────────────────

function buildIntensityStep(input: ExpressionSpecification): ExpressionSpecification {
  const step: unknown[] = ["step", input, CWA_INTENSITY_BANDS[0]!.color];
  for (let i = 1; i < CWA_INTENSITY_BANDS.length; i++) {
    step.push(CWA_INTENSITY_BANDS[i]!.value, CWA_INTENSITY_BANDS[i]!.color);
  }
  return step as unknown as ExpressionSpecification;
}

const GRID_COLOR_EXPR = buildIntensityStep(["get", "intensity"] as unknown as ExpressionSpecification);
const STATION_COLOR_EXPR = buildIntensityStep(
  ["get", "intensity_value"] as unknown as ExpressionSpecification,
);
const TOWN_COLOR_EXPR = buildIntensityStep(
  ["coalesce", ["feature-state", "eqi"], 0] as unknown as ExpressionSpecification,
);

/** 未淡入的 cell 直接透明（feature-state 尚未寫入 → coalesce 0） */
function gridOpacityExpr(opacity: number): ExpressionSpecification {
  return ["*", opacity, ["coalesce", ["feature-state", "on"], 0]] as unknown as ExpressionSpecification;
}

/** 只染有感（≥ 1 級）鄉鎮；0 級與尚未寫入 state 的鄉鎮全透明 */
function townOpacityExpr(opacity: number): ExpressionSpecification {
  return [
    "case",
    ["<", ["coalesce", ["feature-state", "eqi"], -1], 0.5],
    0,
    opacity,
  ] as unknown as ExpressionSpecification;
}

/** 半徑依 PGA（gal）；`flash` 給抵達瞬間的彈跳、`lit` 給淡入 */
const STATION_RADIUS_EXPR = [
  "*",
  ["interpolate", ["linear"], ["get", "pga_int"], 0, 3.5, 10, 5, 50, 8, 200, 13, 500, 19],
  [
    "+",
    0.45,
    ["*", 0.55, ["coalesce", ["feature-state", "lit"], 0]],
    ["*", 0.9, ["coalesce", ["feature-state", "flash"], 0]],
  ],
] as unknown as ExpressionSpecification;

function stationOpacityExpr(opacity: number): ExpressionSpecification {
  return ["*", opacity, ["coalesce", ["feature-state", "lit"], 0]] as unknown as ExpressionSpecification;
}

/** 底圖之上、地名標籤之下（同 temperatureGridLayerFactory） */
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;
    for (const l of layers) {
      if (l.type === "symbol") return l.id;
    }
  } catch {
    // setStyle 進行中 getStyle() 會 throw → 當作沒有 beforeId
  }
  return undefined;
}

// ── GeoJSON 組裝 ────────────────────────────────────────────────────

export function epicenterToGeoJSON(ev: EarthquakeReplayEvent): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 0,
        geometry: { type: "Point", coordinates: [ev.epicenter_lng, ev.epicenter_lat] },
        properties: { event_id: ev.event_id, magnitude: ev.magnitude, depth_km: ev.depth_km },
      },
    ],
  };
}

/** feature id = 陣列 index（供 setFeatureState 定位） */
export function stationsToGeoJSON(stations: EqReplayStation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map((s, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      properties: {
        station_id: s.station_id,
        intensity_value: s.intensity_value,
        pga_int: s.pga_int,
        epicenter_distance_km: s.epicenter_distance_km,
      },
    })),
  };
}

/** 每 cell 一個 0.025° 方格（lon/lat 為格點中心，±half 展開）；feature id = index */
export function gridToGeoJSON(cells: EqReplayGridCell[]): GeoJSON.FeatureCollection {
  const half = SHAKEMAP_CELL_DEG / 2;
  return {
    type: "FeatureCollection",
    features: cells.map((c, i) => {
      const w = c.lon - half;
      const e = c.lon + half;
      const s = c.lat - half;
      const n = c.lat + half;
      return {
        type: "Feature" as const,
        id: i,
        properties: { intensity: c.intensity, pga: c.pga },
        geometry: {
          type: "Polygon" as const,
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      };
    }),
  };
}

// ── 建 / 拆 ─────────────────────────────────────────────────────────

/** 確保 source + 5 個 layer 存在（idempotent，底圖切換後可重呼）；回傳是否就緒 */
export function ensureEarthquakeReplayLayers(map: MapboxMap, opacity: number): boolean {
  registerPmtilesSourceTypeOnce();

  for (const id of [EQ_REPLAY_EPICENTER_SOURCE, EQ_REPLAY_STATION_SOURCE, EQ_REPLAY_GRID_SOURCE]) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource(EQ_REPLAY_TOWN_SOURCE)) {
    map.addSource(EQ_REPLAY_TOWN_SOURCE, {
      type: PMTILES_SOURCE_TYPE,
      url: EQ_REPLAY_TOWN_URL,
      minzoom: 6,
      maxzoom: 13,
      // feature-state 染色鍵：feature id = TOWNCODE（8 碼；CWA 7 碼轉換見 types 檔）
      promoteId: { [EQ_REPLAY_TOWN_SOURCE_LAYER]: "TOWNCODE" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  const before = firstSymbolLayerId(map);

  if (!map.getLayer(EQ_REPLAY_GRID_LAYER)) {
    map.addLayer(
      {
        id: EQ_REPLAY_GRID_LAYER,
        type: "fill",
        source: EQ_REPLAY_GRID_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "fill-color": GRID_COLOR_EXPR,
          "fill-opacity": gridOpacityExpr(opacity * GRID_BASE_ALPHA),
          // 相鄰格點連續鋪滿，開 antialias 會在格線留白邊
          "fill-antialias": false,
        },
      } as FillLayerSpecification,
      before,
    );
  }
  if (!map.getLayer(EQ_REPLAY_TOWN_LAYER)) {
    map.addLayer(
      {
        id: EQ_REPLAY_TOWN_LAYER,
        type: "fill",
        source: EQ_REPLAY_TOWN_SOURCE,
        "source-layer": EQ_REPLAY_TOWN_SOURCE_LAYER,
        layout: { visibility: "none" },
        paint: {
          "fill-color": TOWN_COLOR_EXPR,
          "fill-opacity": townOpacityExpr(0),
          "fill-outline-color": "rgba(0,0,0,0.25)",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      before,
    );
  }
  if (!map.getLayer(EQ_REPLAY_STATION_LAYER)) {
    map.addLayer(
      {
        id: EQ_REPLAY_STATION_LAYER,
        type: "circle",
        source: EQ_REPLAY_STATION_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": STATION_RADIUS_EXPR,
          "circle-color": STATION_COLOR_EXPR,
          "circle-opacity": stationOpacityExpr(opacity * 0.85),
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": stationOpacityExpr(opacity * 0.55),
        },
      } as CircleLayer,
      before,
    );
  }
  if (!map.getLayer(EQ_REPLAY_WAVE_LAYER)) {
    map.addLayer(
      {
        id: EQ_REPLAY_WAVE_LAYER,
        type: "circle",
        source: EQ_REPLAY_EPICENTER_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 0,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fca5a5",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0,
        },
      } as CircleLayer,
      before,
    );
  }
  if (!map.getLayer(EQ_REPLAY_EPICENTER_LAYER)) {
    map.addLayer(
      {
        id: EQ_REPLAY_EPICENTER_LAYER,
        type: "circle",
        source: EQ_REPLAY_EPICENTER_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 0,
          "circle-color": "#ef4444",
          "circle-opacity": 0,
          "circle-stroke-color": "#fee2e2",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0,
        },
      } as CircleLayer,
      before,
    );
  }

  return !!map.getLayer(EQ_REPLAY_EPICENTER_LAYER);
}

export function removeEarthquakeReplayLayers(map: MapboxMap): void {
  for (let i = ALL_LAYERS.length - 1; i >= 0; i--) {
    const id = ALL_LAYERS[i]!;
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of ALL_SOURCES) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

export function setEarthquakeReplayVisible(map: MapboxMap, visible: boolean): void {
  for (const id of ALL_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

function setGeoJSON(map: MapboxMap, sourceId: string, data: GeoJSON.FeatureCollection): void {
  const src = map.getSource(sourceId);
  if (!src || src.type !== "geojson") return;
  src.setData(data);
}

export function setReplayEpicenterData(map: MapboxMap, data: GeoJSON.FeatureCollection): void {
  setGeoJSON(map, EQ_REPLAY_EPICENTER_SOURCE, data);
}
export function setReplayStationData(map: MapboxMap, data: GeoJSON.FeatureCollection): void {
  setGeoJSON(map, EQ_REPLAY_STATION_SOURCE, data);
}
export function setReplayGridData(map: MapboxMap, data: GeoJSON.FeatureCollection): void {
  setGeoJSON(map, EQ_REPLAY_GRID_SOURCE, data);
}

/** 網格整體透明度（`dim` 供鄉鎮定格時把網格壓暗，讓面量圖讀得出來） */
export function setReplayGridOpacity(map: MapboxMap, opacity: number, dim: number): void {
  if (!map.getLayer(EQ_REPLAY_GRID_LAYER)) return;
  map.setPaintProperty(
    EQ_REPLAY_GRID_LAYER,
    "fill-opacity",
    gridOpacityExpr(opacity * GRID_BASE_ALPHA * dim),
  );
}

/** 鄉鎮面量圖淡入（fade 0→1） */
export function setReplayTownOpacity(map: MapboxMap, opacity: number, fade: number): void {
  if (!map.getLayer(EQ_REPLAY_TOWN_LAYER)) return;
  map.setPaintProperty(EQ_REPLAY_TOWN_LAYER, "fill-opacity", townOpacityExpr(opacity * 0.8 * fade));
}

export function setReplayStationOpacity(map: MapboxMap, opacity: number): void {
  if (!map.getLayer(EQ_REPLAY_STATION_LAYER)) return;
  map.setPaintProperty(EQ_REPLAY_STATION_LAYER, "circle-opacity", stationOpacityExpr(opacity * 0.85));
  map.setPaintProperty(
    EQ_REPLAY_STATION_LAYER,
    "circle-stroke-opacity",
    stationOpacityExpr(opacity * 0.55),
  );
}

export interface EpicenterFrame {
  coreRadiusPx: number;
  coreOpacity: number;
  waveRadiusPx: number;
  waveOpacity: number;
  waveWidth: number;
}

/** 震央 + S 波前每幀更新（單一 feature，直接寫數值最省） */
export function setReplayEpicenterFrame(map: MapboxMap, f: EpicenterFrame): void {
  if (map.getLayer(EQ_REPLAY_EPICENTER_LAYER)) {
    map.setPaintProperty(EQ_REPLAY_EPICENTER_LAYER, "circle-radius", f.coreRadiusPx);
    map.setPaintProperty(EQ_REPLAY_EPICENTER_LAYER, "circle-opacity", f.coreOpacity);
    map.setPaintProperty(EQ_REPLAY_EPICENTER_LAYER, "circle-stroke-opacity", f.coreOpacity * 0.9);
  }
  if (map.getLayer(EQ_REPLAY_WAVE_LAYER)) {
    map.setPaintProperty(EQ_REPLAY_WAVE_LAYER, "circle-radius", f.waveRadiusPx);
    map.setPaintProperty(EQ_REPLAY_WAVE_LAYER, "circle-stroke-opacity", f.waveOpacity);
    map.setPaintProperty(EQ_REPLAY_WAVE_LAYER, "circle-stroke-width", f.waveWidth);
  }
}

/**
 * 公尺 → 螢幕 px（Mapbox GL 的 zoom 以 512px tile 定義，
 * 故 equator resolution = 78271.517 m/px @ z0）。
 * S 波前是「真實地理半徑」，但 circle layer 的半徑單位是 px → 每幀換算。
 */
export function metersToPixels(meters: number, lat: number, zoom: number): number {
  const mPerPx = (78271.5169 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return 0;
  return Math.min(4000, meters / mPerPx);
}

// ── 沙灘球 Marker ───────────────────────────────────────────────────

export interface BeachballHandle {
  marker: mapboxgl.Marker;
  /** 內層才是動畫對象：Marker 會自己覆寫外層 element 的 transform（定位用） */
  inner: HTMLDivElement;
}

/** 用 beachball.ts 自繪 SVG（tecdc 的 beachball_url 無 SLA，見 handoff §6-3） */
export function createBeachballMarker(
  map: MapboxMap,
  lngLat: [number, number],
  mechanism: FocalMechanism,
  size = 54,
): BeachballHandle {
  const element = document.createElement("div");
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.pointerEvents = "none";

  const inner = document.createElement("div");
  inner.style.width = "100%";
  inner.style.height = "100%";
  inner.style.opacity = "0";
  inner.style.transformOrigin = "center";
  inner.style.willChange = "transform, opacity";
  inner.style.filter = "drop-shadow(0 2px 6px rgba(0,0,0,0.55))";
  inner.innerHTML = beachballSvg(mechanism, {
    size,
    fillColor: "#1e293b",
    bgColor: "#f8fafc",
    strokeColor: "#0f172a",
  });
  element.appendChild(inner);

  const marker = new mapboxgl.Marker({ element, anchor: "center" })
    .setLngLat(lngLat)
    .addTo(map);
  return { marker, inner };
}

/** 彈出動畫：opacity 0→1（再乘圖層 opacity）、scale 0.4→1.15→1（純 style，不進 React） */
export function updateBeachball(handle: BeachballHandle, progress: number, opacity: number): void {
  const p = Math.max(0, Math.min(1, progress));
  const overshoot = 1 + 0.25 * Math.sin(Math.PI * Math.min(1, p * 1.4));
  const scale = p === 0 ? 0.4 : 0.4 + 0.6 * p * overshoot;
  handle.inner.style.opacity = String(p * opacity);
  handle.inner.style.transform = `scale(${scale.toFixed(3)})`;
}

export function removeBeachballMarker(handle: BeachballHandle | null): void {
  handle?.marker.remove();
}
