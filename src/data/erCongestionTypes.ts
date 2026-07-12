// 急診壅塞 er_hospital — 著色 SSOT（比照 medicalPOITypes.ts / nuclearLoader.ts 結構）
//
// 共享給：
//   - src/data/erHospitalLoader.ts        — FC feature.properties.level 預算
//   - src/map/overlayRegistry.ts          — er-hospital-circle 的 circle-color match
//   - src/components/LegendPanel.tsx       — ErCongestionLegend 圖例
//   - src/components/featureInfo/medicalPanels.tsx — EmergencyHospitalPanel 當前壅塞燈
//   - src/components/intel/monitor/ERCard.tsx      — 當前壅塞 dot
//
// 主軸指標：wait_general_cnt（等一般病床人數）。
// 分級閾值依 2026-07-10 realtime.er_hospital_status 37 天 history 校準：
//   wait_general p50=17 / p75=31 / p90=49 / max=160
//   → 綠 順暢 ≤15 / 黃 略壅 16–31 / 橙 壅塞 32–49 / 紅 嚴重 >49 / 灰 無資料(null)
//
// 註：wait_icu_cnt>0 由 overlay 畫白色 circle-stroke ring（不改 fill 主色）；
//     inform（Y/N 旗標，語意未證實）只在 popup 顯示原文，不進著色。

export type ErCongestionLevel = "smooth" | "light" | "congested" | "severe" | "nodata";

/** wait_general_cnt 分級上界（含）；> severe 上界即 severe */
export const ER_CONGESTION_THRESHOLDS = {
  smooth: 15,
  light: 31,
  congested: 49,
} as const;

export const ER_LEVEL_COLORS: Record<ErCongestionLevel, string> = {
  smooth: "#22c55e",
  light: "#facc15",
  congested: "#f97316",
  severe: "#ef4444",
  nodata: "#6b7280",
};

export const ER_LEVEL_LABELS: Record<ErCongestionLevel, string> = {
  smooth: "順暢",
  light: "略壅",
  congested: "壅塞",
  severe: "嚴重",
  nodata: "無資料",
};

/** 主軸 wait_general_cnt → 壅塞分級 */
export function classifyErCongestion(waitGeneral: number | null | undefined): ErCongestionLevel {
  if (waitGeneral == null) return "nodata";
  if (waitGeneral <= ER_CONGESTION_THRESHOLDS.smooth) return "smooth";
  if (waitGeneral <= ER_CONGESTION_THRESHOLDS.light) return "light";
  if (waitGeneral <= ER_CONGESTION_THRESHOLDS.congested) return "congested";
  return "severe";
}

export function erCongestionColor(waitGeneral: number | null | undefined): string {
  return ER_LEVEL_COLORS[classifyErCongestion(waitGeneral)];
}
