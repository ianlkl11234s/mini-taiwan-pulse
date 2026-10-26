// NASA GIBS 衛星雪覆蓋（NDSI Snow Cover）：瀏覽器直連上游 WMTS 圖磚，不經我們的 DB／R2。
// 零 import（layerManifest 只能 import 純色票常數檔）。
// 上游實測（2026-10-15，taipei-gis-analytics docs/api-platforms/nasa_gibs/status.md）：
// - CORS `*`；z0–8（z9 回 400）→ source maxzoom 8，更大 zoom 靠 overzoom
// - URL 是 {z}/{y}/{x}（列在欄前，和一般 XYZ 相反）
// - 日期在範圍外（未來、2000-02-24 前）回 404；MODIS 有幾段缺日（GetCapabilities 的 Dimension 分段）
// - 色表 MODIS_NDSI_Snow_Cover（兩個 layer 共用）：0 與 200–255 旗標（缺測、無判定、夜間、內陸水、海洋、雲、飽和）全透明

export const GIBS_SNOW_LAYER_COLOR = "#7dd3fc";

export const GIBS_ATTRIBUTION =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";
export const GIBS_SOURCE_URL = "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api";

/**
 * `gaps`：上游 GetCapabilities Dimension 分段之間的缺日（含頭尾，YYYY-MM-DD；2026-10-27 取得）。
 * 缺日請求圖磚會回 404 → 視為未涵蓋，不標 shown。上游新增缺日時要補在這裡。
 */
export const GIBS_SNOW_PRODUCTS = [
  {
    value: "modis_terra", label: "MODIS Terra（2000 起）", layer: "MODIS_Terra_NDSI_Snow_Cover", start: "2000-02-24",
    gaps: [
      ["2000-08-07", "2000-08-17"], ["2001-06-16", "2001-07-02"], ["2002-03-20", "2002-03-27"], ["2003-12-17", "2003-12-23"],
      ["2008-12-21", "2008-12-22"], ["2016-02-19", "2016-02-26"], ["2022-10-11", "2022-10-22"],
    ],
  },
  {
    value: "viirs_noaa20", label: "VIIRS NOAA-20（2018 起）", layer: "VIIRS_NOAA20_NDSI_Snow_Cover", start: "2018-01-05",
    gaps: [["2018-02-23", "2018-02-23"]],
  },
] as const;
export type GibsSnowProduct = (typeof GIBS_SNOW_PRODUCTS)[number];

export function gibsSnowProduct(idx: number | undefined): GibsSnowProduct {
  return GIBS_SNOW_PRODUCTS[idx ?? 0] ?? GIBS_SNOW_PRODUCTS[0];
}

/** GoogleMapsCompatible_Level8：上游最大 zoom */
export const GIBS_MAX_ZOOM = 8;

/** mapbox tiles 模板：{z}/{y}/{x} 照 GIBS 的順序放（mapbox 依佔位名稱代換，位置不影響） */
export function gibsSnowTileUrl(layer: string, date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}

/** 時間軸時刻 → GIBS 日期（UTC 日；GIBS 每日一幅，以 UTC 日界） */
export function gibsUtcDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

/** 日期是否在上游範圍內：早於 layer 起始日、晚於今天（UTC）或落在已知缺日段 → 上游 404，視為未涵蓋 */
export function gibsDateInRange(date: string, product: GibsSnowProduct, nowMs: number): boolean {
  if (date < product.start || date > gibsUtcDate(nowMs / 1000)) return false;
  return !product.gaps.some(([from, to]) => date >= from && date <= to);
}

/** 圖例色帶：取自 GIBS 色表 MODIS_NDSI_Snow_Cover（NDSI 1–100） */
export const GIBS_NDSI_STOPS = [
  { value: 1, color: "rgb(240, 240, 128)" },
  { value: 30, color: "rgb(240, 210, 137)" },
  { value: 50, color: "rgb(240, 180, 137)" },
  { value: 70, color: "rgb(240, 150, 137)" },
  { value: 90, color: "rgb(240, 128, 129)" },
  { value: 100, color: "rgb(255, 0, 0)" },
] as const;
