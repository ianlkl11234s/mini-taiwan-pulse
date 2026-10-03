import { describe, expect, it } from "vitest";
import { PALETTE_IDS, PALETTE_STEPS, SEQUENTIAL_PALETTES, paletteRamp, resampleRamp } from "../palettes";

/** OKLab L（0–1），用來鎖住「暗底越密越亮、淡底越密越深」的方向 */
function oklabL(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

describe("R7 色盤庫", () => {
  it("收錄使用者勾選的 17 組，id 不重複", () => {
    expect(PALETTE_IDS).toHaveLength(17);
    expect(new Set(PALETTE_IDS).size).toBe(17);
    expect([...PALETTE_IDS].sort()).toEqual(
      ["BuPu", "Burg", "PuBu", "PuBuGn", "YlGnBu", "YlOrBr", "acton", "batlow", "bilbao", "cividis", "magma", "oslo", "rocket", "speed", "tokyo", "turku", "viridis"],
    );
  });

  it.each(SEQUENTIAL_PALETTES.map((p) => [p.id, p] as const))("%s：暗／淡同為 7 階，色值是 #rrggbb", (_id, p) => {
    expect(p.dark).toHaveLength(PALETTE_STEPS);
    expect(p.light).toHaveLength(PALETTE_STEPS);
    for (const c of [...p.dark, ...p.light]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(SEQUENTIAL_PALETTES.map((p) => [p.id, p] as const))("%s：暗底越密越亮、淡底越密越深（相鄰 ΔL ≥ 0.05）", (_id, p) => {
    const dark = p.dark.map(oklabL);
    const light = p.light.map(oklabL);
    for (let i = 1; i < PALETTE_STEPS; i++) {
      expect(dark[i]! - dark[i - 1]!).toBeGreaterThanOrEqual(0.05);
      expect(light[i - 1]! - light[i]!).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("清單把太像的組分開放（magma／rocket、PuBu／oslo、batlow／cividis 不相鄰）", () => {
    const at = (id: string) => PALETTE_IDS.indexOf(id as never);
    for (const [a, b] of [["magma", "rocket"], ["PuBu", "oslo"], ["batlow", "cividis"], ["batlow", "turku"], ["PuBu", "PuBuGn"]] as const) {
      expect(Math.abs(at(a) - at(b))).toBeGreaterThan(1);
    }
    expect(PALETTE_IDS[0]).toBe("magma");
  });

  it("resampleRamp：7 階原樣、其他階數保留兩端", () => {
    const ramp = paletteRamp("viridis", true)!;
    expect(resampleRamp(ramp, 7)).toEqual([...ramp]);
    const nine = resampleRamp(ramp, 9);
    expect(nine).toHaveLength(9);
    expect(nine[0]).toBe(ramp[0]);
    expect(nine[8]).toBe(ramp[6]);
    const three = resampleRamp(ramp, 3);
    expect(three).toEqual([ramp[0], ramp[3], ramp[6]]);
  });
});
