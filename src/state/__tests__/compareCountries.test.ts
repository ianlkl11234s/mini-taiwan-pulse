import { afterEach, describe, expect, it } from "vitest";
import { activeRightCountry, compareSideOf, compareStore, isCountriesCompare, leftMapVisibility, pickRightCountry, shownOnLeft, shownOnRight } from "../compareStore";
import { isRightSideKey, layerCountryOf, rightSideBlocker } from "../../map/compareCountrySides";
import { LAYER_HOOK_REGISTRY } from "../../layers/layerHookRegistry";
import { COUNTRIES } from "../../constants/countries";

describe("兩國並排（compareStore mode=countries）", () => {
  afterEach(() => compareStore.reset());

  it("側別由圖層國家決定：右國 hook 圖層在右、台灣與 WORLD 在左；拉桿側別不影響", () => {
    compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: "GB", sides: { historicalMapSinica: "right" } });
    expect(isCountriesCompare()).toBe(true);
    expect(activeRightCountry()).toBe("GB");
    expect(compareSideOf("gbSchools")).toBe("right");
    expect(shownOnRight("gbSchools", true)).toBe(true);
    expect(shownOnLeft("gbSchools", true)).toBe(false);
    expect(compareSideOf("historicalMapSinica")).toBe("left");
    expect(shownOnLeft("historicalMapSinica", true)).toBe(true);
    expect(shownOnRight("historicalMapSinica", true)).toBe(false);
    expect(compareSideOf("earthquakesGlobal")).toBe("left");
    expect(shownOnRight("gbSchools", false)).toBe(false);
  });

  it("右國的 overlay 圖層畫在右圖（G2-1b）；立體圖層只能畫在主地圖，標出原因", () => {
    expect(layerCountryOf("gbPollutionInventoryEngland")).toBe("GB");
    expect(rightSideBlocker("gbPollutionInventoryEngland", "GB")).toBeNull();
    expect(isRightSideKey("gbPollutionInventoryEngland", "GB")).toBe(true);
    expect(isRightSideKey("jmaAmedas", "JP")).toBe(true);
    expect(rightSideBlocker("jpHistoricalFlightTrails", "JP")).toBe("three");
    expect(rightSideBlocker("gbSchools", "GB")).toBeNull();
    expect(rightSideBlocker("gbSchools", "JP")).toBeNull();
  });

  it("每個 hook host 對任一外國都是「全部右側」或「全部不是」，不會有層兩邊都不畫", () => {
    for (const { code } of COUNTRIES) {
      if (code === "TW") continue;
      for (const { id, keys } of LAYER_HOOK_REGISTRY) {
        const right = keys.filter((key) => isRightSideKey(key, code));
        if (right.length && right.length !== keys.length) throw new Error(`${code} ${id} 混了右側與左側的 key：${keys.join(",")}`);
      }
    }
  });

  it("主地圖的 overlay 開關表：並排時右國圖層讀成 false，其他情況原樣", () => {
    const vis = { jmaAmedas: true, railRoutes: true, gbSchools: true };
    expect(leftMapVisibility(vis)).toBe(vis);
    compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: "JP" });
    expect(leftMapVisibility(vis)).toEqual({ jmaAmedas: false, railRoutes: true, gbSchools: true });
    expect(vis.jmaAmedas).toBe(true);
    compareStore.open("slider");
    expect(leftMapVisibility(vis)).toBe(vis);
  });

  it("右側不能放台灣；換國家清掉右圖鏡頭；拉桿模式不受影響", () => {
    compareStore.setRightCountry("TW");
    expect(compareStore.getSnapshot().rightCountry).toBeNull();
    compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: "GB", rightCamera: { center: [-0.1, 51.5], zoom: 9, pitch: 0, bearing: 0 } });
    expect(compareStore.getSnapshot().rightCamera).not.toBeNull();
    compareStore.setRightCountry("JP");
    expect(compareStore.getSnapshot()).toMatchObject({ rightCountry: "JP", rightCamera: null });
    compareStore.open("slider");
    expect(isCountriesCompare()).toBe(false);
    expect(compareSideOf("jpSchools")).toBe("left");
  });

  it("比例尺同步預設開，可關可開", () => {
    expect(compareStore.getSnapshot().scaleLocked).toBe(true);
    compareStore.setScaleLocked(false);
    expect(compareStore.getSnapshot().scaleLocked).toBe(false);
    compareStore.hydrate({ scaleLocked: true });
    expect(compareStore.getSnapshot().scaleLocked).toBe(true);
  });

  it("預設右側國家：左＝目前國家，右＝下一個釘選的外國；不合法時換掉", () => {
    const visible = ["TW", "JP", "GB", "KR"] as const;
    expect(pickRightCountry("TW", ["TW", "GB", "JP"], visible)).toBe("GB");
    expect(pickRightCountry("GB", ["TW", "GB", "JP"], visible)).toBe("JP");
    expect(pickRightCountry("JP", ["TW", "GB", "JP"], visible)).toBe("GB");
    expect(pickRightCountry("TW", [], visible)).toBe("JP");
    expect(pickRightCountry("TW", ["CN"], visible)).toBe("JP");
    expect(pickRightCountry("TW", ["GB"], visible, "KR")).toBe("KR");
    expect(pickRightCountry("KR", ["GB"], visible, "KR")).toBe("GB");
    expect(pickRightCountry("TW", [], ["TW"])).toBeNull();
  });
});
