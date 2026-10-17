import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RAIL_METRO_LINES } from "../railRoutesTypes";

const readJson = (rel: string) => JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf-8"));

describe("捷運線色 SSOT 與靜態資料同步", () => {
  const routes = readJson("public/rail/routes_static.geojson").features as { properties: Record<string, string | null> }[];

  it("RAIL_METRO_LINES 每條線的色與 routes_static.geojson 一致（不分大小寫）", () => {
    for (const l of RAIL_METRO_LINES) {
      const r = routes.find((f) => f.properties.system === l.system && (f.properties.line_id ?? "C") === l.lineId);
      expect(r, `${l.system}/${l.lineId}`).toBeTruthy();
      expect(String(r!.properties.color).toLowerCase()).toBe(l.color.toLowerCase());
    }
  });

  it("捷運站點的 line_color 與同線 routes 線色一致，且每個非台鐵點都有 line_id / transfer", () => {
    const pts = readJson("public/geo/station_points.geojson").features as { properties: Record<string, unknown> }[];
    const colorOf = new Map(RAIL_METRO_LINES.map((l) => [`${l.system}/${l.lineId}`, l.color.toLowerCase()]));
    for (const { properties: p } of pts) {
      if (p.system_id === "tra") continue;
      expect(typeof p.transfer, String(p.station_id)).toBe("boolean");
      expect(String(p.line_color).toLowerCase(), String(p.station_id)).toBe(colorOf.get(`${p.system_id}/${p.line_id}`));
    }
  });
});
