/**
 * 印尼規格層的點選覆蓋：低縮放只畫外框（line）、較高縮放才畫面（fill）的層，
 * 外框也要登記進 clicks，否則 queryRenderedFeatures 查不到、拉近前點不開 popup（review #1199）。
 */
import { describe, expect, it } from "vitest";
import { ID_DATA_SPECS } from "../idDataLayers";
import { ID_PACK_CLICK_SLOTS } from "../clicks";

const registered = new Set(Object.values(ID_PACK_CLICK_SLOTS).flatMap((entries) => entries.flatMap((e) => e.layers)));

describe("印尼規格層點選覆蓋", () => {
  it("同一 source-layer 的外框比面更早出現時，外框也在點選登記簿", () => {
    const gaps: string[] = [];
    for (const spec of ID_DATA_SPECS) {
      for (const line of spec.parts.filter((p) => p.geom === "line")) {
        const fills = spec.parts.filter((p) => p.geom === "fill" && p.sourceLayer === line.sourceLayer);
        if (fills.length && fills.every((f) => line.minzoom < f.minzoom) && !registered.has(line.id)) gaps.push(`${spec.key}:${line.id}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it("水系與保育林的低縮放外框可點", () => {
    expect(registered.has("id-watersheds-line")).toBe(true);
    expect(registered.has("id-forest-line")).toBe(true);
  });
});
