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

describe("GIS_LAYERS 廣域面排在點／線之後（review 2026-11-18 F028）", () => {
  const order = (type: string) => GIS_LAYERS.findIndex((entry) => entry.type === type);
  const lastIndexOf = (prefix: string, suffix: string) =>
    GIS_LAYERS.reduce((acc, e, i) => (e.layers.every((l) => l.startsWith(prefix) && l.endsWith(suffix)) ? i : acc), -1);

  it("PH 廣域面在所有 PH 點層（circle）之後", () => {
    const lastPhPoint = lastIndexOf("ph-", "-circle");
    for (const area of ["phPoverty", "phNoahFlood100yr", "phNoahLandslide", "phLakes", "phNcrSafeOpenSpaces"]) {
      expect(order(area), area).toBeGreaterThan(lastPhPoint);
    }
    const tdaFill = GIS_LAYERS.findIndex((e) => e.layers.includes("ph-tda-fill"));
    expect(tdaFill).toBeGreaterThan(lastPhPoint);
  });

  it("KR 面層在 KR 點層之後、CA 人口／原住民面在 CA 點層之後", () => {
    const lastKrPoint = Math.max(lastIndexOf("kr-", "-circle"), order("krRailStations"), order("krBusStops"));
    for (const area of ["krMarineProtectedAreas", "krNationalParks", "krFishingGrounds", "krSeoulZoning"]) {
      expect(order(area), area).toBeGreaterThan(lastKrPoint);
    }
    const lastCaPoint = lastIndexOf("ca-", "-circle");
    for (const l of ["ca-indigenous-lands-fill", "ca-population-centres-fill", "ca-population-grid-r7-fill"]) {
      expect(GIS_LAYERS.findIndex((e) => e.layers.includes(l)), l).toBeGreaterThan(lastCaPoint);
    }
  });

  it("統計圖層圓模式：缺值／遮蔽斜線層登記為點擊目標（F003）", () => {
    const stat = GIS_LAYERS.find((e) => e.type === "regionalStatistic")!;
    const missing = stat.layers.filter((l) => l.endsWith("-missing"));
    expect(missing.length).toBeGreaterThan(0);
    expect(stat.layers.filter((l) => l.endsWith("-suppressed")).length).toBe(missing.length);
    const firstCircle = stat.layers.findIndex((l) => l.endsWith("-circle"));
    expect(stat.layers.indexOf(missing[0]!)).toBeGreaterThan(firstCircle);
  });
});
