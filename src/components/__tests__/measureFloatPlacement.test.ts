import { describe, expect, it } from "vitest";
import { placeMeasureBar } from "../measureFloatPlacement";

const frame = { left: 72, top: 63, right: 1084, bottom: 63 };

describe("placeMeasureBar", () => {
  it("沒有卡片時置中", () => {
    expect(placeMeasureBar(frame, 416, 36, [])).toEqual({ x: 72 + (1012 - 416) / 2, y: 63 });
  });

  it("右上提示卡擋到置中位置時往左讓，仍在同一列", () => {
    const hint = { left: 843, top: 88, right: 1084, bottom: 177 };
    const { x, y } = placeMeasureBar(frame, 416, 36, [hint]);
    expect(y).toBe(63);
    expect(x + 416).toBeLessThanOrEqual(843 - 12);
  });

  it("split 時可用區放不下單行＋提示卡 → 排到提示卡下方、置中", () => {
    const split = { left: 72, top: 63, right: 568, bottom: 63 };
    const hint = { left: 327, top: 88, right: 568, bottom: 177 };
    expect(placeMeasureBar(split, 416, 36, [hint])).toEqual({ x: 72 + (496 - 416) / 2, y: 177 + 12 });
  });

  it("置中的珊瑚警示擋住時往下排", () => {
    const coral = { left: 340, top: 72, right: 760, bottom: 140 };
    const wide = { left: 72, top: 63, right: 1084, bottom: 63 };
    const { y } = placeMeasureBar(wide, 900, 36, [coral]);
    expect(y).toBe(152);
  });

  it("卡片在下方遠處（右下 popup）不影響", () => {
    const popup = { left: 762, top: 511, right: 1042, bottom: 686 };
    expect(placeMeasureBar(frame, 416, 36, [popup]).y).toBe(63);
  });
});
