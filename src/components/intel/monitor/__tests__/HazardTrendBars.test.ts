import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { HazardTrendBars, type HazardBar } from "../HazardTrendBars";
import { MonitorStyleContext } from "../monitorStyle";

type Props = Parameters<typeof HazardTrendBars>[0];
const legacy = (p: Props) => renderToStaticMarkup(createElement(HazardTrendBars, p));
const v2 = (p: Props) =>
  renderToStaticMarkup(createElement(MonitorStyleContext.Provider, { value: "v2" }, createElement(HazardTrendBars, p)));

const PART = "#ef4444";
const bars: HazardBar[] = [
  { label: "09/01", value: 20, level: 0, part: 5 },
  { label: "09/02", value: 10, level: 0, part: 40 }, // part > value → 截到 value
  { label: "09/03", value: 8, level: 0, part: null },
  { label: "09/04", value: null, level: 0, part: 3 },
];
const base: Props = { bars, levelColors: ["#64aaff"], caption: "近 14 天", footer: "最高 20", partColor: PART, partLabel: "越中線" };

describe("HazardTrendBars part／bare (spec §5.35 F3)", () => {
  it("子段高度＝part / max，其餘段補足到總柱高", () => {
    const html = v2(base);
    const parts = [...html.matchAll(/data-testid="hazard-bar-part" style="height:([\d.]+)%/g)].map((m) => Number(m[1]));
    // max = 20：第 1 根 5/20 = 25%；第 2 根 part 截到 10 → 10/20 = 50%；null 不畫；無資料柱不畫
    expect(parts).toEqual([25, 50]);
    expect(html).toContain("height:75%"); // 第 1 根 level 段 = 100 − 25
    expect(html).toContain(`background:${PART}`);
  });

  it("part 等於 value 時整柱為子段，子段帶頂圓角、不畫 level 段", () => {
    const html = v2({ ...base, bars: [{ label: "a", value: 10, level: 0, part: 10 }] });
    expect(html).toMatch(/data-testid="hazard-bar-part" style="height:100%;background:#ef4444;border-radius:\d+px \d+px 0 0"/);
  });

  it("v2 bare：不畫 caption、footer 與首尾日期", () => {
    const html = v2({ ...base, bare: true });
    expect(html).not.toContain("近 14 天");
    expect(html).not.toContain("最高 20");
    expect(html).not.toContain("09/01");
  });

  it("舊版忽略 bare；沒有 part 的柱子輸出與改版前相同結構", () => {
    expect(legacy({ ...base, bare: true })).toBe(legacy(base));
    const noPart = bars.map(({ part: _p, ...b }) => b);
    const html = legacy({ ...base, bars: noPart });
    expect(html).not.toContain("hazard-bar-part");
    expect(html).toContain("近 14 天");
    expect(html).toContain("09/04");
  });
});
