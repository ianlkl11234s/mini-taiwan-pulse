import mapboxgl from "mapbox-gl";

/**
 * 高度放大倍率（可動態調整）
 * Mercator z 在一般 zoom level 下極小，需放大才看得出高度差。
 */
let altExaggeration = 3;

export function setAltExaggeration(v: number) {
  altExaggeration = v;
}

export function getAltExaggeration(): number {
  return altExaggeration;
}

/**
 * 將 [lat, lng, alt_m] 轉換為 Mapbox MercatorCoordinate
 * Three.js 可直接使用 MercatorCoordinate 的 x, y, z
 */
export function toMercator(
  lat: number,
  lng: number,
  altMeters: number,
): { x: number; y: number; z: number } {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat(
    [lng, lat],
    altMeters * altExaggeration,
  );
  return { x: mc.x, y: mc.y, z: mc.z };
}

/**
 * 取得某個 MercatorCoordinate 位置 1 公尺對應的 scale
 * 用於將公尺單位轉為 Mercator 單位
 */
export function metersPerUnit(lat: number): number {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat([0, lat], 0);
  return mc.meterInMercatorCoordinateUnits();
}
