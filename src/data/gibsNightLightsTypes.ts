// NASA GIBS 衛星夜光（VIIRS Night Lights／Black Marble）：瀏覽器直連上游 WMTS 圖磚，不經我們的 DB／R2。
// 零 import（layerManifest 只能 import 純色票常數檔）。
// 上游實測（2026-11-17）：epsg3857/best、TileMatrixSet GoogleMapsCompatible_Level8（z0–8）、png；
// - VIIRS_Night_Lights：只有 2012-01-01、2016-01-01 兩個時間（RGBA，只有燈光，其餘透明）
// - VIIRS_Black_Marble：只有 2016-01-01（RGB，含藍色地表，不透明）
// 都是「年度合成影像」：只能看、不能量化，也不是逐時開燈 → 不接時間軸，日期固定寫在產品表。

export const GIBS_NIGHT_LIGHTS_LAYER_COLOR = "#fde68a";

export const GIBS_NIGHT_LIGHTS_PRODUCTS = [
  { value: "viirs_2012", label: "2012 夜光", layer: "VIIRS_Night_Lights", date: "2012-01-01" },
  { value: "viirs_2016", label: "2016 夜光", layer: "VIIRS_Night_Lights", date: "2016-01-01" },
  { value: "black_marble_2016", label: "2016 Black Marble", layer: "VIIRS_Black_Marble", date: "2016-01-01" },
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

/** 圖例色帶（示意暗→亮，對齊 VIIRS_Night_Lights 的灰白燈光；影像本身是上游已上色成品，沒有數值通道） */
export const GIBS_NIGHT_LIGHTS_GRADIENT = "linear-gradient(90deg, #111111, #4b4b4b, #9a9a9a, #d9d9d9, #ffffff)";
