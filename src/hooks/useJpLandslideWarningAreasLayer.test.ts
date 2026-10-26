import { describe, expect, it } from "vitest";
import {
  JP_LANDSLIDE_PHENOMENA,
  JP_LANDSLIDE_SORT_KEY,
  JP_LANDSLIDE_ZONES,
  JP_LANDSLIDE_ZONE_COLOR_EXPRESSION,
  jpLandslideFilter,
} from "../data/jpLandslideWarningTypes";

describe("日本土砂災害警戒區域 PMTiles 契約", () => {
  it("紅區在黃區之內：紅區排前面、sort key 讓紅區畫在上層", () => {
    expect(JP_LANDSLIDE_ZONES.map((z) => z.value)).toEqual(["red", "yellow"]);
    expect(JP_LANDSLIDE_SORT_KEY).toEqual(["match", ["get", "zone_class"], "red", 1, 0]);
    expect(JP_LANDSLIDE_ZONE_COLOR_EXPRESSION).toEqual(expect.arrayContaining(["match", ["get", "zone_class"]]));
    expect(JP_LANDSLIDE_PHENOMENA.map((p) => p.value)).toEqual(["steep_slope_failure", "debris_flow", "landslide"]);
  });

  it("篩選：全部不加 filter；區域種別與現象可組合；無效值 fail closed", () => {
    expect(jpLandslideFilter(0, 0)).toBeNull();
    expect(jpLandslideFilter(1, 0)).toEqual(["==", ["get", "zone_class"], "red"]);
    expect(jpLandslideFilter(2, 0)).toEqual(["==", ["get", "zone_class"], "yellow"]);
    expect(jpLandslideFilter(0, 2)).toEqual(["==", ["get", "phenomenon_en"], "debris_flow"]);
    expect(jpLandslideFilter(1, 3)).toEqual(["all", ["==", ["get", "zone_class"], "red"], ["==", ["get", "phenomenon_en"], "landslide"]]);
    expect(jpLandslideFilter(3, 0)).toEqual(["literal", false]);
    expect(jpLandslideFilter(0, 4)).toEqual(["literal", false]);
    expect(jpLandslideFilter(-1, 0)).toEqual(["literal", false]);
  });
});
