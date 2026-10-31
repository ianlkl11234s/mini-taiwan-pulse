import { describe, expect, it } from "vitest";
import {
  buildHintRows,
  createLayerHintDismissal,
  findHiddenLayers,
  formatZoom,
  layerHintSeeds,
  matchStyleLayers,
  visibleRange,
  type HiddenLayer,
  type HintStyleLayer,
  type VisibleRange,
} from "../layerVisibilityHint";

const UK_Z54: [number, number, number, number] = [-12, 49, 4, 59]; // 全英視野（含倫敦）
const MANCHESTER_Z12: [number, number, number, number] = [-2.35, 53.43, -2.15, 53.53];
const range = (start: number, end = 24): VisibleRange => ({ start, visibleAt: (z) => z >= start && z < end });

describe("visibleRange：可見起點", () => {
  const noSrc = () => undefined;
  it("取開著的子圖層 max(layer.minzoom, source.minzoom) 的最小值", () => {
    const layers: HintStyleLayer[] = [
      { id: "a-circle", type: "circle", source: "a", minzoom: 10 },
      { id: "a-label", type: "symbol", source: "a", minzoom: 12 },
    ];
    expect(visibleRange(layers, noSrc)?.start).toBe(10);
    // 圖磚 minzoom 比 layer 晚 → 以圖磚為準
    expect(visibleRange(layers, (id) => (id === "a" ? 11 : undefined))?.start).toBe(11);
  });
  it("熱區拉遠就畫 → 可見起點是熱區的縮放，不算看不到", () => {
    const layers: HintStyleLayer[] = [
      { id: "kr-bridges-heatmap", type: "heatmap", source: "kr-bridges", maxzoom: 10 },
      { id: "kr-bridges-circle", type: "circle", source: "kr-bridges", minzoom: 10 },
    ];
    const r = visibleRange(layers, noSrc)!;
    expect(r.start).toBe(0);
    expect(r.visibleAt(6)).toBe(true);
  });
  it("visibility none 的子圖層不算；全部關著或沒有 → null（不判斷）", () => {
    expect(visibleRange([{ id: "x", type: "heatmap", source: "s", layout: { visibility: "none" } }], noSrc)).toBeNull();
    expect(visibleRange([], noSrc)).toBeNull();
    const r = visibleRange([
      { id: "h", type: "heatmap", source: "s", layout: { visibility: "none" } },
      { id: "c", type: "circle", source: "s", minzoom: 9 },
    ], noSrc)!;
    expect(r.start).toBe(9);
  });
});

describe("matchStyleLayers：key 找得到自己的 style layer", () => {
  it("點擊登記簿的 id、同字首與同 source 的熱區都算", () => {
    const style: HintStyleLayer[] = [
      { id: "kr-bridges-circle", type: "circle", source: "kr-bridges", minzoom: 10 },
      { id: "kr-bridges-heatmap", type: "heatmap", source: "kr-bridges", maxzoom: 10 },
      { id: "density", type: "heatmap", source: "kr-bridges" },
      { id: "other-circle", type: "circle", source: "other" },
    ];
    const got = matchStyleLayers({ ids: new Set(["kr-bridges-circle"]), sources: new Set() }, style).map((l) => l.id);
    expect(got.sort()).toEqual(["density", "kr-bridges-circle", "kr-bridges-heatmap"]);
  });
  it("倫敦車站從 manifest popup 反查到點擊登記簿的 style layer", () => {
    expect(layerHintSeeds("gbLondonStations").ids.has("gb-london-stations-circle")).toBe(true);
  });
});

describe("findHiddenLayers：兩種原因", () => {
  it("縮放不到 → zoom；局部層 → coverage（視野含倫敦但不到 z10 也算）", () => {
    const hidden = findHiddenLayers({
      keys: ["gbSmallAreaBoundaries", "gbLondonStations", "gbPowerPlants"],
      zoom: 5.4,
      bounds: UK_Z54,
      rangeFor: (k) => (k === "gbSmallAreaBoundaries" ? range(8) : k === "gbLondonStations" ? range(10) : range(0)),
    });
    expect(hidden).toEqual([
      { key: "gbSmallAreaBoundaries", reason: "zoom", start: 8, needZoom: true },
      { key: "gbLondonStations", reason: "coverage", start: 10, needZoom: true, area: "london" },
    ]);
  });
  it("縮放夠但視野不在資料範圍 → coverage、不需放大", () => {
    const [h] = findHiddenLayers({ keys: ["gbLondonStations"], zoom: 12, bounds: MANCHESTER_Z12, rangeFor: () => range(10) });
    expect(h).toMatchObject({ reason: "coverage", needZoom: false, area: "london" });
  });
  it("局部層在範圍內且縮放夠 → 看得到；找不到 style layer 的非局部層不判斷", () => {
    expect(findHiddenLayers({ keys: ["gbLondonStations"], zoom: 11, bounds: [-0.2, 51.45, 0, 51.55], rangeFor: () => range(10) })).toEqual([]);
    expect(findHiddenLayers({ keys: ["gbPowerPlants"], zoom: 3, bounds: UK_Z54, rangeFor: () => null })).toEqual([]);
  });
  it("找不到 style layer 的局部層：只判斷資料範圍", () => {
    const [h] = findHiddenLayers({ keys: ["statsKrSeoulLivingPopSgg"], zoom: 7, bounds: [128.5, 35, 129.5, 35.5], rangeFor: () => null });
    expect(h).toMatchObject({ reason: "coverage", start: null, needZoom: false, area: "seoul" });
  });
});

describe("buildHintRows：合併與上限", () => {
  const h = (key: string, reason: "zoom" | "coverage", start: number | null, area?: "london" | "seoul"): HiddenLayer =>
    ({ key, reason, start, needZoom: start !== null, ...(area ? { area } : {}) });
  it("同一目的地合併一列（倫敦兩層一個「前往倫敦」，縮放取最大）", () => {
    const { rows, more, total } = buildHintRows([h("gbSmallAreaBoundaries", "zoom", 8), h("gbLondonStations", "coverage", 10, "london"), h("gbLondonJamCams", "coverage", 11, "london")]);
    expect(total).toBe(3);
    expect(more).toBe(0);
    expect(rows.map((r) => [r.kind, r.keys, r.showZoom, r.targetZoom])).toEqual([
      ["zoom", ["gbSmallAreaBoundaries"], 8, 8],
      ["coverage", ["gbLondonStations", "gbLondonJamCams"], 11, 11],
    ]);
  });
  it("同縮放的放大列合併", () => {
    expect(buildHintRows([h("a", "zoom", 9), h("b", "zoom", 9)]).rows).toHaveLength(1);
  });
  it("最多列 4 層，其餘算進「還有 N 個」", () => {
    const hidden = ["a", "b", "c", "d", "e", "f"].map((k, i) => h(k, "zoom", 8 + i));
    const { rows, more } = buildHintRows(hidden);
    expect(rows.flatMap((r) => r.keys)).toEqual(["a", "b", "c", "d"]);
    expect(more).toBe(2);
    // 合併列跨過上限時截斷
    const merged = buildHintRows(["a", "b", "c", "d", "e"].map((k) => h(k, "coverage", 10, "london")));
    expect(merged.rows[0]?.keys).toHaveLength(4);
    expect(merged.more).toBe(1);
  });
  it("formatZoom", () => {
    expect(formatZoom(8)).toBe("8");
    expect(formatZoom(5.5)).toBe("5.5");
  });
});

describe("createLayerHintDismissal：知道了", () => {
  it("收起後同一批看不到的層不再出現", () => {
    const d = createLayerHintDismissal();
    expect(d.update(["a", "b"], "a,b")).toBe(false);
    d.dismiss(["a", "b"], "a,b");
    expect(d.update(["a", "b"], "a,b")).toBe(true);
    expect(d.update(["a"], "a,b")).toBe(true); // b 變看得到
  });
  it("開關圖層 → 重新出現", () => {
    const d = createLayerHintDismissal();
    d.dismiss(["a"], "a");
    expect(d.update(["a"], "a,c")).toBe(false);
  });
  it("某層從看得到變看不到 → 重新出現", () => {
    const d = createLayerHintDismissal();
    d.dismiss(["a", "b"], "a,b");
    expect(d.update(["a"], "a,b")).toBe(true); // b 看得到了
    expect(d.update(["a", "b"], "a,b")).toBe(false); // b 又看不到
  });
  it("收起時沒看到的新層變看不到 → 重新出現", () => {
    const d = createLayerHintDismissal();
    d.dismiss(["a"], "a,b");
    expect(d.update(["a", "b"], "a,b")).toBe(false);
  });
});
