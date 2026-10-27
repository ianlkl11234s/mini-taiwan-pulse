import { describe, expect, it } from "vitest";
import { JP_ZONING_CLASSES, JP_ZONING_COLOR_EXPRESSION, jpZoningFilter, mixWithWhite } from "../data/jpZoningUseDistrictTypes";

describe("日本用途地域 PMTiles 契約", () => {
  it("13 類 code 1–13；住居 1–8、商業 9–10、工業 11–13；色票互不相同", () => {
    expect(JP_ZONING_CLASSES.map((c) => c.code)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(JP_ZONING_CLASSES.filter((c) => c.group === "commercial").map((c) => c.code)).toEqual([9, 10]);
    expect(new Set(JP_ZONING_CLASSES.map((c) => c.color)).size).toBe(13);
    expect(JP_ZONING_COLOR_EXPRESSION).toEqual(expect.arrayContaining(["match", ["get", "youto_code"]]));
    expect(mixWithWhite("#000000", 0)).toBe("#000000");
    expect(mixWithWhite("#000000", 1)).toBe("#ffffff");
  });

  it("篩選：0 全部、1–3 大類範圍、4–16 單類；無效值 fail closed", () => {
    expect(jpZoningFilter(0)).toBeNull();
    expect(jpZoningFilter(1)).toEqual(["all", [">=", ["get", "youto_code"], 1], ["<=", ["get", "youto_code"], 8]]);
    expect(jpZoningFilter(3)).toEqual(["all", [">=", ["get", "youto_code"], 11], ["<=", ["get", "youto_code"], 13]]);
    expect(jpZoningFilter(4)).toEqual(["==", ["get", "youto_code"], 1]);
    expect(jpZoningFilter(16)).toEqual(["==", ["get", "youto_code"], 13]);
    expect(jpZoningFilter(17)).toEqual(["literal", false]);
    expect(jpZoningFilter(-1)).toEqual(["literal", false]);
  });
});
