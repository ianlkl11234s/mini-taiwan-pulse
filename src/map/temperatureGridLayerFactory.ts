import type { Map as MapboxMap, ExpressionSpecification, FillLayerSpecification } from "mapbox-gl";
import type { TemperatureGridData } from "../data/temperatureLoader";
import { TEMPERATURE_GRID_BANDS } from "../data/temperatureGridTypes";

/**
 * 溫度網格 2D（temperatureGrid）— Mapbox 原生 fill 層。
 *
 * 與 3D 溫度波（temperatureWave / TemperatureWaveScene）共用同一份 RPC 資料，
 * 差別只在呈現：這裡把每個陸地 cell 畫成 0.03° 方格，用 11 級 step 色階染色。
 *
 * ⚠️ 幾何只建一次（landIndices 不隨時間變），時間變化一律只走
 * `map.setFeatureState`，絕不重新 setData —— 8k 級 polygon 每幀重建會直接卡死。
 *
 * 幾何對齊：TemperatureWaveScene.computeMercatorPositions() 的 vertex 落在
 * `(bottomLeftLon + col*res, bottomLeftLat + row*res)`，flat index = `row * cols + col`。
 * 因此 2D 方格以「同一個格點」為中心 ±res/2 展開，色塊中心即 3D 波的取樣點。
 */

export const TEMPERATURE_GRID_SOURCE_ID = "temperature-grid-src";
export const TEMPERATURE_GRID_FILL_LAYER_ID = "temperature-grid-fill";

/** feature-state 未設定時的哨兵值（冷於任何實際觀測值） */
const NO_DATA = -999;
const NO_DATA_THRESHOLD = -900;

const TEMP_EXPR: ExpressionSpecification = [
  "coalesce",
  ["feature-state", "temp"],
  NO_DATA,
] as unknown as ExpressionSpecification;

/** ["step", temp, color0, break1, color1, ...] — 由 TEMPERATURE_GRID_BANDS 展開 */
function buildColorExpr(): ExpressionSpecification {
  const step: unknown[] = ["step", TEMP_EXPR, TEMPERATURE_GRID_BANDS[0]!.color];
  for (let i = 1; i < TEMPERATURE_GRID_BANDS.length; i++) {
    const band = TEMPERATURE_GRID_BANDS[i]!;
    step.push(band.min, band.color);
  }
  // feature-state 尚未設定（NO_DATA）→ 中性灰，避免首幀套用前閃出最冷色
  return [
    "case",
    ["<", TEMP_EXPR, NO_DATA_THRESHOLD],
    "#4a4a4a",
    step,
  ] as unknown as ExpressionSpecification;
}

/** 未上色的 cell 直接透明，避免資料到位前整片灰色閃一下 */
function buildOpacityExpr(opacity: number): ExpressionSpecification {
  return [
    "case",
    ["<", TEMP_EXPR, NO_DATA_THRESHOLD],
    0,
    opacity,
  ] as unknown as ExpressionSpecification;
}

/** 底圖之上、地名標籤之下 */
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

/**
 * landIndices → 每個陸地 cell 一個 0.03° 方形 Polygon。
 * feature id = flat grid index（供 setFeatureState 定位）。
 */
export function temperatureGridToGeoJSON(data: TemperatureGridData): GeoJSON.FeatureCollection {
  const { cols, bottomLeftLon, bottomLeftLat, resolutionDeg } = data.metadata;
  const half = resolutionDeg / 2;

  const features: GeoJSON.Feature[] = data.landIndices.map((idx) => {
    const row = Math.floor(idx / cols);
    const col = idx - row * cols;
    const lng = bottomLeftLon + col * resolutionDeg;
    const lat = bottomLeftLat + row * resolutionDeg;
    const w = lng - half;
    const e = lng + half;
    const s = lat - half;
    const n = lat + half;
    return {
      type: "Feature" as const,
      id: idx,
      properties: { idx, lng, lat },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

/**
 * 確保 source + fill layer 存在（idempotent，底圖切換後可重呼）。
 * 回傳 layer 是否就緒。
 */
export function ensureTemperatureGridLayer(map: MapboxMap, opacity: number): boolean {
  if (!map.getSource(TEMPERATURE_GRID_SOURCE_ID)) {
    map.addSource(TEMPERATURE_GRID_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) {
    map.addLayer(
      {
        id: TEMPERATURE_GRID_FILL_LAYER_ID,
        type: "fill",
        source: TEMPERATURE_GRID_SOURCE_ID,
        layout: { visibility: "none" },
        paint: {
          "fill-color": buildColorExpr(),
          "fill-opacity": buildOpacityExpr(opacity),
          // 相鄰格點連續鋪滿，開 antialias 會在格線留白邊
          "fill-antialias": false,
        },
      } as FillLayerSpecification,
      firstSymbolLayerId(map),
    );
  }
  return !!map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID);
}

export function setTemperatureGridData(map: MapboxMap, geojson: GeoJSON.FeatureCollection): void {
  const source = map.getSource(TEMPERATURE_GRID_SOURCE_ID);
  if (!source || source.type !== "geojson") return;
  source.setData(geojson);
}

export function setTemperatureGridVisible(map: MapboxMap, visible: boolean): void {
  if (!map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) return;
  map.setLayoutProperty(
    TEMPERATURE_GRID_FILL_LAYER_ID,
    "visibility",
    visible ? "visible" : "none",
  );
}

export function setTemperatureGridOpacity(map: MapboxMap, opacity: number): void {
  if (!map.getLayer(TEMPERATURE_GRID_FILL_LAYER_ID)) return;
  map.setPaintProperty(TEMPERATURE_GRID_FILL_LAYER_ID, "fill-opacity", buildOpacityExpr(opacity));
}

// ── 最近一次套用的時間（popup 顯示「這個溫度是哪一刻的」）──
// feature-state 只寫有變動的 cell，把時間塞進每個 cell 會讓沒變動的 cell 時間過期，
// 所以時間存 module 層、由 hook 每次 flush 更新，popup 讀這裡。
let lastAppliedTime = 0;

export function setTemperatureGridFrameTime(unixSec: number): void {
  lastAppliedTime = unixSec;
}

/** 最近一次 feature-state flush 對應的時間（unix 秒）；0 = 尚未套用 */
export function getTemperatureGridFrameTime(): number {
  return lastAppliedTime;
}
