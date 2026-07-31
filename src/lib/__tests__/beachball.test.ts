import { describe, it, expect } from "vitest";
import { beachballSvg, nodalVectors, auxiliaryPlane, isCompressional } from "../beachball";

describe("nodalVectors", () => {
  it("normal 與 slip 互相垂直（單位向量）", () => {
    const { normal, slip } = nodalVectors({ strike: 41.62, dip: 36.35, rake: 117.37 });
    const dot = normal[0] * slip[0] + normal[1] * slip[1] + normal[2] * slip[2];
    expect(Math.abs(dot)).toBeLessThan(1e-9);
  });

  it("dip=90 / rake=±90 / rake=0,180 邊界情況不產生 NaN", () => {
    const cases = [
      { strike: 30, dip: 90, rake: 45 },
      { strike: 10, dip: 45, rake: 90 },
      { strike: 10, dip: 45, rake: -90 },
      { strike: 10, dip: 45, rake: 0 },
      { strike: 10, dip: 45, rake: 180 },
      { strike: 0, dip: 90, rake: 0 },
    ];
    for (const c of cases) {
      const { normal, slip } = nodalVectors(c);
      for (const v of [...normal, ...slip]) {
        expect(Number.isNaN(v)).toBe(false);
      }
    }
  });
});

describe("auxiliaryPlane", () => {
  // 用 Supabase earthquake_moment_tensor 4 筆真實解驗證（strike1/dip1/rake1 反推
  // 應接近資料庫給的 strike2/dip2/rake2）
  const realEvents: Array<{ plane1: { strike: number; dip: number; rake: number }; plane2: { strike: number; dip: number; rake: number } }> = [
    { plane1: { strike: 41.62, dip: 36.35, rake: 117.37 }, plane2: { strike: 188.89, dip: 58.24, rake: 71.31 } },
    { plane1: { strike: 356.71, dip: 17.05, rake: 70.85 }, plane2: { strike: 196.67, dip: 73.92, rake: 95.75 } },
    { plane1: { strike: 62.45, dip: 50.94, rake: 149.62 }, plane2: { strike: 172.72, dip: 66.88, rake: 43.25 } },
    { plane1: { strike: 82.57, dip: 24.04, rake: 134.77 }, plane2: { strike: 215.2, dip: 73.19, rake: 72.56 } },
  ];

  it.each(realEvents)("由 plane1 算出的 aux plane 接近真實 plane2 ($plane1.strike)", ({ plane1, plane2 }) => {
    const aux = auxiliaryPlane(plane1);
    expect(aux.strike).toBeCloseTo(plane2.strike, 0);
    expect(aux.dip).toBeCloseTo(plane2.dip, 0);
    expect(aux.rake).toBeCloseTo(plane2.rake, 0);
  });
});

describe("isCompressional — 象限方位", () => {
  it("純走滑（0,90,0）呈棋盤格四象限（NE/SW 同號，SE/NW 同號但與 NE/SW 相反）", () => {
    const m = { strike: 0, dip: 90, rake: 0 };
    const ne = isCompressional(m, 0.5, 0.5);
    const se = isCompressional(m, 0.5, -0.5);
    const sw = isCompressional(m, -0.5, -0.5);
    const nw = isCompressional(m, -0.5, 0.5);
    expect(ne).toBe(sw);
    expect(se).toBe(nw);
    expect(ne).not.toBe(se);
  });

  it("純逆斷層（0,45,90）與純正斷層（0,45,-90）中心區域壓縮/拉張相反", () => {
    const thrust = { strike: 0, dip: 45, rake: 90 };
    const normalFault = { strike: 0, dip: 45, rake: -90 };
    // 中心 (0,0) 剛好在等值線上時方向不穩定，取靠近中心的一點代表「中心區域」
    const thrustCenter = isCompressional(thrust, 0.01, 0.01);
    const normalCenter = isCompressional(normalFault, 0.01, 0.01);
    expect(thrustCenter).toBe(true); // 逆斷層：中心為壓縮
    expect(normalCenter).toBe(false); // 正斷層：中心為拉張
    expect(thrustCenter).not.toBe(normalCenter);
  });
});

describe("beachballSvg", () => {
  const cases: Array<[string, { strike: number; dip: number; rake: number }]> = [
    ["純走滑", { strike: 0, dip: 90, rake: 0 }],
    ["純逆斷層", { strike: 0, dip: 45, rake: 90 }],
    ["純正斷層", { strike: 0, dip: 45, rake: -90 }],
    ["垂直斷層+斜滑", { strike: 30, dip: 90, rake: 45 }],
    ["rake=180 右移純走滑", { strike: 10, dip: 90, rake: 180 }],
    ["真實事件 1", { strike: 41.62, dip: 36.35, rake: 117.37 }],
  ];

  it.each(cases)("%s：輸出合法 SVG 字串（含 svg 標籤、無 NaN）", (_label, mechanism) => {
    const svg = beachballSvg(mechanism);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).not.toMatch(/NaN/);
    expect(svg).toContain("<circle");
  });

  it("size / fillColor / bgColor / strokeColor 選項會反映到輸出字串", () => {
    const svg = beachballSvg(
      { strike: 10, dip: 60, rake: 30 },
      { size: 80, fillColor: "#ff0000", bgColor: "#00ff00", strokeColor: "#0000ff" },
    );
    expect(svg).toContain('width="80"');
    expect(svg).toContain('height="80"');
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#00ff00");
    expect(svg).toContain("#0000ff");
  });
});
