/**
 * 地圖圖層視覺數值的單一來源（docs/design-system/map-layers.md §3，2026-09-28 拍板）。
 *
 * 各圖層的 paint 只引用這裡的常數或 helper，不再散寫數字。
 * 拍板代號寫在註解；改值前先改規格檔 §3／§7。
 * 分析結果（viz-library）另有規格，不走本檔。
 */

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
export const HEATMAP = { opacity: 0.8, radius: [12, 20], pointsFromZoom: 10 } as const;

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
