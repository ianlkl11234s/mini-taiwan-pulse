/**
 * 經緯度 → Mercator 座標（Three.js CustomLayer 用）
 *
 * ⚠️ **引擎顯式注入**（EM-16 / docs/proposal/embed-dynamic-layers.md §9-4）
 *
 * 本檔原本 `import mapboxgl from "mapbox-gl"`，導致任何用到 Three 場景的入口
 * 都會硬拖進整包 mapbox-gl。`/embed` 走 MapLibre、且**不得**載入 mapbox-gl
 * （體積 + map load 計費），所以改成由「入口」注入建構子：
 *
 *   主站  `src/main.tsx`        → `mapboxgl.MercatorCoordinate`
 *   embed `src/embed/main.tsx`  → `maplibregl.MercatorCoordinate`
 *
 * 兩家 `MercatorCoordinate.fromLngLat / meterInMercatorCoordinateUnits` 同名同簽名，
 * spike 實測數值 bit-identical（見 §9-4），故可直接互換。
 *
 * 未注入就呼叫會 **throw**（不靜默回 0）—— 座標錯掉的畫面是「東西飛到畫面外」，
 * 比當場報錯難查十倍。注入點寫成 side-effect 模組並放在入口第一行 import，
 * ES 模組求值順序保證它早於整個 App import graph。
 */

/** `MercatorCoordinate` 實例中我們真正用到的部分。 */
export interface MercatorPoint {
  x: number;
  y: number;
  z: number;
  meterInMercatorCoordinateUnits(): number;
}

/** `MercatorCoordinate` 類別（靜態 `fromLngLat`）—— mapbox-gl 與 maplibre-gl 都符合。 */
export interface MercatorEngine {
  fromLngLat(lngLat: [number, number], altitude?: number): MercatorPoint;
}

let engine: MercatorEngine | null = null;

/** 由入口注入地圖引擎的 `MercatorCoordinate`。建 map **之前**呼叫。 */
export function setMercatorEngine(ctor: MercatorEngine): void {
  engine = ctor;
}

/** 測試／診斷用：目前有沒有注入過。 */
export function hasMercatorEngine(): boolean {
  return engine !== null;
}

function requireEngine(): MercatorEngine {
  if (!engine) {
    throw new Error(
      "[coordinates] MercatorEngine 未注入 —— 入口必須在建立 map 前呼叫 " +
        "setMercatorEngine(mapboxgl.MercatorCoordinate)（主站）或 " +
        "setMercatorEngine(maplibregl.MercatorCoordinate)（embed）。",
    );
  }
  return engine;
}

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
 * 將 [lat, lng, alt_m] 轉換為 MercatorCoordinate
 * Three.js 可直接使用 MercatorCoordinate 的 x, y, z
 *
 * x 手動計算以支援展開後的經度（>180° 或 <-180°，跨換日線航班），
 * 因為 MercatorCoordinate.fromLngLat 會將經度正規化到 [-180, 180]。
 * y, z 由引擎計算（僅依賴緯度和高度，與經度無關）。
 */
export function toMercator(
  lat: number,
  lng: number,
  altMeters: number,
): { x: number; y: number; z: number } {
  // x 手動計算，避免引擎正規化經度（換日線展開語意，兩家引擎皆會正規化）
  const x = (lng + 180) / 360;
  // y, z 用引擎計算（經度不影響結果）
  const mc = requireEngine().fromLngLat([0, lat], (altMeters + altOffset) * altExaggeration);
  return { x, y: mc.y, z: mc.z };
}

/**
 * 取得某個 MercatorCoordinate 位置 1 公尺對應的 scale
 * 用於將公尺單位轉為 Mercator 單位
 */
export function metersPerUnit(lat: number): number {
  const mc = requireEngine().fromLngLat([0, lat], 0);
  return mc.meterInMercatorCoordinateUnits();
}
