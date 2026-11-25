import { describe, expect, it } from "vitest";
import { isFeatureDependent, lineUsesStencilPass, orderHitsByVisibleTop } from "../translucentLineHitOrder";

// LINESORT-1：同層兩條線重疊時，點選要選到畫面上最上面那條。
// Mapbox 查詢結果同圖層同圖磚是「後畫的在前」；半透明線（stencil）畫面上卻是「先畫的在上」。
const hit = (name: string, layer = "id-tj-routes-line", tile = 1) => ({ name, layer: { id: layer }, tile: { key: tile } });
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("lineUsesStencilPass（對照 mapbox-gl drawLine 的 stencil 條件）", () => {
  it("半透明常數線 → stencil（先畫的在上）", () => {
    expect(lineUsesStencilPass({ type: "line", rawOpacity: 0.85, evaluatedOpacity: 0.85, pattern: undefined })).toBe(true);
  });
  it("縮放內插的透明度以當下算出的值判斷", () => {
    const raw = ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1];
    expect(lineUsesStencilPass({ type: "line", rawOpacity: raw, evaluatedOpacity: 0.7, pattern: undefined })).toBe(true);
    expect(lineUsesStencilPass({ type: "line", rawOpacity: raw, evaluatedOpacity: 1, pattern: undefined })).toBe(false);
  });
  it("不透明、透明度 0、資料驅動、有 pattern、非線層 → 不是 stencil", () => {
    expect(lineUsesStencilPass({ type: "line", rawOpacity: 1, evaluatedOpacity: 1, pattern: undefined })).toBe(false);
    expect(lineUsesStencilPass({ type: "line", rawOpacity: 0, evaluatedOpacity: 0, pattern: undefined })).toBe(false);
    expect(lineUsesStencilPass({ type: "line", rawOpacity: ["case", ["get", "x"], 0.5, 0.8], evaluatedOpacity: 0.5, pattern: undefined })).toBe(false);
    expect(lineUsesStencilPass({ type: "line", rawOpacity: 0.85, evaluatedOpacity: 0.85, pattern: "dots" })).toBe(false);
    expect(lineUsesStencilPass({ type: "circle", rawOpacity: 0.85, evaluatedOpacity: 0.85, pattern: undefined })).toBe(false);
  });
  it("isFeatureDependent 認得 get／feature-state／舊式 property function", () => {
    expect(isFeatureDependent(["feature-state", "hover"])).toBe(true);
    expect(isFeatureDependent({ property: "v", stops: [[0, 0.2]] })).toBe(true);
    expect(isFeatureDependent(["interpolate", ["linear"], ["zoom"], 5, 0.4, 12, 0.9])).toBe(false);
  });
});

describe("orderHitsByVisibleTop", () => {
  const stencil = () => true;
  it("TransJakarta 案例：Mapbox 回傳 [藍 8M, 紅 BRT 8]，半透明時畫面上是紅線 → 改成紅線在前", () => {
    const queried = [hit("8M-整合"), hit("8-BRT")];
    expect(names(orderHitsByVisibleTop(queried, stencil))[0]).toBe("8-BRT");
  });
  it("不透明線層（滑桿拉到 100%）維持 Mapbox 原順序", () => {
    expect(names(orderHitsByVisibleTop([hit("a"), hit("b")], () => false))).toEqual(["a", "b"]);
  });
  it("跨圖層的先後不變，只反轉各圖層自己的段", () => {
    const queried = [hit("p1", "points"), hit("p2", "points"), hit("a", "lines"), hit("b", "lines")];
    const out = orderHitsByVisibleTop(queried, (id) => id === "lines");
    expect(names(out)).toEqual(["p1", "p2", "b", "a"]);
  });
  it("兩張圖磚各自反轉、圖磚先後不變", () => {
    const queried = [hit("a", "l", 1), hit("b", "l", 1), hit("c", "l", 2), hit("d", "l", 2)];
    expect(names(orderHitsByVisibleTop(queried, stencil))).toEqual(["b", "a", "d", "c"]);
  });
  it("只有一筆或空陣列不變", () => {
    expect(names(orderHitsByVisibleTop([hit("a")], stencil))).toEqual(["a"]);
    expect(orderHitsByVisibleTop([], stencil)).toEqual([]);
  });
});
