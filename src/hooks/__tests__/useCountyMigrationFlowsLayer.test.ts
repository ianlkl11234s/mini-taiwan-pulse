/** 縣市遷徙流向 hook：換底圖後補回資料（Codex N1）、年份連動只動「開著」的底色層（N2）。 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

vi.mock("react", async () => (await import("./hookHarness")).reactMock);
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));

const doc = vi.hoisted(() => ({
  value: { dataset_id: "d", source: "s", license: "l", unit: "u", years: { "2025": [["63000", "65000", 500, 250, 250]], "2024": [["63000", "65000", 400, 200, 200]] } },
}));
vi.mock("../../data/countyMigrationFlows", async (importActual) => ({
  ...(await importActual<typeof import("../../data/countyMigrationFlows")>()),
  loadCountyMigrationOd: () => Promise.resolve(doc.value),
}));

import { harness, createFakeMap } from "./hookHarness";
import { useCountyMigrationFlowsLayer } from "../useCountyMigrationFlowsLayer";
import { regionalStatisticsStore } from "../../state/regionalStatisticsStore";
import { layerVisibilityStore } from "../../state/layerVisibilityStore";
import { statisticsRecipe } from "../../data/statisticsSelection";
import { COUNTY_MIGRATION_BASE_KEYS } from "../../data/countyMigrationFlows";
import type { StatisticsRenderKey } from "../../data/regionalStatisticsRecipes";

function render(fake: ReturnType<typeof createFakeMap>, year: string) {
  harness.begin();
  useCountyMigrationFlowsLayer({ current: fake.map } as RefObject<MapboxMap | null>, true, 0.85, year);
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
afterEach(() => { harness.cleanup(); vi.restoreAllMocks(); layerVisibilityStore.reset(); });

describe("useCountyMigrationFlowsLayer", () => {
  it("rehydrates sources with the loaded OD data after a basemap change (N1)", async () => {
    const fake = createFakeMap();
    render(fake, "2025");
    await flush();
    render(fake, "2025");
    const features = () => (fake.sources.get("tw-county-migration-flows")!.setData.mock.calls.slice(-1)[0]?.[0] as GeoJSON.FeatureCollection).features.length;
    expect(features()).toBeGreaterThan(0);
    fake.restyle();
    const rebuilt = fake.sources.get("tw-county-migration-flows")!;
    expect(rebuilt.setData).toHaveBeenCalled();
    expect((rebuilt.setData.mock.calls.slice(-1)[0]![0] as GeoJSON.FeatureCollection).features.length).toBeGreaterThan(0);
  });

  it("does not load base statistics layers that are not visible when the year changes (N2)", async () => {
    const load = vi.spyOn(regionalStatisticsStore, "load").mockResolvedValue(undefined);
    for (const key of COUNTY_MIGRATION_BASE_KEYS) regionalStatisticsStore.setSelection(key, statisticsRecipe(key as StatisticsRenderKey));
    layerVisibilityStore.setVisibility(COUNTY_MIGRATION_BASE_KEYS[0], true);
    render(createFakeMap(), "2024");
    const loaded = load.mock.calls.map((call) => call[0]);
    expect(loaded).toEqual([COUNTY_MIGRATION_BASE_KEYS[0]]);
  });

  it("synchronizes a base layer once it is enabled later (N2)", () => {
    const load = vi.spyOn(regionalStatisticsStore, "load").mockResolvedValue(undefined);
    const key = COUNTY_MIGRATION_BASE_KEYS[1];
    regionalStatisticsStore.setSelection(key, statisticsRecipe(key as StatisticsRenderKey));
    render(createFakeMap(), "2024");
    expect(load).not.toHaveBeenCalled();
    layerVisibilityStore.setVisibility(key, true);
    expect(load).toHaveBeenCalledWith(key);
  });
});
