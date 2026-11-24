import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { CATEGORY_FILTERS, categoryDefs, categoryMaskKey } from "../../data/categoryFilters";
import { loadAllPacks } from "../../countries/packs";

// 全部圖層（含延後載入的國家包，B1 P5）一起驗
await loadAllPacks();

/** Codex review K6：有明列 rebuildOnParamKeys 的圖層，類別多選的 mask 也要在清單內（否則只改類別不會重建 filter） */
describe("類別多選 mask 併入 rebuildOnParamKeys", () => {
  it("明列 rebuildOnParamKeys 的圖層都含各自的類別 mask key", () => {
    const missing: string[] = [];
    for (const config of OVERLAY_REGISTRY) {
      const entry = CATEGORY_FILTERS[config.id];
      if (!entry || !config.rebuildOnParamKeys?.length) continue;
      for (const def of categoryDefs(entry)) {
        const key = categoryMaskKey(config.id, def);
        if (!config.rebuildOnParamKeys.includes(key)) missing.push(`${config.id}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("Day 21 道路等級 mask 在清單內", () => {
    const c = OVERLAY_REGISTRY.find((o) => o.id === "mapchallengeDay21OsmRoads")!;
    expect(c.rebuildOnParamKeys).toContain("mapchallengeDay21OsmRoadsCatMask");
  });
});
