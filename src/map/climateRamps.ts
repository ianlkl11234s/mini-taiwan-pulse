// 全球氣候粒子色階 — App.tsx（渲染）與 LegendPanel.tsx（圖例）共用同一份，
// 改色階只動這裡，兩邊自動同步。key = speed / speedMax 正規化位置。

/** 風場 10m：速度色階（藍→青→綠→黃→橘→紅→紫紅），對齊 nullschool 語意。 */
export const WIND_FIELD_RAMP: Record<number, string> = {
  0.0: "#4d7fd6",
  0.17: "#40c4c4",
  0.33: "#4fd465",
  0.5: "#d9d049",
  0.67: "#e89b3e",
  0.83: "#e0574a",
  1.0: "#c53a9b",
};

/** 風場 color ramp normalization 上限（m/s）。 */
export const WIND_SPEED_MAX = 30;

/** 海流：深藍→亮藍→青→米黃→橘。 */
export const OCEAN_CURRENTS_RAMP: Record<number, string> = {
  0.0: "#0c4a6e",
  0.3: "#0ea5e9",
  0.6: "#67e8f9",
  0.85: "#fef3c7",
  1.0: "#fb923c",
};

/** 海流 color ramp normalization 上限（m/s）。 */
export const OCEAN_SPEED_MAX = 2.0;

/**
 * 沙塵 AOD 棕色色階 — 與 scripts/preprocess/extract_climate_uv.py 的烤圖
 * stops 同值（PNG 已預烤，此表僅供圖例顯示）。位置為 normalize 後的 t。
 */
export const DUST_BAKE_STOPS: Array<{ t: number; color: string }> = [
  { t: 0.0, color: "rgb(218,197,168)" },
  { t: 0.2, color: "rgb(180,140,90)" },
  { t: 0.45, color: "rgb(132,86,46)" },
  { t: 0.75, color: "rgb(82,46,22)" },
  { t: 1.0, color: "rgb(40,20,10)" },
];

/** Record 色階 → CSS linear-gradient 字串（含 stop 位置，忠實比例）。 */
export function rampToGradient(ramp: Record<number, string>): string {
  const stops = Object.entries(ramp)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])
    .map(([t, c]) => `${c} ${(t * 100).toFixed(0)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
