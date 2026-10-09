import { describe, expect, it } from "vitest";
import { GIS_LAYERS } from "../gisClickRegistry";

describe("GIS_LAYERS 點擊順序（first-hit-wins）", () => {
  const order = (type: string) => GIS_LAYERS.findIndex((entry) => entry.type === type);

  it("大面積面層（國家公園、公共生活覆蓋）排在道路、站點與 POI 之後", () => {
    for (const area of ["nationalParks", "publicLifeOsmCoverage"]) {
      for (const detail of ["roadCongestion", "visitorCentres", "submarineCable", "landingStation"]) {
        expect(order(area), `${area} 應在 ${detail} 之後`).toBeGreaterThan(order(detail));
      }
    }
  });
});
