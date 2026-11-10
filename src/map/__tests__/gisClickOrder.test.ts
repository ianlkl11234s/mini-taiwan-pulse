import { describe, expect, it } from "vitest";
import { GIS_LAYERS, dropHiddenLandUseHex } from "../gisClickRegistry";

describe("GIS_LAYERS 點擊順序（first-hit-wins）", () => {
  const order = (type: string) => GIS_LAYERS.findIndex((entry) => entry.type === type);

  it("大面積面層（國家公園、公共生活覆蓋）排在道路、站點與 POI 之後", () => {
    for (const area of ["nationalParks", "publicLifeOsmCoverage"]) {
      for (const detail of ["roadCongestion", "visitorCentres", "submarineCable", "landingStation"]) {
        expect(order(area), `${area} 應在 ${detail} 之後`).toBeGreaterThan(order(detail));
      }
    }
  });

  it("Day 6 點／線排在所有大面積面層之前（review F007）", () => {
    for (const point of ["mapchallengeDay06Lighthouses", "mapchallengeDay06Temples1921", "mapchallengeDay06Coast"]) {
      for (const area of ["temperatureGrid", "funeralOperatorDensity", "eduCampus", "mapchallengeDay06Taipei1932"]) {
        expect(order(point), `${point} 應在 ${area} 之前`).toBeLessThan(order(area));
      }
    }
  });

  it("國土利用監測：篩選後 opacity 0 的六角格不算命中（review F067）", () => {
    const hex = (opacity: unknown) => ({ layer: { id: "land-use-change-grid-hex", paint: { "fill-opacity": opacity } } });
    const point = { layer: { id: "land-use-change-points-circle", paint: {} } };
    expect(dropHiddenLandUseHex([hex(0), hex(0.6), point])).toEqual([hex(0.6), point]);
  });
});
