import mapboxgl from "mapbox-gl";

/**
 * 高度放大倍率（可動態調整）
 * Mercator z 在一般 zoom level 下極小，需放大才看得出高度差。
 */
let altExaggeration = 3;
let altOffset = 0; // 基準高度偏移（公尺）

export function setAltExaggeration(v: number) {
  altExaggeration = v;
}

export function getAltExaggeration(): number {
  return altExaggeration;
}

export function setAltOffset(v: number) {
  altOffset = v;
}

export function getAltOffset(): number {
  return altOffset;
}

/**
 * 將 [lat, lng, alt_m] 轉換為 Mapbox MercatorCoordinate
 * Three.js 可直接使用 MercatorCoordinate 的 x, y, z
 *
 * x 手動計算以支援展開後的經度（>180° 或 <-180°，跨換日線航班），
 * 因為 MercatorCoordinate.fromLngLat 會將經度正規化到 [-180, 180]。
 * y, z 由 Mapbox 計算（僅依賴緯度和高度，與經度無關）。
 */
export function toMercator(
  lat: number,
  lng: number,
  altMeters: number,
): { x: number; y: number; z: number } {
  // x 手動計算，避免 Mapbox 正規化經度
  const x = (lng + 180) / 360;
  // y, z 用 Mapbox 計算（經度不影響結果）
  const mc = mapboxgl.MercatorCoordinate.fromLngLat(
    [0, lat],
    (altMeters + altOffset) * altExaggeration,
  );
  return { x, y: mc.y, z: mc.z };
}

/**
 * 取得某個 MercatorCoordinate 位置 1 公尺對應的 scale
 * 用於將公尺單位轉為 Mercator 單位
 */
export function metersPerUnit(lat: number): number {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat([0, lat], 0);
  return mc.meterInMercatorCoordinateUnits();
}
