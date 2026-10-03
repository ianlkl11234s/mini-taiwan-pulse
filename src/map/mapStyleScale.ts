/**
 * 地圖圖層視覺數值的單一來源（docs/design-system/map-layers.md §3，2026-09-28 拍板）。
 *
 * 各圖層的 paint 只引用這裡的常數或 helper，不再散寫數字。
 * 拍板代號寫在註解；改值前先改規格檔 §3／§7。
 * 分析結果（viz-library）另有規格，不走本檔。
 */

import type { ExpressionSpecification } from "mapbox-gl";
import { FONT_CJK } from "../styles/designTokens";

type Theme = "dark" | "light";
const themeOf = (isDark: boolean): Theme => (isDark ? "dark" : "light");

/** 底圖色：點描邊、面細縫、線外框共用（暗 #0a0a14／淡 #ffffff）。 */
export const MAP_SEAM = { dark: "#0a0a14", light: "#ffffff" } as const;
export const mapSeamColor = (isDark: boolean) => MAP_SEAM[themeOf(isDark)];

// ── 點（P-1 B／P-2 A／P-3）────────────────────────────────
/** P-1 B：固定半徑，不隨縮放；乘大小滑桿。 */
export const POINT_RADIUS = { S: 3, M: 4.5, L: 6.5 } as const;
export type PointTier = keyof typeof POINT_RADIUS;
export const pointRadius = (tier: PointTier, sizeScale = 1) => POINT_RADIUS[tier] * sizeScale;

/** P-2 A：描邊 1px，暗深色 0.8／淡白 0.9。 */
export const POINT_STROKE = { width: 1, opacity: { dark: 0.8, light: 0.9 } } as const;
export const pointStrokePaint = (isDark: boolean, opacityFactor = 1) => ({
  "circle-stroke-color": mapSeamColor(isDark),
  "circle-stroke-width": POINT_STROKE.width,
  "circle-stroke-opacity": Math.min(1, POINT_STROKE.opacity[themeOf(isDark)] * opacityFactor),
});

/** P-5：icon 顯示直徑對齊點的直徑（M 9px；形狀在 9px 分不清時用 L 13px），固定不隨縮放。 */
export const POINT_ICON_PX = { M: POINT_RADIUS.M * 2, L: 13 } as const;
/** useSubstationDiamondIcon：32px 方塊、icon-rotate 45°，對角寬 32√2。 */
export const SUBSTATION_ICON_DIAGONAL_PX = 32 * Math.SQRT2;

/** P-3：主體不透明度，依全台點數。 */
export const POINT_OPACITY = { base: 0.85, over1k: 0.8, over10k: 0.75, over100k: 0.6 } as const;

// ── 線（L-1／L-2／L-4／L-5）──────────────────────────────
/** L-1：[z10, z14] 線寬，隨縮放線性插值；乘線寬滑桿。 */
export const LINE_WIDTH = { thin: [0.5, 1], standard: [1, 2], emphasis: [2, 3.5] } as const;
export type LineTier = keyof typeof LINE_WIDTH;
export const lineWidthExpr = (tier: LineTier, widthScale = 1) => {
  const [z10, z14] = LINE_WIDTH[tier];
  return ["interpolate", ["linear"], ["zoom"], 10, z10 * widthScale, 14, z14 * widthScale];
};

/** L-4：線透明度；任何主體線不低於 min。 */
export const LINE_OPACITY = { standard: 0.85, reference: 0.6, grid: 0.4, min: 0.3 } as const;

/** L-2：虛線只有兩種（單位是線寬倍數）。 */
export const LINE_DASH = { general: [2, 2], boundary: [4, 3] } as const;

/** L-5：行政界中性灰。 */
export const BOUNDARY_GRAY = { dark: "#9ca3af", light: "#374151" } as const;

// ── 面（F-1／F-2／F-3／G-3）──────────────────────────────
/** F-1：面透明度四階。 */
export const FILL_OPACITY = { graded: 0.55, coverage: 0.35, background: 0.15, grid: 0.7 } as const;

/**
 * F-2：統計分級面的 1px 底圖色細縫（不綁透明度滑桿）。
 * 沒有數值的面是透明底，底圖色細縫會消失在底圖裡，所以改用行政界中性灰 0.5（2026-09-28 使用者回饋）。
 */
export const GRADED_SEAM = { width: 1, opacity: { dark: 0.6, light: 0.8 }, noValueOpacity: 0.5 } as const;
export const gradedSeamPaint = (isDark: boolean, hasValue: unknown) => {
  const theme = themeOf(isDark);
  return {
    "line-color": ["case", hasValue, mapSeamColor(isDark), BOUNDARY_GRAY[theme]],
    "line-width": GRADED_SEAM.width,
    "line-opacity": ["case", hasValue, GRADED_SEAM.opacity[theme], GRADED_SEAM.noValueOpacity],
  };
};

/**
 * F-2：一般面的外框（獨立 line 子圖層，不用 fill-outline-color）。
 * 覆蓋面＝與面同色 1px 0.8；背景面＝0.5px 行政界中性灰 0.6；網格＝0.5px 底圖色格縫（透明度同 GRADED_SEAM）。
 * 寬度與透明度仍乘該層的線寬／透明度滑桿（以預設值為 1）。
 */
export const FILL_OUTLINE = {
  coverage: { width: 1, opacity: 0.8 },
  background: { width: 0.5, opacity: LINE_OPACITY.reference },
  gridSeamWidth: 0.5,
} as const;

/**
 * F-3 A（viz-library N1）：缺值＝透明底＋45° 細斜線（暗白 35%／淡黑 35%）；
 * 遮蔽（suppressed）＝透明底＋交叉斜線，與缺值區分（statistics-layer-guidelines §2）。
 */
export const MISSING_HATCH = {
  size: 8,
  rgb: { dark: [255, 255, 255], light: [0, 0, 0] },
  alpha: 0.35,
} as const;
export type HatchKind = "missing" | "suppressed";
export const hatchImageId = (kind: HatchKind, isDark: boolean) => `map-hatch-${kind}-${themeOf(isDark)}`;

/** 產生 hatch 圖（RGBA）：missing 單向 45°，suppressed 雙向交叉。 */
export function hatchImageData(kind: HatchKind, isDark: boolean): { width: number; height: number; data: Uint8Array } {
  const size = MISSING_HATCH.size;
  const [r, g, b] = MISSING_HATCH.rgb[themeOf(isDark)];
  const a = Math.round(MISSING_HATCH.alpha * 255);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onDiag = (x + y) % size === 0;
      const onAnti = kind === "suppressed" && (x - y + size) % size === 0;
      if (!onDiag && !onAnti) continue;
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width: size, height: size, data };
}

// ── 熱區（P-4／G-2）──────────────────────────────────────
/**
 * G-2：radius 為 [z10, z14] heatmap-radius px；P-4：出點縮放依全台點數
 * （10k–100k z ≥ 10、> 100k z ≥ 12），熱區畫在出點縮放以下。
 */
export const HEATMAP = {
  opacity: 0.8,
  /** Q6 B：同時開 ≥2 層熱區時，每層熱區透明度再乘這個倍率（只有一層時恢復 1）。 */
  stackedOpacity: 0.7,
  radius: [12, 20],
  pointsFromZoomOver10k: 10,
  pointsFromZoomOver100k: 12,
} as const;

/**
 * P-4：密集點的出點縮放。< 10k 回傳原本的 minzoom（不改）；
 * 原本點已有更高 minzoom 時保留原值，熱區補在它以下（不讓點更早出現）。
 */
export function densePointsFromZoom(pointCount: number, existingMinzoom = 0): number {
  if (pointCount > 100_000) return Math.max(HEATMAP.pointsFromZoomOver100k, existingMinzoom);
  if (pointCount >= 10_000) return Math.max(HEATMAP.pointsFromZoomOver10k, existingMinzoom);
  return existingMinzoom;
}

/**
 * 熱區子圖層的 maxzoom＝出點縮放 + 0.01。Mapbox 在 z ≥ x.5 起改載下一級 tile，
 * 而 tile zoom（例 12）≥ 圖層 maxzoom（12）時整張 tile 不建該圖層的 bucket，
 * 熱區會在 z11.5–12 提早消失（2026-10-02 瀏覽器實測）；多 0.01 讓 z12 tile 仍建 bucket。
 */
export const heatmapMaxzoom = (pointsFromZoom: number) => pointsFromZoom + 0.01;

/** P-3：主體點預設不透明度，依全台點數（作為該層透明度滑桿的預設值）。 */
export function densePointOpacity(pointCount: number): number {
  if (pointCount > 100_000) return POINT_OPACITY.over100k;
  if (pointCount >= 10_000) return POINT_OPACITY.over10k;
  if (pointCount >= 1_000) return POINT_OPACITY.over1k;
  return POINT_OPACITY.base;
}

/**
 * G-2 熱區色：密度 0 透明，其後 7 個密度節點對到色盤的 7 階（`src/map/palettes.ts`，由
 * `state/layerPalette.ts` 依圖層選色與底圖給）；alpha 在低密度淡入 min(1, d×2.2)。
 */
const HEAT_DENSITY_STOPS = [0.05, 0.15, 0.3, 0.45, 0.6, 0.8, 1] as const;

function hexRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

/** 7 階色盤 → `heatmap-color` 表達式。 */
export function heatmapColorExpr(ramp: readonly string[]): unknown[] {
  if (ramp.length !== HEAT_DENSITY_STOPS.length) throw new Error(`heatmap ramp needs ${HEAT_DENSITY_STOPS.length} steps, got ${ramp.length}`);
  return [
    "interpolate", ["linear"], ["heatmap-density"],
    0, hexRgba(ramp[0]!, 0),
    ...HEAT_DENSITY_STOPS.flatMap((d, i) => [d, hexRgba(ramp[i]!, Math.min(1, d * 2.2))]),
  ];
}

/**
 * G-2 熱區 paint（全站共用）。`opacityScale` = 滑桿值 ÷ 該層透明度預設值，
 * 讓同一個透明度滑桿同時控制點與熱區；結果上限 1。
 * radius：z10 12／z14 20（G-2），z4 外插 6。
 * intensity：z12 為 `intensity`，每拉遠一級減半（exponential 2），抵銷拉遠時單位像素點數暴增；
 * `intensity` 依各層資料密度校正（瀏覽器目視：密度 0.5 左右落在城市核心而非整片飽和）。
 * `weight`：點圖層用 opacity 歸零做篩選（multiSelect 遮罩）時，熱區吃不到 circle-opacity，
 * 改傳同一個判斷式轉成的 `["case", <條件>, 1, 0]`，讓熱區與點顯示同一批資料；預設 1。
 * `ramp`：7 階色盤（R7，由 `state/layerPalette.ts` 的解析器給，預設 magma）。
 * `stackFactor`：同時開 ≥2 層熱區時的透明度倍率（`HEATMAP.stackedOpacity`，由解析器給）。
 */
export const heatmapOpacity = (opacityScale = 1, stackFactor = 1) =>
  Math.max(0, Math.min(1, HEATMAP.opacity * opacityScale)) * stackFactor;
export function heatmapPaint(
  opacityScale: number,
  intensity: number,
  weight: unknown,
  ramp: readonly string[],
  stackFactor = 1,
): Record<string, unknown> {
  const [r10, r14] = HEATMAP.radius;
  return {
    "heatmap-weight": weight,
    "heatmap-intensity": ["interpolate", ["exponential", 2], ["zoom"], 4, intensity / 256, 12, intensity],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 10, r10, 14, r14],
    "heatmap-color": heatmapColorExpr(ramp),
    "heatmap-opacity": heatmapOpacity(opacityScale, stackFactor),
  };
}

/** LG-8 圖例漸層（與 heatmapPaint 同一組 7 階，不含 alpha 淡入）。 */
export function rampLegendGradient(ramp: readonly string[]): string {
  return `linear-gradient(90deg, ${ramp.join(", ")})`;
}

// ── 文字（T-1／T-2／T-3）─────────────────────────────────
/** T-1：地圖中文字用系統字（與 UI 同 stack）；英數仍由 text-font 的 DIN Pro 負責。 */
export const MAP_LOCAL_IDEOGRAPH_FONT = FONT_CJK;
export const LABEL = {
  poi: [10, 12],
  badge: [11, 13],
  haloWidth: 1.25,
  minZoom: 13,
  halo: { dark: "rgba(15,23,42,0.92)", light: "rgba(255,255,255,0.94)" },
} as const;

/** G-4：所有 raster 的預設透明度與 slider 範圍。 */
export const RASTER = { opacity: 0.7, sliderMin: 0.3, sliderMax: 1 } as const;
/** F-4：擠出圖層共用視覺常數。高度倍率由各 layer 保留既有基準換算。 */
export const EXTRUSION = {
  opacity: 0.85,
  verticalGradient: true,
  heightMultiplier: 1,
  gridHeightUnit: 100,
  gridHeightBase: 50,
  propertyValueHeightBase: 40,
  youbikeHeightBase: 80,
} as const;

export const poiLabelLayout = () => ({
  "text-size": ["interpolate", ["linear"], ["zoom"], 10, LABEL.poi[0], 14, LABEL.poi[1]] as ExpressionSpecification,
  "text-allow-overlap": false,
});
export const badgeLabelLayout = () => ({
  "text-size": ["interpolate", ["linear"], ["zoom"], 10, LABEL.badge[0], 14, LABEL.badge[1]] as ExpressionSpecification,
  "text-allow-overlap": true,
  "text-ignore-placement": true,
});
export const labelHaloPaint = (isDark: boolean) => ({
  "text-halo-color": LABEL.halo[themeOf(isDark)],
  "text-halo-width": LABEL.haloWidth,
});
