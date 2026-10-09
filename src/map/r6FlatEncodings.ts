/**
 * R6 段 2（2026-10-06）：「數值只畫在立體裡」的圖層新做的 Mapbox 平面版編碼。
 * 地圖 paint 與圖例共用這裡的常數（map-layers.md §4 LG-1／LG-5：色號與大小同源）。
 * 純模組：不 import loader（避免 overlayRegistry 牽進 Supabase client）。
 *
 * - 機組即時出力：大小＝出力 MW（面積 ∝ 出力），色＝燃料（FUEL_COLORS，hook 寫進 feature.color）
 * - 水庫即時水情：色＝警示等級（與 3D 水位計同色）、大小＝有效容量（立方根，同 3D 外殼），蓄水率 % 文字標籤
 * 兩者都是 P-1 的 B 類（資料驅動半徑）：固定 px、不隨縮放，再乘大小滑桿。
 */

// ── 機組即時出力 ──────────────────────────────────────────────────

/** 0 MW → rMin、≥ refMw → rMax（px） */
export const POWER_OUTPUT_RADIUS = { rMin: 3, rMax: 20, refMw: 4000 } as const;
/** 圖例 LG-5 的三個參考出力（MW） */
export const POWER_OUTPUT_LEGEND_MW = [100, 1000, 3000] as const;

export function powerOutputRadius(mw: number | null | undefined, scale = 1): number {
  const { rMin, rMax, refMw } = POWER_OUTPUT_RADIUS;
  const t = Math.sqrt(Math.min(1, Math.max(0, mw ?? 0) / refMw));
  return (rMin + (rMax - rMin) * t) * scale;
}

/** 同 powerOutputRadius 的 Mapbox 表達式（讀 feature 的 output_mw；不讀 zoom） */
export function powerOutputRadiusExpr(scale = 1): unknown[] {
  const { rMin, rMax, refMw } = POWER_OUTPUT_RADIUS;
  return [
    "interpolate", ["linear"], ["sqrt", ["max", 0, ["coalesce", ["get", "output_mw"], 0]]],
    0, rMin * scale, Math.sqrt(refMw), rMax * scale,
  ];
}

// ── 水庫即時水情 ──────────────────────────────────────────────────

/** 警示等級 → 色（3D 水位計水柱同一份；reservoirStatusLoader 的 ALERT_COLOR_HEX 由此再匯出） */
export const RESERVOIR_ALERT_COLOR_HEX = {
  critical: 0xef4444, // 紅：<15%
  warning: 0xf97316, // 橘：<30%
  normal: 0x22d3ee, // 青：30~90%
  high: 0x22c55e, // 綠：>90% 滿水
} as const;
/** 平面版另有「無資料」：蓄水率缺值不畫成正常（GIS 鐵則：缺值不變成正常） */
export const RESERVOIR_NODATA_COLOR = "#9ca3af";

export type ReservoirAlertLevel = keyof typeof RESERVOIR_ALERT_COLOR_HEX;
export type ReservoirFlatAlert = ReservoirAlertLevel | "nodata";

/** 門檻與 view 公式一致（critical <15、warning <30、high >90） */
export function reservoirAlertOf(pct: number): ReservoirAlertLevel {
  if (pct < 15) return "critical";
  if (pct < 30) return "warning";
  if (pct > 90) return "high";
  return "normal";
}

export function reservoirFlatAlert(pct: number | null | undefined): ReservoirFlatAlert {
  return pct == null || !Number.isFinite(pct) ? "nodata" : reservoirAlertOf(pct);
}

export function reservoirAlertCss(alert: ReservoirFlatAlert): string {
  if (alert === "nodata") return RESERVOIR_NODATA_COLOR;
  return `#${RESERVOIR_ALERT_COLOR_HEX[alert].toString(16).padStart(6, "0")}`;
}

/** 圖例列（順序＝由低到高，最後是無資料） */
export const RESERVOIR_ALERT_LEGEND: ReadonlyArray<{ key: ReservoirFlatAlert; label: string }> = [
  { key: "critical", label: "嚴重偏低（< 15%）" },
  { key: "warning", label: "偏低（15–30%）" },
  { key: "normal", label: "正常（30–90%）" },
  { key: "high", label: "滿水（> 90%）" },
  { key: "nodata", label: "無資料" },
];

/** 平面圓點色：讀 feature 的 alert（hook 以 reservoirFlatAlert 寫入） */
export function reservoirAlertColorExpr(): unknown[] {
  const levels = Object.keys(RESERVOIR_ALERT_COLOR_HEX) as ReservoirAlertLevel[];
  return ["match", ["get", "alert"], ...levels.flatMap((k) => [k, reservoirAlertCss(k)]), RESERVOIR_NODATA_COLOR];
}

/**
 * 水庫水系色（2026-10-09 決議）：水庫面 fill（overlayRegistry water-reservoir-poly）與
 * 圖例「有效容量」空心圈的描邊共用——大小級距用水庫自己的藍，不再借中性灰（灰＝無資料）。
 */
export const RESERVOIR_WATER_COLOR = { dark: "#06b6d4", light: "#0891b2" } as const;

/** 有效容量（萬 m³）的立方根 → 半徑；cbrtRef ≈ 46,656 萬 m³（曾文水庫級）以上封頂 */
export const RESERVOIR_CAPACITY_RADIUS = { rMin: 4, rMax: 16, cbrtRef: 36 } as const;
/** 圖例 LG-5 的三個參考容量（萬 m³） */
export const RESERVOIR_CAPACITY_LEGEND_WAN = [1_000, 10_000, 40_000] as const;

export function reservoirCapacityRadius(wan: number | null | undefined, scale = 1): number {
  const { rMin, rMax, cbrtRef } = RESERVOIR_CAPACITY_RADIUS;
  const t = Math.min(1, Math.cbrt(Math.max(0, wan ?? 0)) / cbrtRef);
  return (rMin + (rMax - rMin) * t) * scale;
}

export function reservoirCapacityRadiusExpr(scale = 1): unknown[] {
  const { rMin, rMax, cbrtRef } = RESERVOIR_CAPACITY_RADIUS;
  return [
    "interpolate", ["linear"], ["^", ["max", 0, ["coalesce", ["get", "effective_capacity_wan"], 0]], 1 / 3],
    0, rMin * scale, cbrtRef, rMax * scale,
  ];
}

/** 蓄水率標籤文字（缺值不標） */
export function reservoirPctLabelExpr(): unknown[] {
  return [
    "case", ["==", ["typeof", ["get", "storage_ratio_pct"]], "number"],
    ["concat", ["to-string", ["round", ["get", "storage_ratio_pct"]]], "%"],
    "",
  ];
}
