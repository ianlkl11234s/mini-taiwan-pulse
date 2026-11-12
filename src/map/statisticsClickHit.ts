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
