import { describe, expect, it } from "vitest";
import { restoreMobileCompare } from "./mobileCompareRestore";

describe("restoreMobileCompare（K4）", () => {
  const stashed = {
    split: 0.4, left: ["a"], right: ["a"],
    leftSelection: { a: { period: "2020" } },
    rightSelection: { a: { period: "2021" } },
  };

  it("左側期別改用手機單地圖目前的值，右側維持寄放值", () => {
    const out = restoreMobileCompare(stashed, { a: { period: "2023" } });
    expect(out.leftSelection).toEqual({ a: { period: "2023" } });
    expect(out.rightSelection).toEqual({ a: { period: "2021" } });
    expect(out.split).toBe(0.4);
  });

  it("手機上關掉該圖層（目前沒有左側選擇）就不還原舊的左側期別", () => {
    expect(restoreMobileCompare(stashed, undefined).leftSelection).toBeUndefined();
  });
});
