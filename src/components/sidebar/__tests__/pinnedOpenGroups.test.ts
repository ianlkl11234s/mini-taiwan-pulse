import { describe, expect, it } from "vitest";
import type { LayerVisibility } from "../../../types";
import type { CountryCode } from "../../../constants/countries";
import { countryLayerKeys, getThemeLayerKeys, SIMULATION_THEMES, WORLD_THEMES } from "../layerPanels";
import { groupPinnedOpenLayers } from "../pinnedOpenGroups";

const ALL = new Set<CountryCode>(["TW", "GB", "JP", "CN"]);
const vis = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, true])) as unknown as LayerVisibility;
const firstKey = (c: CountryCode) => countryLayerKeys(c)[0]!;

describe("groupPinnedOpenLayers（G1-b）", () => {
  it("只列釘選、非目前國家、開著的圖層，依釘選順序", () => {
    const gb = firstKey("GB");
    const jp = firstKey("JP");
    const groups = groupPinnedOpenLayers(["JP", "GB", "TW"], "TW", ALL, vis(gb, jp, firstKey("TW")));
    expect(groups.map((g) => g.country)).toEqual(["JP", "GB"]);
    expect(groups[0]!.layers.map((l) => l.key)).toContain(jp);
  });

  it("沒釘的國家、目前國家、沒開圖層的釘選國都不列", () => {
    const gb = firstKey("GB");
    expect(groupPinnedOpenLayers(["TW"], "TW", ALL, vis(firstKey("TW")))).toEqual([]);
    expect(groupPinnedOpenLayers(["JP"], "TW", ALL, vis(gb))).toEqual([]);
    expect(groupPinnedOpenLayers(["GB", "JP"], "TW", ALL, {} as LayerVisibility)).toEqual([]);
  });

  it("切換目前國家後，原目前國家的開著圖層才會出現", () => {
    const tw = firstKey("TW");
    expect(groupPinnedOpenLayers(["TW", "GB"], "GB", ALL, vis(tw)).map((g) => g.country)).toEqual(["TW"]);
  });

  it("不可見的國家（非站主的 CN）不列", () => {
    const cn = firstKey("CN");
    expect(groupPinnedOpenLayers(["CN"], "TW", new Set<CountryCode>(["TW"]), vis(cn))).toEqual([]);
    expect(groupPinnedOpenLayers(["CN"], "TW", ALL, vis(cn)).map((g) => g.country)).toEqual(["CN"]);
  });

  it("WORLD／SIM 圖層不列入任何國家", () => {
    const worldOnly = getThemeLayerKeys(WORLD_THEMES).filter((k) => !ALL.has("TW") || !countryLayerKeys("GB").includes(k) && !countryLayerKeys("JP").includes(k));
    const simKeys = getThemeLayerKeys(SIMULATION_THEMES);
    const groups = groupPinnedOpenLayers(["GB", "JP"], "TW", ALL, vis(...worldOnly, ...simKeys));
    const listed = new Set(groups.flatMap((g) => g.layers.map((l) => l.key as string)));
    for (const k of [...worldOnly, ...simKeys]) {
      if (!countryLayerKeys("GB").includes(k as never) && !countryLayerKeys("JP").includes(k as never)) expect(listed.has(k)).toBe(false);
    }
  });
});
