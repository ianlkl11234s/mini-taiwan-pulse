import { describe, expect, it } from "vitest";
import od from "../countyMigrationOd.json";
import {
  COUNTY_MIGRATION_MIN_PERSONS, COUNTY_SEATS, countyFlowWidth, countyFlowsGeoJSON, countyMigrationTotals, countyMigrationYearOfRelease,
  defaultCountyFlows, focusCountyFlows, quadraticArc, type CountyMigrationDocument,
} from "../countyMigrationFlows";
import { getAtlasRecipe, atlasRecipeReleaseOptions } from "../atlasStatisticsRecipes";

const doc = od as unknown as CountyMigrationDocument;

describe("縣市間遷徙流向（B5）", () => {
  it("OD 檔 2024、2025 各 462 組，22 縣市都有端點", () => {
    expect(Object.keys(doc.years).sort()).toEqual(["2024", "2025"]);
    for (const rows of Object.values(doc.years)) {
      expect(rows).toHaveLength(462);
      for (const [o, d] of rows) { expect(COUNTY_SEATS[o]).toBeDefined(); expect(COUNTY_SEATS[d]).toBeDefined(); }
    }
    expect(Object.keys(COUNTY_SEATS)).toHaveLength(22);
  });

  it("預設：全國前 30 ∪ 每縣市最大遷出（去重），都 ≥100 人", () => {
    for (const rows of Object.values(doc.years)) {
      const flows = defaultCountyFlows(rows);
      expect(flows).toHaveLength(38); // 2024、2025 都是前 30 加 8 個縣市的最大遷出不在前 30
      expect(new Set(flows.map((f) => `${f.row[0]}>${f.row[1]}`)).size).toBe(flows.length);
      expect(new Set(flows.map((f) => f.row[0])).size).toBe(22);
      expect(flows.every((f) => f.row[2] >= COUNTY_MIGRATION_MIN_PERSONS)).toBe(true);
    }
  });

  it("選縣市：遷入、遷出各前 5，合計與淨遷入自洽", () => {
    const rows = doc.years["2025"]!;
    const flows = focusCountyFlows(rows, "10015");
    expect(flows.filter((f) => f.role === "in").every((f) => f.row[1] === "10015")).toBe(true);
    expect(flows.filter((f) => f.role === "out").every((f) => f.row[0] === "10015")).toBe(true);
    expect(flows.filter((f) => f.role === "in")).toHaveLength(5);
    const totals = countyMigrationTotals(rows, "10015");
    expect(totals.net).toBe(totals.inflow - totals.outflow);
    // 全國淨遷入加總為 0
    expect(Object.keys(COUNTY_SEATS).reduce((sum, code) => sum + countyMigrationTotals(rows, code).net, 0)).toBe(0);
  });

  it("弧線：A→B 與 B→A 彎向兩側；properties 帶反方向人數", () => {
    const a = COUNTY_SEATS["63000"]!.lngLat; const b = COUNTY_SEATS["65000"]!.lngLat;
    const ab = quadraticArc(a, b)[16]!; const ba = quadraticArc(b, a)[16]!;
    expect(ab).not.toEqual(ba);
    const rows = doc.years["2025"]!;
    const geo = countyFlowsGeoJSON(defaultCountyFlows(rows), rows, "2025");
    const first = geo.features[0]!.properties!;
    expect(first.persons - first.reverse).toBe(first.net);
    expect(countyFlowWidth(57167)).toBe(6);
    expect(countyFlowWidth(150)).toBe(1);
  });

  it("底色期別與年份互轉（統計 release 都對得到）", () => {
    for (const key of ["statsCountyOdNetMigration", "statsCountyOdInMigration"]) {
      const options = atlasRecipeReleaseOptions(getAtlasRecipe(key)!);
      expect(options.map((o) => countyMigrationYearOfRelease(o.release_id)).sort()).toEqual(["2024", "2025"]);
    }
    expect(countyMigrationYearOfRelease("y2026-x")).toBeNull();
  });
});
