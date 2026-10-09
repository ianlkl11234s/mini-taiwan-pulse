/**
 * 地圖圖層生命週期 review 修正的契約測試。這些 hook 的行為綁在 Mapbox 實例與 effect 生命週期上，
 * 本專案沒有 hook 渲染環境，所以以原始碼契約釘住關鍵守則（回歸時紅燈）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fireEventsSparse } from "../useFireEventsLayer";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = (file: string) => fs.readFileSync(path.resolve(dir, "..", file), "utf8");

describe("style.load 重建後維持隱藏（F209／F210）", () => {
  for (const file of ["useFireLatestLayer.ts", "useAnimalWelfarePointsLayer.ts"]) {
    it(`${file} 的 style.load handler 重建後重設 visibility`, () => {
      const text = src(file);
      const handler = text.slice(text.indexOf("const onStyleLoad"), text.indexOf('map.on("style.load"'));
      expect(handler).toContain("setVisible(map, visible)");
    });
  }
});

describe("F181：重開時載入選定日", () => {
  for (const file of ["useAirspaceData.ts", "useShipData.ts"]) {
    it(`${file} 初始載入後若選定日不同就改載選定日`, () => {
      const text = src(file);
      expect(text).toContain("timeStore.getDateKey()");
      expect(text).toContain("loadDateData(selected)");
    });
  }
});

describe("其他生命週期守則", () => {
  it("F159 路況延後路徑登記 loading", () => {
    expect(src("useRoadEventsLayer.ts")).toContain("firstRender");
  });
  it("F014 橋梁雨量監聽並清除 style.load", () => {
    const t = src("useBridgeRainLayer.ts");
    expect(t).toContain('map.on("style.load", apply)');
    expect(t).toContain('map.off("style.load", apply)');
  });
  it("F196 地震圖層獨立於漣漪 RAF 監聽 style.load", () => {
    expect(src("useEarthquakeLayer.ts")).toContain('map.on("style.load", onStyleLoad)');
  });
  it("F228 輪詢以世代號作廢舊請求", () => {
    expect(src("useEnvironmentLiveLayer.ts")).toContain("mine !== generation");
  });
  it("F188 日本宗教 PMTiles 新增 source 時登記 loading", () => {
    expect(src("useJpReligionLayers.ts")).toContain("keepLoadingUntilMapIdle(map");
  });
  it("F194 live→replay 暫停標記 userPausedRef", () => {
    const t = src("useTimeline.ts");
    const fn = t.slice(t.indexOf("const handleSetTimeMode"));
    expect(fn.slice(0, 400)).toContain("userPausedRef.current = true");
  });
  it("F186 村里面以 e.point 精確查詢", () => {
    expect(src("useMapInteraction.ts")).toContain("map.queryRenderedFeatures(e.point, { layers: [BRIDGE_RESILIENCE_LAYER_IDS.villageFill] })");
  });
  it("F220 隱藏中的 CWA 影像不寫 opacity", () => {
    const t = src("useCwaImageryLayer.ts");
    expect(t).toContain("if (cloudVisible) {");
    expect(t).toContain("if (radarVisible) {");
  });
});

describe("F234 火災稀疏子集", () => {
  it("月／日粒度走稀疏（全縮放畫點），全年才用熱區", () => {
    expect(fireEventsSparse("year")).toBe(false);
    expect(fireEventsSparse("month")).toBe(true);
    expect(fireEventsSparse("day")).toBe(true);
  });
});
