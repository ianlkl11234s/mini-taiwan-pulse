import { describe, expect, it } from "vitest";

import {
  MULTI_SELECT_BITMASK_MAX_OPTIONS,
  allMultiSelectBitmask,
  multiSelectFilter,
  multiSelectOpacityExpression,
  selectedMultiSelectValues,
} from "../multiSelectMapbox";
import { RIVERSIDE_PARKS } from "../urbanOpenSpaceTypes";

describe("multiSelectMapbox", () => {
  const values = ["a", "b", "c"];

  it("將 bitmask 穩定轉成任意多類 filter，並讓全關為恆假", () => {
    expect(multiSelectFilter("kind", allMultiSelectBitmask(values), values))
      .toEqual(["has", "kind"]);
    expect(multiSelectFilter("kind", 5, values))
      .toEqual(["in", ["get", "kind"], ["literal", ["a", "c"]]]);
    expect(multiSelectFilter("kind", 0, values))
      .toEqual(["==", ["get", "kind"], "__multi_select_none__"]);
  });

  it("opacity renderer 支援多選與全關，不把全開改成 expression", () => {
    expect(multiSelectOpacityExpression("kind", 5, values, 0.8))
      .toEqual(["case", ["in", ["get", "kind"], ["literal", ["a", "c"]]], 0.8, 0]);
    expect(multiSelectOpacityExpression("kind", 0, values, 0.8)).toBe(0);
    expect(multiSelectOpacityExpression("kind", 7, values, 0.8)).toBe(0.8);
  });

  it("30 類河濱公園保留最高 bit，且拒絕會進入 sign bit 的 31 類", () => {
    expect(RIVERSIDE_PARKS).toHaveLength(MULTI_SELECT_BITMASK_MAX_OPTIONS);
    const highestBit = 1 << (RIVERSIDE_PARKS.length - 1);
    expect(highestBit).toBe(536870912);
    expect(selectedMultiSelectValues(highestBit, RIVERSIDE_PARKS))
      .toEqual([RIVERSIDE_PARKS[RIVERSIDE_PARKS.length - 1]]);
    expect(allMultiSelectBitmask(RIVERSIDE_PARKS)).toBe(1073741823);
    expect(() => allMultiSelectBitmask(Array.from({ length: 31 }, (_, index) => String(index))))
      .toThrow("最多支援 30 類");
  });
});
