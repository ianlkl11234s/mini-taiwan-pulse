import { describe, expect, it } from "vitest";
import { MONITOR_VISIBLE_LAYOUT, type MonitorGridItem } from "../monitorLayout";
import { buildMonitorTree, flattenNode, hasGridFallback, nodeWidth } from "../monitorPacking";

describe("monitorPacking", () => {
  it("實際佈局可完整拆解（不需要退回固定網格）", () => {
    const tree = buildMonitorTree(MONITOR_VISIBLE_LAYOUT);
    expect(hasGridFallback(tree)).toBe(false);
  });

  it("拆解後 widget 不重不漏", () => {
    const tree = buildMonitorTree(MONITOR_VISIBLE_LAYOUT);
    const ids = flattenNode(tree).map((it) => it.i).sort();
    const expected = MONITOR_VISIBLE_LAYOUT.map((it) => it.i).sort();
    expect(ids).toEqual(expected);
  });

  it("cols 節點的子寬度總和 = 自身寬度（x/w 不會被拆壞）", () => {
    const walk = (n: ReturnType<typeof buildMonitorTree>): void => {
      if (n.t === "cols") {
        expect(n.children.reduce((s, c) => s + nodeWidth(c), 0)).toBe(n.w);
        n.children.forEach(walk);
      } else if (n.t === "rows") {
        // 堆疊：每個 child 都應佔滿整欄寬
        n.children.forEach((c) => { expect(nodeWidth(c)).toBe(n.w); walk(c); });
      }
    };
    walk(buildMonitorTree(MONITOR_VISIBLE_LAYOUT));
  });

  // 這條守的是「新增 widget 時最容易踩、但畫面上要開起來才看得到」的坑：
  // 左欄止於某個 y 之後，右欄若還有任何一條格線，那條線就是**貫穿全寬**的橫切線，
  // guillotine 會先在那裡把版面切成上下兩段 —— 右欄底部那塊於是從「右欄」變成
  // 撐滿 12 欄的獨立區塊（寬度爆掉、與上方右欄對不齊）。
  // 新 widget 要接在右欄下方時，左欄必須有格子跨過那條線，或改插進右欄中段。
  it("頂層拆成「上方三欄」+「下方左右兩欄（5 + 7）」", () => {
    const tree = buildMonitorTree(MONITOR_VISIBLE_LAYOUT);
    expect(tree.t).toBe("rows");
    if (tree.t !== "rows") return;
    expect(tree.children).toHaveLength(2);
    const bottom = tree.children[1]!;
    expect(bottom.t).toBe("cols");
    if (bottom.t !== "cols") return;
    expect(bottom.children.map(nodeWidth)).toEqual([5, 7]);
  });

  it("互卡佈局（風車形）退回固定網格而不是掉 widget", () => {
    // 四塊繞著中心互卡，找不到任何一條完整切線
    const pinwheel = [
      { i: "a", x: 0, y: 0, w: 2, h: 1 },
      { i: "b", x: 2, y: 0, w: 1, h: 2 },
      { i: "c", x: 1, y: 1, w: 2, h: 1 },
      { i: "d", x: 0, y: 1, w: 1, h: 1 },
    ] as unknown as MonitorGridItem[];
    const tree = buildMonitorTree(pinwheel);
    expect(hasGridFallback(tree)).toBe(true);
    expect(flattenNode(tree)).toHaveLength(4);
  });

  it("空佈局不會爆", () => {
    expect(flattenNode(buildMonitorTree([]))).toEqual([]);
  });
});
