import { afterEach, describe, expect, it } from "vitest";
import { loadingRegistry } from "../loadingRegistry";
import { isLayerLoading, isLoadingTaskForLayer } from "../layerLoading";

describe("圖層列載入轉圈：loadingRegistry 任務對回圖層（P1，盡力比對）", () => {
  afterEach(() => {
    for (const task of loadingRegistry.snapshot()) loadingRegistry.end(task.id);
  });

  it("接得到：key 片段、kebab 開頭、manifest sourceId 開頭", () => {
    expect(isLoadingTaskForLayer("statistics-render:statsHealthHospitalBedTotal", "statsHealthHospitalBedTotal")).toBe(true);
    expect(isLoadingTaskForLayer("gfw-dark-vessels:render", "gfwDarkVessels")).toBe(true);
    // newsEvents 的 manifest sourceId 是 news-events
    expect(isLoadingTaskForLayer("news-events:render", "newsEvents")).toBe(true);
    expect(isLoadingTaskForLayer("cctv", "cctv")).toBe(true);
  });

  it("不誤判：字首只在 `:`／`-` 邊界成立；Agent 分析任務不算", () => {
    expect(isLoadingTaskForLayer("cctvx:render", "cctv")).toBe(false);
    expect(isLoadingTaskForLayer("research:registered-layer:cctv", "cctv")).toBe(false);
    expect(isLoadingTaskForLayer("statistics:some_dataset:indicator", "statsHealthHospitalBedTotal")).toBe(false);
  });

  it("isLayerLoading 讀目前任務快照", () => {
    expect(isLayerLoading("gfwDarkVessels")).toBe(false);
    loadingRegistry.start("gfw-dark-vessels:render", "暗船 渲染中");
    expect(isLayerLoading("gfwDarkVessels")).toBe(true);
    loadingRegistry.end("gfw-dark-vessels:render");
    expect(isLayerLoading("gfwDarkVessels")).toBe(false);
  });

  it("冒號後的 sourceId（sourceId 與 layerKey 不同名）也能對回圖層", () => {
    expect(isLoadingTaskForLayer("overlay-hydrate:religion-churches", "religionChurches")).toBe(true);
    expect(isLoadingTaskForLayer("overlay-hydrate:religion-churches-x", "religionChurches")).toBe(true);
    expect(isLoadingTaskForLayer("overlay-hydrate:religionchurches2", "religionChurches")).toBe(false);
  });
});
