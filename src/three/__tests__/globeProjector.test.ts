import { describe, expect, it } from "vitest";
import { createGlobeProjector, GLOBE_RADIUS } from "../globeProjector";

// 縮放 + 平移的 globeToMercator（column-major）
const S = 1 / 8192;
const G2M = [S, 0, 0, 0, 0, S, 0, 0, 0, 0, S, 0, 0.5, 0.5, 0, 1];
const merc = { x: 0.835, y: 0.43, z: 0 }; // 台灣附近（數值只需固定）
const lat = 23.5, lng = 120.3;

function ecef(la: number, ln: number) {
  const a = la * Math.PI / 180, b = ln * Math.PI / 180;
  return [Math.cos(a) * Math.sin(b) * GLOBE_RADIUS, -Math.sin(a) * GLOBE_RADIUS, Math.cos(a) * Math.cos(b) * GLOBE_RADIUS];
}

describe("createGlobeProjector", () => {
  it("transition ≥ 1 或缺矩陣時回傳 null（維持 toMercator 路徑）", () => {
    expect(createGlobeProjector(G2M, 1, null)).toBeNull();
    expect(createGlobeProjector(null, 0, null)).toBeNull();
  });

  it("transition = 0 時等於 ECEF 經 globeToMerc 轉換", () => {
    const p = createGlobeProjector(G2M, 0, null)!;
    const out = { x: 0, y: 0, z: 0 };
    expect(p.project(lat, lng, merc, out)).toBe(true);
    const [x, y, z] = ecef(lat, lng);
    expect(out.x).toBeCloseTo(x! * S + 0.5, 10);
    expect(out.y).toBeCloseTo(y! * S + 0.5, 10);
    expect(out.z).toBeCloseTo(z! * S, 10);
  });

  it("transition 趨近 1 時趨近 toMercator 位置", () => {
    const p = createGlobeProjector(G2M, 0.999999, null)!;
    const out = { x: 0, y: 0, z: 0 };
    p.project(lat, lng, merc, out);
    expect(out.x).toBeCloseTo(merc.x, 5);
    expect(out.y).toBeCloseTo(merc.y, 5);
  });

  it("相機在台灣上空時，地球另一側的點被剔除", () => {
    const [cx, cy, cz] = ecef(lat, lng).map((v) => v * 3);
    // 相機 mercator 位置 = globeToMerc · 相機 ECEF
    const cam = { x: cx! * S + 0.5, y: cy! * S + 0.5, z: cz! * S };
    const p = createGlobeProjector(G2M, 0, cam)!;
    const out = { x: 0, y: 0, z: 0 };
    expect(p.project(lat, lng, merc, out)).toBe(true);
    expect(p.project(-23.5, -59.7, merc, out)).toBe(false);
  });
});
