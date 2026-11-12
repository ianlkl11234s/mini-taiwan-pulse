import { afterEach, describe, expect, it } from "vitest";
import { compareSideOf, compareStore, isCompareSupported, shownOnLeft, shownOnRight, clampSplit, COMPARE_DEFAULT_SPLIT } from "../compareStore";
import { STATISTICS_RENDER_KEYS } from "../../data/regionalStatisticsRecipes";

const STAT = STATISTICS_RENDER_KEYS[0]!;

describe("compareStore", () => {
  afterEach(() => compareStore.reset());

  it("P1 支援範圍：古地圖六層與統計圖層，其他不支援", () => {
    for (const key of ["historicalMapSinica", "historicalMapPostwar", "historicalImagery", "historicalBoundaries", "historicalLandUse", "historicalThematic"]) {
      expect(isCompareSupported(key)).toBe(true);
    }
    expect(isCompareSupported(STAT)).toBe(true);
    expect(isCompareSupported("flights")).toBe(false);
    expect(isCompareSupported("rail")).toBe(false);
  });

  it("側別預設兩側；不支援的圖層一律左側且不能改", () => {
    expect(compareSideOf("historicalMapSinica")).toBe("both");
    compareStore.setSide("flights", "right");
    expect(compareSideOf("flights")).toBe("left");
    expect(compareStore.getSnapshot().sides).toEqual({});
    compareStore.setSide("historicalMapSinica", "left");
    expect(compareSideOf("historicalMapSinica")).toBe("left");
    compareStore.setSide("historicalMapSinica", "both");
    expect(compareStore.getSnapshot().sides).toEqual({});
  });

  it("側別可見性視圖：比較關閉＝圖層開關；只在右側的層左圖不畫；不支援的層右圖不畫", () => {
    compareStore.setSide("historicalMapSinica", "right");
    expect(shownOnLeft("historicalMapSinica", true)).toBe(true);   // 比較還沒開
    expect(shownOnRight("historicalMapSinica", true)).toBe(false);
    compareStore.setEnabled(true);
    expect(shownOnLeft("historicalMapSinica", true)).toBe(false);
    expect(shownOnRight("historicalMapSinica", true)).toBe(true);
    expect(shownOnRight("historicalMapSinica", false)).toBe(false);
    expect(shownOnLeft("flights", true)).toBe(true);
    expect(shownOnRight("flights", true)).toBe(false);
    expect(shownOnLeft(STAT, true)).toBe(true);
    expect(shownOnRight(STAT, true)).toBe(true);
  });

  it("把手位置夾在 0.05–0.95，非數字回預設", () => {
    compareStore.setSplit(2);
    expect(compareStore.getSnapshot().split).toBe(0.95);
    expect(clampSplit(Number.NaN)).toBe(COMPARE_DEFAULT_SPLIT);
  });

  it("hydrate 略過非法側別與不支援的圖層，關掉再開沿用側別", () => {
    compareStore.hydrate({ enabled: true, split: 0.3, sides: { historicalMapSinica: "right", flights: "right", [STAT]: "both" } });
    expect(compareStore.getSnapshot()).toMatchObject({ enabled: true, split: 0.3, sides: { historicalMapSinica: "right" } });
    compareStore.setEnabled(false);
    compareStore.setEnabled(true);
    expect(compareSideOf("historicalMapSinica")).toBe("right");
  });

  it("訂閱只在值改變時通知", () => {
    let calls = 0;
    const off = compareStore.subscribe(() => { calls += 1; });
    compareStore.setEnabled(false);
    compareStore.setEnabled(true);
    compareStore.setEnabled(true);
    off();
    expect(calls).toBe(1);
  });
});
