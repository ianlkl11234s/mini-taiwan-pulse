/**
 * 中研院人社中心 GIS 專題中心「臺灣百年歷史地圖」WMTS（GoogleMapsCompatible，可直接當 XYZ）。
 * 外部圖磚直連、已烘好的掃描圖，沒有 feature 可點。授權 CC BY-NC。
 * 年代清單順序＝select 選項順序＝encode 索引；預設第一個。
 */
export interface HistoricalMapEra {
  value: string;
  /** WMTS 層名 */
  layer: string;
  ext: "jpg" | "png";
  /** 選單與圖例標題（zh） */
  label: string;
  /** [west, south, east, north]；WMTS Capabilities 宣告的範圍，沒有就不限制 */
  bounds?: [number, number, number, number];
}

const ERAS: readonly [HistoricalMapEra, ...HistoricalMapEra[]] = [
  { value: "jm20k-1904", layer: "JM20K_1904", ext: "jpg", label: "1904 臺灣堡圖（明治版）" },
  { value: "jm20k-1921", layer: "JM20K_1921", ext: "jpg", label: "1921 臺灣堡圖（大正版）" },
  { value: "jm25k-1921", layer: "JM25K_1921", ext: "png", label: "1921 日治二萬五千分一地形圖" },
  { value: "am25k-1944", layer: "AM25K_1944B", ext: "png", label: "1944 美軍航照", bounds: [119.3828649, 21.8314946, 122.0082911, 25.3317016] },
  { value: "amcity-1945", layer: "AMCityPlan_1945", ext: "png", label: "1945 美軍城市地圖" },
  { value: "tm150k-1953", layer: "TM150K_1953", ext: "png", label: "1953 臺糖鐵道網圖", bounds: [119.85060301, 22.33224526, 121.15032016, 25.0798876] },
  { value: "corona-1966", layer: "Taiwan_Corona_1966", ext: "png", label: "1966 Corona 衛星影像", bounds: [119.2531638, 23.2255413, 122.3217775, 25.4716521] },
];
export const HISTORICAL_MAP_ERAS: readonly HistoricalMapEra[] = ERAS;

export const HISTORICAL_MAP_DEFAULT_ERA = ERAS[0].value;
export const HISTORICAL_MAP_MIN_ZOOM = 8;
export const HISTORICAL_MAP_MAX_ZOOM = 18;
export const HISTORICAL_MAP_ATTRIBUTION =
  '<a href="https://gis.sinica.edu.tw/tileserver/wmts" target="_blank" rel="noopener">中央研究院人社中心 GIS 專題中心 臺灣百年歷史地圖（CC BY-NC）</a>';

export function historicalMapEraByIdx(idx: number | undefined): HistoricalMapEra {
  return HISTORICAL_MAP_ERAS[idx ?? 0] ?? ERAS[0];
}

export function historicalMapTileUrl(era: HistoricalMapEra): string {
  return `https://gis.sinica.edu.tw/tileserver/file-exists.php?img=${era.layer}-${era.ext}-{z}-{x}-{y}`;
}
