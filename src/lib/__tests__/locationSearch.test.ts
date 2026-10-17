import { describe, expect, it } from "vitest";

import { ALL_PRESETS } from "../../map/cameraPresets";
import { searchLocationPresets } from "../locationSearch";

describe("locationSearch", () => {
  it("returns only supplied presets and never fabricates an address result", () => {
    const cities = ALL_PRESETS.filter((preset) => preset.category === "city");
    expect(searchLocationPresets(cities, "台北").map((preset) => preset.id)).toEqual(["taipei"]);
    expect(searchLocationPresets(cities, "不存在的地址")).toEqual([]);
  });

  it("normalizes 臺/台, full-width text and separator-delimited multi-word queries", () => {
    expect(searchLocationPresets(ALL_PRESETS, "臺北 １０１").map((preset) => preset.id)).toContain("taipei-101");
    expect(searchLocationPresets(ALL_PRESETS, "taipei_main station").map((preset) => preset.id)).toContain("taipei-main-station");
  });

  it("requires every word to match the same preset metadata", () => {
    expect(searchLocationPresets(ALL_PRESETS, "台北 車站").map((preset) => preset.id)).toEqual(["taipei-main-station"]);
    expect(searchLocationPresets(ALL_PRESETS, "台北 嘉義")).toEqual([]);
  });
});
