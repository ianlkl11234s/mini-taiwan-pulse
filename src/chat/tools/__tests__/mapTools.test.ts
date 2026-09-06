import { beforeEach, describe, expect, it } from "vitest";
import { mapTools } from "../mapTools";
import type { MapBridge } from "../../types";
import { layerVisibilityStore } from "../../../state/layerVisibilityStore";
import { statisticsDisplayModeStore } from "../../../state/statisticsDisplayModeStore";

beforeEach(() => {
  layerVisibilityStore.reset();
  statisticsDisplayModeStore.reset();
});

describe("mapTools.set_layers", () => {
  it("回報 admission 後實際可見的統計面與被替換面，而非請求數量", async () => {
    const visible = new Set<string>(["statsWasteCounty"]);
    const bridge: MapBridge = {
      bulkSetVisibility: (keys, on) => {
        if (!on) keys.forEach((key) => visible.delete(key));
        else {
          // 模擬 single-mode admission：crime choropleth 替換既有 recipe，但 boundary 留下。
          if (keys.includes("crimeAreaMonthly")) {
            visible.delete("statsWasteCounty");
            visible.add("crimeAreaMonthly");
          }
          if (keys.includes("countyBoundary")) visible.add("countyBoundary");
        }
      },
      allOff: () => visible.clear(),
      flyTo: () => {},
      jumpToPlace: () => true,
      highlightPoint: () => {},
      getVisibleLayerKeys: () => [...visible],
      getCurrentTimeISO: () => "2026-09-06T00:00:00.000Z",
      getCamera: () => ({ lng: 121, lat: 24, zoom: 7 }),
    };
    const tool = mapTools(bridge).set_layers as unknown as {
      execute: (input: { keys: string[]; visible: boolean }) => Promise<{
        visibleStatistics: string[];
        replacedStatistics: string[];
        visibleNow: string[];
      }>;
    };

    const result = await tool.execute({ keys: ["crimeAreaMonthly", "countyBoundary"], visible: true });

    expect(result.visibleStatistics).toEqual(["crimeAreaMonthly"]);
    expect(result.replacedStatistics).toEqual(["statsWasteCounty"]);
    expect(result.visibleNow).toEqual(expect.arrayContaining(["crimeAreaMonthly", "countyBoundary"]));
  });

  it("render ref 尚未更新時仍從同步 store 回報 post-write 結果", async () => {
    layerVisibilityStore.setVisibility("statsWasteCounty", true);
    const renderLaggedVisibility = layerVisibilityStore.getAll();
    const bridge: MapBridge = {
      bulkSetVisibility: (keys, on) => {
        let next = layerVisibilityStore.getAll();
        if (on && keys.includes("crimeAreaMonthly")) {
          next = statisticsDisplayModeStore.enable("crimeAreaMonthly", next);
        }
        if (on && keys.includes("countyBoundary")) next = { ...next, countyBoundary: true };
        layerVisibilityStore.setAll(next);
      },
      allOff: () => layerVisibilityStore.reset(),
      flyTo: () => {},
      jumpToPlace: () => true,
      highlightPoint: () => {},
      // 對應 App 修正後的 bridge；不可改為讀 renderLaggedVisibility。
      getVisibleLayerKeys: () => Object.entries(layerVisibilityStore.getAll()).filter(([, on]) => on).map(([key]) => key),
      getCurrentTimeISO: () => "2026-09-06T00:00:00.000Z",
      getCamera: () => ({ lng: 121, lat: 24, zoom: 7 }),
    };
    const tool = mapTools(bridge).set_layers as unknown as {
      execute: (input: { keys: string[]; visible: boolean }) => Promise<{
        visibleStatistics: string[];
        replacedStatistics: string[];
      }>;
    };

    const result = await tool.execute({ keys: ["crimeAreaMonthly", "countyBoundary"], visible: true });

    // 模擬 React 尚未 re-render：舊 ref 還是過去狀態，不能當 tool 的 readback。
    expect(renderLaggedVisibility.statsWasteCounty).toBe(true);
    expect(result.visibleStatistics).toEqual(["crimeAreaMonthly"]);
    expect(result.replacedStatistics).toEqual(["statsWasteCounty"]);
  });
});
