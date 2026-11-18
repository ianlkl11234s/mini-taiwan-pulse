// NASA GIBS 衛星夜光（VIIRS Night Lights／Black Marble）：瀏覽器直連上游 WMTS 圖磚，不經我們的 DB／R2。
// 零 import（layerManifest 只能 import 純色票常數檔）。
// 上游實測（2026-11-17）：epsg3857/best、TileMatrixSet GoogleMapsCompatible_Level8（z0–8）、png；
// - VIIRS_Night_Lights：只有 2012-01-01、2016-01-01 兩個時間（RGBA，只有燈光，其餘透明）
// - VIIRS_Black_Marble：只有 2016-01-01（RGB，含藍色地表，不透明）
// 都是「年度合成影像」：只能看、不能量化，也不是逐時開燈 → 不接時間軸，日期固定寫在產品表。

export const GIBS_NIGHT_LIGHTS_LAYER_COLOR = "#fde68a";

export const GIBS_NIGHT_LIGHTS_PRODUCTS = [
  { value: "viirs_2012", label: "2012 夜光", layer: "VIIRS_Night_Lights", date: "2012-01-01", tint: true },
  { value: "viirs_2016", label: "2016 夜光", layer: "VIIRS_Night_Lights", date: "2016-01-01", tint: true },
  { value: "black_marble_2016", label: "2016 Black Marble", layer: "VIIRS_Black_Marble", date: "2016-01-01", tint: false },
] as const;
export type GibsNightLightsProduct = (typeof GIBS_NIGHT_LIGHTS_PRODUCTS)[number];

/** 預設 2016 夜光（只有燈光、透明背景，疊其他圖層最清楚） */
export const GIBS_NIGHT_LIGHTS_DEFAULT_IDX = 1;

export function gibsNightLightsProduct(idx: number | undefined): GibsNightLightsProduct {
  return GIBS_NIGHT_LIGHTS_PRODUCTS[idx ?? GIBS_NIGHT_LIGHTS_DEFAULT_IDX] ?? GIBS_NIGHT_LIGHTS_PRODUCTS[GIBS_NIGHT_LIGHTS_DEFAULT_IDX];
}

/** mapbox tiles 模板：GIBS 是 {z}/{y}/{x}（列在欄前） */
export function gibsNightLightsTileUrl(product: GibsNightLightsProduct): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${product.layer}/default/${product.date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}

/**
 * 燈光色（只套在 VIIRS_Night_Lights，Black Marble 保留上游原色）：
 * 上游是灰階亮度（VIIRS 日夜波段是全色態、沒有顏色資訊），這裡用 raster-color 把亮度映成
 * 「暗處鈉燈琥珀 → 亮處暖白」的示意色，讓它看起來像燈光；顏色不代表各地實際燈種。
 * 停點：[亮度 0–1, 顏色]；0 透明。
 */
export const GIBS_NIGHT_LIGHTS_LAMP_STOPS: readonly (readonly [number, string])[] = [
  [0, "rgba(0, 0, 0, 0)"],
  [0.06, "rgba(122, 52, 8, 0.55)"],
  [0.25, "#e8781e"],
  [0.5, "#ffb347"],
  [0.75, "#ffdc96"],
  [1, "#fff7e6"],
];

/** 圖例色帶（與 GIBS_NIGHT_LIGHTS_LAMP_STOPS 同色；示意暗→亮，影像本身沒有數值通道） */
export const GIBS_NIGHT_LIGHTS_GRADIENT = `linear-gradient(90deg, ${GIBS_NIGHT_LIGHTS_LAMP_STOPS.slice(1).map(([v, c]) => `${c} ${Math.round(v * 100)}%`).join(", ")})`;
