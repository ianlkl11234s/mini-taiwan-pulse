import { describe, expect, it } from "vitest";
import { BOOT_CITIES, BOOT_LAYOUT, bootGeometry } from "../bootSequence";
import { TAIWAN_OUTLINE } from "../taiwanOutline";

// 以 1440×900 視窗把 vw／vh 字串換成 px，驗證「本島外框中心＝視窗中心＋位移」這個定案規格
const VW = 14.4;
const VH = 9;
const px = (value: string): number => {
  const calc = value.match(/^calc\(([\d.]+)vw - ([\d.]+)vh\)$/);
  if (calc) return Number(calc[1]) * VW - Number(calc[2]) * VH;
  const vh = value.match(/^(-?[\d.]+)vh$/);
  if (vh) return Number(vh[1]) * VH;
  const vw = value.match(/^(-?[\d.]+)vw$/);
  if (vw) return Number(vw[1]) * VW;
  throw new Error(`unexpected unit: ${value}`);
};

describe("bootGeometry", () => {
  const g = bootGeometry();
  const [vx, vy, vw, vh] = g.viewBox.split(" ").map(Number) as [number, number, number, number];
  const scale = px(g.svg.height) / vh;
  const [x0, y0, x1, y1] = TAIWAN_OUTLINE.main;

  it("本島高度＝19vh", () => {
    expect((y1 - y0) * scale).toBeCloseTo(BOOT_LAYOUT.mainIslandVh * VH, 1);
    expect(px(g.svg.width) / vw).toBeCloseTo(scale, 5);
  });

  it("本島外框中心落在視窗中心（X 0、Y −4.5vh）", () => {
    const cx = px(g.svg.left) + ((x0 + x1) / 2 - vx) * scale;
    const cy = px(g.svg.top) + ((y0 + y1) / 2 - vy) * scale;
    expect(cx).toBeCloseTo(720 + BOOT_LAYOUT.offsetXVw * VW, 1);
    expect(cy).toBeCloseTo(450 + BOOT_LAYOUT.offsetYVh * VH, 1);
  });

  it("城市點在 900px 高時直徑 5.8px", () => {
    expect(g.cityRadius * 2 * scale).toBeCloseTo(BOOT_LAYOUT.cityDotPxAt900, 1);
  });

  it("城市由北往南排序", () => {
    const ys = BOOT_CITIES.map((c) => c.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});
