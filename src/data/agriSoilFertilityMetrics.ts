// 土壤肥力 250m 網格 — 6 種著色 metric 的單一資料源
//
// 預設 metric = "health"（pH + OM 綜合 3 級健康指標），dropdown 可切到 5 個原始指標。
//
// 共享給：
//   - src/map/agricultureLayerFactory.ts — fill-color paint expression
//   - src/components/LegendPanel.tsx — SoilFertilityLegend
//   - src/components/FeatureInfoPanel.tsx — 數值評等註解（待加）
//
// 設計原則：
// 1. 所有 metric 都把 0 視為「無資料」→ 灰色 #616161
//    (CEC/M3_P/M3_K 很多 grid 沒測，全標為 0；強制視為缺值，避免誤導)
// 2. health 用 pH + OM 兩項全網格皆有測 → 不會大面積灰
// 3. 色帶設計：紅→黃→綠 = 不適→普通→適宜；紫 = 鹼性（pH 專屬）；橘 = 過量（P/K）

export type SoilFertilityMetric = "health" | "pH" | "OM" | "CEC" | "M3_P" | "M3_K";

export interface MetricMeta {
  id: SoilFertilityMetric;
  label: string;
  unit?: string;
  /** Mapbox `case` / `interpolate` expression for fill-color */
  paintExpr: unknown[];
  /** 圖例：分級顯示 */
  legendKind: "categorical" | "gradient";
  legendStops: { color: string; label: string }[];
  /** popup 顯示用：把數值轉成等級文字（如 pH 6.23 → "中性"） */
  classify: (v: number | null) => { label: string; color: string } | null;
}

const GREY = "#616161";

// ── Helpers for classify() ────────────────────────────────────────────────

const phClassify = (v: number | null) => {
  if (v == null || v === 0) return null;
  if (v < 4.5) return { label: "極強酸", color: "#7f1d1d" };
  if (v < 5.5) return { label: "強酸", color: "#c62828" };
  if (v < 6.5) return { label: "微酸", color: "#fdd835" };
  if (v < 7.5) return { label: "中性", color: "#1b5e20" };
  if (v < 8.5) return { label: "微鹼", color: "#a855f7" };
  return { label: "強鹼", color: "#7e22ce" };
};

const omClassify = (v: number | null) => {
  if (v == null || v === 0) return null;
  if (v < 1.5) return { label: "低", color: "#c62828" };
  if (v < 3) return { label: "中等", color: "#fdd835" };
  if (v < 5) return { label: "高", color: "#1b5e20" };
  return { label: "非常高", color: "#064e1a" };
};

const cecClassify = (v: number | null) => {
  if (v == null || v === 0) return null;
  if (v < 5) return { label: "低（沙質）", color: "#c62828" };
  if (v < 15) return { label: "中", color: "#fdd835" };
  if (v < 25) return { label: "高", color: "#1b5e20" };
  return { label: "非常高（重黏土）", color: "#064e1a" };
};

const m3pClassify = (v: number | null) => {
  if (v == null || v === 0) return null;
  if (v < 15) return { label: "缺乏", color: "#c62828" };
  if (v < 30) return { label: "中等", color: "#fdd835" };
  if (v < 60) return { label: "充足", color: "#1b5e20" };
  return { label: "過量", color: "#f97316" };
};

const m3kClassify = (v: number | null) => {
  if (v == null || v === 0) return null;
  if (v < 60) return { label: "缺乏", color: "#c62828" };
  if (v < 120) return { label: "中等", color: "#fdd835" };
  if (v < 200) return { label: "充足", color: "#1b5e20" };
  return { label: "過量", color: "#f97316" };
};

// ── Metric definitions ────────────────────────────────────────────────────

export const SOIL_FERTILITY_METRICS: Record<SoilFertilityMetric, MetricMeta> = {
  // 預設：pH + OM 綜合 3 級
  health: {
    id: "health",
    label: "健康度（綜合）",
    legendKind: "categorical",
    legendStops: [
      { color: "#1b5e20", label: "良好 (pH 適中 + OM > 2.5%)" },
      { color: "#fdd835", label: "一般" },
      { color: "#c62828", label: "需改善 (極酸/鹼 或 OM < 1.5%)" },
      { color: GREY,      label: "無資料" },
    ],
    paintExpr: [
      "case",
      // 無資料：pH 或 OM 為 0
      ["any",
        ["==", ["coalesce", ["get", "pH_H2O"], 0], 0],
        ["==", ["coalesce", ["get", "OM_OMU"], 0], 0]
      ], GREY,
      // 良好：pH 5.5-7.5 且 OM > 2.5
      ["all",
        [">=", ["get", "pH_H2O"], 5.5],
        ["<=", ["get", "pH_H2O"], 7.5],
        [">", ["get", "OM_OMU"], 2.5]
      ], "#1b5e20",
      // 一般：pH 5.5-7.5 且 OM ≥ 1.5；或 pH 邊緣可改善區間 (5.0-5.5 / 7.5-8.0)
      ["any",
        ["all",
          [">=", ["get", "pH_H2O"], 5.5],
          ["<=", ["get", "pH_H2O"], 7.5],
          [">=", ["get", "OM_OMU"], 1.5]
        ],
        ["all",
          [">=", ["get", "pH_H2O"], 5.0],
          ["<", ["get", "pH_H2O"], 5.5]
        ],
        ["all",
          [">", ["get", "pH_H2O"], 7.5],
          ["<=", ["get", "pH_H2O"], 8.0]
        ]
      ], "#fdd835",
      // 需改善：fallback (pH < 5 / > 8 或 OM < 1.5)
      "#c62828"
    ],
    classify: (v) => {
      // health 不適合單值 classify（要 pH+OM 一起）；保留 null
      void v;
      return null;
    },
  },
  pH: {
    id: "pH",
    label: "pH (H2O)",
    legendKind: "gradient",
    legendStops: [
      { color: "#7f1d1d", label: "< 4.5 極強酸" },
      { color: "#c62828", label: "4.5-5.5 強酸" },
      { color: "#fdd835", label: "5.5-6.5 微酸 ⭐" },
      { color: "#1b5e20", label: "6.5-7.5 中性 ⭐" },
      { color: "#a855f7", label: "7.5-8.5 微鹼" },
      { color: GREY,      label: "無資料 (0)" },
    ],
    paintExpr: [
      "case",
      ["==", ["coalesce", ["get", "pH_H2O"], 0], 0], GREY,
      [
        "interpolate", ["linear"], ["get", "pH_H2O"],
        4.0, "#7f1d1d",
        4.5, "#c62828",
        5.5, "#fdd835",
        6.5, "#1b5e20",
        7.5, "#1b5e20",
        8.5, "#a855f7",
      ]
    ],
    classify: phClassify,
  },
  OM: {
    id: "OM",
    label: "有機質 OM",
    unit: "%",
    legendKind: "gradient",
    legendStops: [
      { color: "#c62828", label: "< 1.5% 低" },
      { color: "#fdd835", label: "1.5-3% 中等" },
      { color: "#1b5e20", label: "3-5% 高 ⭐" },
      { color: "#064e1a", label: "> 5% 非常高" },
      { color: GREY,      label: "無資料 (0)" },
    ],
    paintExpr: [
      "case",
      ["==", ["coalesce", ["get", "OM_OMU"], 0], 0], GREY,
      [
        "interpolate", ["linear"], ["get", "OM_OMU"],
        0.5, "#c62828",
        1.5, "#fdd835",
        3.0, "#1b5e20",
        5.0, "#064e1a",
      ]
    ],
    classify: omClassify,
  },
  CEC: {
    id: "CEC",
    label: "陽離子交換量 CEC",
    unit: "cmol(+)/kg",
    legendKind: "gradient",
    legendStops: [
      { color: "#c62828", label: "< 5 低（沙質）" },
      { color: "#fdd835", label: "5-15 中" },
      { color: "#1b5e20", label: "15-25 高" },
      { color: "#064e1a", label: "> 25 非常高" },
      { color: GREY,      label: "無資料 (0)" },
    ],
    paintExpr: [
      "case",
      ["==", ["coalesce", ["get", "CEC"], 0], 0], GREY,
      [
        "interpolate", ["linear"], ["get", "CEC"],
        2, "#c62828",
        5, "#fdd835",
        15, "#1b5e20",
        25, "#064e1a",
      ]
    ],
    classify: cecClassify,
  },
  M3_P: {
    id: "M3_P",
    label: "Mehlich-3 磷",
    unit: "mg/kg",
    legendKind: "gradient",
    legendStops: [
      { color: "#c62828", label: "< 15 缺乏" },
      { color: "#fdd835", label: "15-30 中等" },
      { color: "#1b5e20", label: "30-60 充足 ⭐" },
      { color: "#f97316", label: "> 60 過量" },
      { color: GREY,      label: "無資料 (0)" },
    ],
    paintExpr: [
      "case",
      ["==", ["coalesce", ["get", "M3_P"], 0], 0], GREY,
      [
        "interpolate", ["linear"], ["get", "M3_P"],
        5, "#c62828",
        15, "#fdd835",
        30, "#1b5e20",
        60, "#1b5e20",
        100, "#f97316",
      ]
    ],
    classify: m3pClassify,
  },
  M3_K: {
    id: "M3_K",
    label: "Mehlich-3 鉀",
    unit: "mg/kg",
    legendKind: "gradient",
    legendStops: [
      { color: "#c62828", label: "< 60 缺乏" },
      { color: "#fdd835", label: "60-120 中等" },
      { color: "#1b5e20", label: "120-200 充足 ⭐" },
      { color: "#f97316", label: "> 200 過量" },
      { color: GREY,      label: "無資料 (0)" },
    ],
    paintExpr: [
      "case",
      ["==", ["coalesce", ["get", "M3_K"], 0], 0], GREY,
      [
        "interpolate", ["linear"], ["get", "M3_K"],
        20, "#c62828",
        60, "#fdd835",
        120, "#1b5e20",
        200, "#1b5e20",
        300, "#f97316",
      ]
    ],
    classify: m3kClassify,
  },
};

export const SOIL_FERTILITY_METRIC_OPTIONS: { value: SoilFertilityMetric; label: string }[] =
  (Object.keys(SOIL_FERTILITY_METRICS) as SoilFertilityMetric[]).map((id) => ({
    value: id,
    label: SOIL_FERTILITY_METRICS[id].label,
  }));
