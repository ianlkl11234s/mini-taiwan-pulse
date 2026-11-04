/**
 * 座標換算與格式（design-system spec §5.44 游標座標、右鍵選單）。
 * 純函式、不依賴 mapbox-gl。
 */

// TWD97 TM2（EPSG:3826）：GRS80 橢球、中央經線 121°、尺度 0.9999、假東距 250000、假北距 0
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9999;
const LON0 = (121 * Math.PI) / 180;
const FALSE_EASTING = 250000;

/** WGS84 經緯度 → TWD97 TM2（公尺）。WGS84 與 TWD97 基準差在公分級，視為同一基準。 */
export function wgs84ToTwd97(lng: number, lat: number): { x: number; y: number } {
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m = A * (
    (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi
    - ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi)
    + ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi)
    - ((35 * e6) / 3072) * Math.sin(6 * phi)
  );
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const t = tan * tan;
  const c = EP2 * cos * cos;
  const a = (lam - LON0) * cos;
  const x = K0 * n * (
    a
    + ((1 - t + c) * a ** 3) / 6
    + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120
  ) + FALSE_EASTING;
  const y = K0 * (
    m + n * tan * (
      (a * a) / 2
      + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24
      + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720
    )
  );
  return { x, y };
}

/** 「緯度, 經度」十進位字串（可直接貼進 Google 地圖） */
export function formatLatLng(lat: number, lng: number, digits = 4): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

/** TWD97「X, Y」整數公尺 */
export function formatTwd97(lng: number, lat: number): string {
  const { x, y } = wgs84ToTwd97(lng, lat);
  return `${Math.round(x)}, ${Math.round(y)}`;
}
