/**
 * R6 段 3：移動物件的 Mapbox 平面模式（台鐵／高鐵列車、垃圾車 GPS）。
 *
 * 「立體效果」關閉時，同一份資料改用 Mapbox 原生圖層畫（map-layers.md §3.1）：
 *   - 拉遠：circle，點三階（P-1：一般 M 4.5px；垃圾車停車／離線 S 3px，對應立體版 ×0.6）、P-2 底圖色描邊
 *   - 拉近（z ≥ FLAT_ARROW_MIN_ZOOM）：有行進方向的物件改畫方向箭頭 icon（P-5，L 階 13px），依方位角旋轉；
 *     算不出方向（停著）的物件維持圓點
 *   - 不畫拖尾；只有點選的物件畫近段軌跡線
 * 識別色沿用立體版：列車＝train.color（台鐵車種／高鐵／捷運線色），垃圾車＝WASTE_STATUS_COLORS。
 *
 * 本檔只放圖層規格與增刪；每幀資料與節流在 `flatMovingController.ts`。
 */
import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import {
  LINE_OPACITY, POINT_ICON_PX, POINT_OPACITY, lineWidthExpr, mapSeamColor, pointRadius, pointStrokePaint,
} from "./mapStyleScale";

/** 拉近到這個 zoom 起，有方向的物件從圓點換成方向箭頭。 */
export const FLAT_ARROW_MIN_ZOOM = 12;
/** SDF 箭頭 sprite（全站共用一張，顏色由 icon-color 依物件色給）。 */
export const FLAT_ARROW_IMAGE = "r6-flat-moving-arrow";
/** sprite 邊長（實體 px）與 pixelRatio；箭頭本體佔 ARROW_SHAPE_PX，四周留 SDF buffer 給描邊（halo）。 */
const ARROW_SPRITE_PX = 48;
const ARROW_SHAPE_PX = 32;
const ARROW_PIXEL_RATIO = 2;

export type FlatMovingKind = "rail" | "wasteTruck";

export interface FlatMovingIds {
  source: string;
  trailSource: string;
  circle: string;
  arrow: string;
  trail: string;
}

export const FLAT_MOVING_IDS: Readonly<Record<FlatMovingKind, FlatMovingIds>> = {
  rail: {
    source: "rail-flat-trains",
    trailSource: "rail-flat-selected-trail",
    circle: "rail-flat-trains-circle",
    arrow: "rail-flat-trains-arrow",
    trail: "rail-flat-selected-trail-line",
  },
  wasteTruck: {
    source: "waste-truck-flat",
    trailSource: "waste-truck-flat-selected-trail",
    circle: "waste-truck-flat-circle",
    arrow: "waste-truck-flat-arrow",
    trail: "waste-truck-flat-selected-trail-line",
  },
};

/** 平面模式要點選的圖層（圓點＋箭頭）。 */
export const flatMovingPickLayers = (kind: FlatMovingKind): string[] => {
  const ids = FLAT_MOVING_IDS[kind];
  return [ids.circle, ids.arrow];
};

/**
 * feature properties：`key`（點選查回原物件）、`color`、`tier`（S／M）、`alpha`（淡入淡出／過期淡化）、
 * `bearing`（度；算不出時不帶這個屬性 → 拉近仍畫圓點）。
 */
export interface FlatMovingProps {
  key: string;
  color: string;
  tier: "S" | "M";
  alpha: number;
  bearing?: number;
}

/** 有 bearing 的物件在 z ≥ 12 改畫箭頭，圓點透明（仍可點選）。zoom 只出現在頂層 step（Mapbox 規定）。 */
const hideWhenArrow = (value: ExpressionSpecification | number): ExpressionSpecification =>
  ["step", ["zoom"], value, FLAT_ARROW_MIN_ZOOM, ["case", ["has", "bearing"], 0, value]];

/**
 * circle paint。sizeScale＝大小滑桿 ÷ 預設；opacityScale＝透明度滑桿（rail 沒有整層透明度 → 1）。
 * 半徑固定不隨縮放（P-1），描邊 P-2；主體透明度 0.85（P-3，< 1k 點）。
 */
export function flatMovingCirclePaint(isDark: boolean, sizeScale: number, opacityScale: number) {
  const stroke = pointStrokePaint(isDark, opacityScale);
  const fillOpacity = POINT_OPACITY.base * opacityScale;
  return {
    "circle-radius": ["match", ["get", "tier"], "S", pointRadius("S", sizeScale), pointRadius("M", sizeScale)] as ExpressionSpecification,
    "circle-color": ["get", "color"] as ExpressionSpecification,
    "circle-opacity": hideWhenArrow(["*", ["get", "alpha"], fillOpacity]),
    "circle-stroke-color": stroke["circle-stroke-color"],
    "circle-stroke-width": stroke["circle-stroke-width"],
    "circle-stroke-opacity": hideWhenArrow(["*", ["get", "alpha"], stroke["circle-stroke-opacity"]]),
  };
}

/** 箭頭 icon layout：P-5 L 階 13px（9px 看不清方向），固定大小乘大小滑桿；貼地旋轉、不避讓（避免 25Hz 更新時閃爍）。 */
export function flatMovingArrowLayout(sizeScale: number) {
  return {
    "icon-image": FLAT_ARROW_IMAGE,
    "icon-size": (POINT_ICON_PX.L / (ARROW_SHAPE_PX / ARROW_PIXEL_RATIO)) * sizeScale,
    "icon-rotate": ["get", "bearing"] as ExpressionSpecification,
    "icon-rotation-alignment": "map" as const,
    "icon-pitch-alignment": "map" as const,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  };
}

/** 箭頭 paint：色＝物件色；描邊（SDF halo 1px）同 P-2 底圖色。 */
export function flatMovingArrowPaint(isDark: boolean, opacityScale: number) {
  return {
    "icon-color": ["get", "color"] as ExpressionSpecification,
    "icon-opacity": ["*", ["get", "alpha"], POINT_OPACITY.base * opacityScale] as ExpressionSpecification,
    "icon-halo-color": mapSeamColor(isDark),
    "icon-halo-width": 1,
  };
}

/** 點選物件的近段軌跡：L-1 標準線、L-4 標準透明度，顏色同物件。 */
export function flatMovingTrailPaint(opacityScale: number) {
  return {
    "line-color": ["get", "color"] as ExpressionSpecification,
    "line-width": lineWidthExpr("standard") as ExpressionSpecification,
    "line-opacity": LINE_OPACITY.standard * opacityScale,
  };
}

// ── SDF 箭頭 sprite ────────────────────────────────────────

/** 導航箭頭（尖端朝上＝北），單位座標，y 向下。 */
const ARROW_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0.8, 0.9], [0, 0.45], [-0.8, 0.9],
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insidePolygon(px: number, py: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 產生 SDF 箭頭的 RGBA（alpha＝有號距離場，同 Mapbox TinySDF：邊緣 ≈ 0.75、radius 8px）。
 * 純計算、不需 canvas，測試可直接呼叫。
 */
export function buildArrowSdf(size = ARROW_SPRITE_PX, shape = ARROW_SHAPE_PX): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const half = shape / 2;
  const c = size / 2;
  const poly = ARROW_POLYGON.map(([x, y]) => [c + x * half, c + y * half] as const);
  const radius = 8;
  const cutoff = 0.25;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let d = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        d = Math.min(d, distToSegment(px, py, poly[j]![0], poly[j]![1], poly[i]![0], poly[i]![1]));
      }
      const signed = insidePolygon(px, py, poly) ? -d : d;
      const a = Math.round(255 - 255 * (signed / radius + cutoff));
      const o = (y * size + x) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255;
      data[o + 3] = Math.max(0, Math.min(255, a));
    }
  }
  return data;
}

let arrowSdfCache: Uint8Array | null = null;

function ensureArrowImage(map: MapboxMap): void {
  if (map.hasImage(FLAT_ARROW_IMAGE)) return;
  arrowSdfCache ??= buildArrowSdf();
  map.addImage(
    FLAT_ARROW_IMAGE,
    { width: ARROW_SPRITE_PX, height: ARROW_SPRITE_PX, data: arrowSdfCache },
    { sdf: true, pixelRatio: ARROW_PIXEL_RATIO },
  );
}

// ── 增刪與更新 ────────────────────────────────────────────

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface FlatMovingStyle {
  isDark: boolean;
  sizeScale: number;
  opacityScale: number;
}

/** 圖層不在就建（換底圖後 style 會清空，每次更新前都可呼叫）；建在最上層（軌跡線 → 圓點 → 箭頭）。 */
export function ensureFlatMovingLayers(map: MapboxMap, kind: FlatMovingKind, style: FlatMovingStyle): void {
  const ids = FLAT_MOVING_IDS[kind];
  const before = undefined;
  ensureArrowImage(map);
  if (!map.getSource(ids.trailSource)) map.addSource(ids.trailSource, { type: "geojson", data: EMPTY });
  if (!map.getSource(ids.source)) map.addSource(ids.source, { type: "geojson", data: EMPTY });
  if (!map.getLayer(ids.trail)) {
    map.addLayer({
      id: ids.trail, type: "line", source: ids.trailSource,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: flatMovingTrailPaint(style.opacityScale),
    }, before);
  }
  if (!map.getLayer(ids.circle)) {
    map.addLayer({
      id: ids.circle, type: "circle", source: ids.source,
      paint: flatMovingCirclePaint(style.isDark, style.sizeScale, style.opacityScale),
    }, before);
  }
  if (!map.getLayer(ids.arrow)) {
    map.addLayer({
      id: ids.arrow, type: "symbol", source: ids.source, minzoom: FLAT_ARROW_MIN_ZOOM,
      filter: ["has", "bearing"],
      layout: flatMovingArrowLayout(style.sizeScale),
      paint: flatMovingArrowPaint(style.isDark, style.opacityScale),
    }, before);
  }
}

/** 移到最上層（維持軌跡線 → 圓點 → 箭頭的順序）；例：2D 軌道晚於平面列車加入時，列車不能被軌道蓋住。 */
export function raiseFlatMovingLayers(map: MapboxMap, kind: FlatMovingKind): void {
  const ids = FLAT_MOVING_IDS[kind];
  for (const id of [ids.trail, ids.circle, ids.arrow]) if (map.getLayer(id)) map.moveLayer(id);
}

/** 主題／大小／透明度滑桿變動：只改 paint／layout，不重建。 */
export function applyFlatMovingStyle(map: MapboxMap, kind: FlatMovingKind, style: FlatMovingStyle): void {
  const ids = FLAT_MOVING_IDS[kind];
  const set = (layer: string, paint: Record<string, unknown>) => {
    if (!map.getLayer(layer)) return;
    for (const [k, v] of Object.entries(paint)) map.setPaintProperty(layer, k as never, v as never);
  };
  set(ids.circle, flatMovingCirclePaint(style.isDark, style.sizeScale, style.opacityScale));
  set(ids.arrow, flatMovingArrowPaint(style.isDark, style.opacityScale));
  set(ids.trail, flatMovingTrailPaint(style.opacityScale));
  if (map.getLayer(ids.arrow)) map.setLayoutProperty(ids.arrow, "icon-size", flatMovingArrowLayout(style.sizeScale)["icon-size"]);
}

export function setFlatMovingData(
  map: MapboxMap,
  kind: FlatMovingKind,
  points: GeoJSON.FeatureCollection,
  trail: GeoJSON.FeatureCollection | null,
): void {
  const ids = FLAT_MOVING_IDS[kind];
  (map.getSource(ids.source) as GeoJSONSource | undefined)?.setData(points);
  if (trail) (map.getSource(ids.trailSource) as GeoJSONSource | undefined)?.setData(trail);
}

/** 關閉平面模式：移除圖層與 source（立體開或圖層關時不留任何 Mapbox 物件）。 */
export function removeFlatMovingLayers(map: MapboxMap, kind: FlatMovingKind): void {
  const ids = FLAT_MOVING_IDS[kind];
  for (const id of [ids.arrow, ids.circle, ids.trail]) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [ids.source, ids.trailSource]) if (map.getSource(id)) map.removeSource(id);
}

export const EMPTY_FEATURES = EMPTY;
