import * as THREE from "three";

/**
 * Mapbox 地球儀投影（本站 zoom < 6）下，把 lat/lng 轉到 custom layer matrix 的世界空間。
 *
 * 作法與 `HistoricalFlightTrailsScene` 相同：ECEF 經 Mapbox 給的 globeToMercator 矩陣轉進
 * mercator 世界空間，再依 `1 - transition` 與平面 mercator 位置 lerp。transition ≥ 1
 * （已拉近成平面 mercator）時 `createGlobeProjector` 回傳 null，呼叫端維持原本 toMercator。
 * CPU 端轉換，供每次 rebuild 才寫 buffer 的 Scene（如 ShipScene）使用。
 */
export const GLOBE_RADIUS = 8192 / (2 * Math.PI);
const GLOBE_EXTENT = 8192;

export interface GlobeProjector {
  /**
   * 以平面 mercator 位置 `merc`（toMercator 結果）與經緯度算出 globe 過渡期位置寫入 `out`。
   * 位於地球背面（相機看不到）時回傳 false，`out` 不保證有效。
   */
  project(lat: number, lng: number, merc: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): boolean;
}

export function createGlobeProjector(
  globeToMercator: ArrayLike<number> | null | undefined,
  transition: number | undefined,
  cameraMercator: { x: number; y: number; z: number } | null,
): GlobeProjector | null {
  if (!globeToMercator || globeToMercator.length < 16 || (transition ?? 1) >= 1) return null;
  const m = Array.from(globeToMercator as ArrayLike<number>).slice(0, 16);
  const t = Math.max(0, Math.min(1, transition ?? 0));
  let camEcef: THREE.Vector3 | null = null;
  if (cameraMercator) {
    const inv = new THREE.Matrix4().fromArray(m).invert();
    const c = new THREE.Vector4(cameraMercator.x, cameraMercator.y, cameraMercator.z, 1).applyMatrix4(inv);
    camEcef = new THREE.Vector3(c.x, c.y, c.z);
  }
  const w = 1 - t;
  return {
    project(lat, lng, merc, out) {
      const la = lat * Math.PI / 180, ln = lng * Math.PI / 180, cosLat = Math.cos(la);
      const r = GLOBE_RADIUS + merc.z * GLOBE_EXTENT * cosLat;
      const ex = cosLat * Math.sin(ln) * r, ey = -Math.sin(la) * r, ez = cosLat * Math.cos(ln) * r;
      if (camEcef) {
        // 背面剔除：地表法線與「地表點→相機」方向夾角 ≥ 90° 即看不到
        const nx = ex / r, ny = ey / r, nz = ez / r;
        const dx = camEcef.x - nx * GLOBE_RADIUS, dy = camEcef.y - ny * GLOBE_RADIUS, dz = camEcef.z - nz * GLOBE_RADIUS;
        if (nx * dx + ny * dy + nz * dz <= 0) return false;
      }
      // column-major（與 THREE.Matrix4.fromArray／Mapbox 相同）
      const gw = m[3]! * ex + m[7]! * ey + m[11]! * ez + m[15]!;
      const gx = (m[0]! * ex + m[4]! * ey + m[8]! * ez + m[12]!) / gw;
      const gy = (m[1]! * ex + m[5]! * ey + m[9]! * ez + m[13]!) / gw;
      const gz = (m[2]! * ex + m[6]! * ey + m[10]! * ez + m[14]!) / gw;
      out.x = merc.x + (gx - merc.x) * w;
      out.y = merc.y + (gy - merc.y) * w;
      out.z = merc.z + (gz - merc.z) * w;
      return true;
    },
  };
}
