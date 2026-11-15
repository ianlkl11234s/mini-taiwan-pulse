import type { MapboxGeoJSONFeature, PointLike } from "mapbox-gl";

/**
 * 統計圖層（面量圖／比例圓／點密度）的點擊命中。
 *
 * 面（`<key>-fill`）以「點擊點實際落在哪個多邊形」為準：只查游標那一點。
 * 舊做法整筆用 ±5px 框再取第一筆，低縮放時小行政區只有幾個像素寬，框會同時涵蓋鄰區，
 * 而 Mapbox 回傳順序與「誰包含點擊點」無關 → popup 顯示隔壁的區（VP-5：點大邱中區顯示 달서구）。
 *
 * 比例圓（`<key>-circle`）是點狀符號，保留容錯框好點；圓疊在面上，命中時排在面之前。
 * 點密度的點不進點擊登記（不是實際地點），點區域時由 `-fill`（填色透明）回答。
 */
export const STATISTICS_CLICK_TOLERANCE_PX = 5;

interface QueryableMap {
  queryRenderedFeatures(
    geometry: PointLike | [PointLike, PointLike],
    options: { layers: string[] },
  ): MapboxGeoJSONFeature[];
}

export function queryStatisticsHits(
  map: QueryableMap,
  point: { x: number; y: number },
  layerIds: readonly string[],
): MapboxGeoJSONFeature[] {
  const circles = layerIds.filter((id) => id.endsWith("-circle"));
  const fills = layerIds.filter((id) => !id.endsWith("-circle"));
  const r = STATISTICS_CLICK_TOLERANCE_PX;
  const circleHits = circles.length
    ? map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], { layers: circles })
    : [];
  const fillHits = fills.length ? map.queryRenderedFeatures([point.x, point.y], { layers: fills }) : [];
  return [...circleHits, ...fillHits];
}

/**
 * 一般 GIS 點擊登記（`GIS_LAYERS`）中，命中「小格網面」的 layerType：只查點擊點，不用 ±5px 容錯框。
 * 低縮放時格子只有幾個像素寬，容錯框會同時涵蓋鄰格，Mapbox 回傳順序又與「誰包含點擊點」無關
 * → popup 顯示隔壁那一格（VPB-6：南韓人口六角格拉遠點擊顯示鄰格）。
 */
export const EXACT_POINT_HIT_TYPES: ReadonlySet<string> = new Set([
  "companyIndustryDistribution",
  "companyAgeStructure",
  "factoryDensityGrid",
  "manufacturingCompanyDensityGrid",
  "regulatedFacilityDensityGrid",
  "jpAccommodationDensity",
  "krPopulationH3",
  // 日本醫療圈（純 fill）：z8 點川口一帶卻顯示東京「区西北部」（VP-15）
  "jpMedicalAreasPrimary",
  "jpMedicalAreasSecondary",
  "jpMedicalAreasTertiary",
  // 同型小格網（登記的 layer 全是 fill／fill-extrusion，或格線 outline）：
  // H3 人口／指標／社經／空間經濟／YouBike、日本 1 km 網格、加拿大人口 H3、都市型態、溫度、交通可及、噪音捕捉格網
  "popCount",
  "h3Population",
  "indicators",
  "socioeconomic",
  "spatialEconomy",
  "youbikeFullness",
  "jpPopulationMesh1km",
  "caPopulationGrid",
  "urbanFormGrid",
  "temperatureGrid",
  "transitReachGrid",
  "noiseCaptureGrid",
  // 不加 tedsGridEmissions：同一筆登記含點源工廠 circle，只查點擊點會讓小點變難點
]);

export function gisHitTarget<T>(type: string, point: T, bbox: [T, T]): T | [T, T] {
  return EXACT_POINT_HIT_TYPES.has(type) ? point : bbox;
}
