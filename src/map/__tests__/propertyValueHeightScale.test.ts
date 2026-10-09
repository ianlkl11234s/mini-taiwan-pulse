import { describe, expect, it } from "vitest";
import { propertyValueGridHeightScale } from "../mapStyleScale";

describe("propertyValueGridHeightScale（舊網址高度參數遷移）", () => {
  it("滑桿範圍內的值照用，未設用預設 1", () => {
    expect(propertyValueGridHeightScale(undefined)).toBe(1);
    expect(propertyValueGridHeightScale(2.5)).toBe(2.5);
    expect(propertyValueGridHeightScale(0.1)).toBe(0.25);
  });
  it("舊制 40（基準高度）換算成倍率 1，不放大 40 倍", () => {
    expect(propertyValueGridHeightScale(40)).toBe(1);
    expect(propertyValueGridHeightScale(80)).toBe(2);
    expect(propertyValueGridHeightScale(100000)).toBe(10);
  });
});
