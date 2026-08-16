import { describe, expect, it } from "vitest";
import { MONITOR_VISIBLE_LAYOUT, type MonitorGridItem } from "../monitorLayout";
import { buildMonitorTree, flattenNode, hasGridFallback, nodeWidth } from "../monitorPacking";
import { MONITOR_SPLIT_VISIBLE_LAYOUT } from "../monitorSplitLayout";

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

describe("monitorPacking · split dock（右半邊窄版）", () => {
  const items = MONITOR_SPLIT_VISIBLE_LAYOUT;

  it("窄版佈局可完整拆解（不需要退回固定網格）", () => {
    expect(hasGridFallback(buildMonitorTree(items))).toBe(false);
  });

  it("任兩格矩形不重疊", () => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
        const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
        expect(xOverlap && yOverlap, `${a.i} 與 ${b.i} 重疊`).toBe(false);
      }
    }
  });

  it("拆解後 widget 不重不漏", () => {
    const ids = flattenNode(buildMonitorTree(items)).map((it) => it.i).sort();
    expect(ids).toEqual(items.map((it) => it.i).sort());
  });

  // 這條是「尾段被切成全寬區塊」那個坑的**通用守門**（dock 版同名測試守的是同一件事）：
  // 若某段區域只剩單欄有內容、而該處又是一條貫穿全寬的橫切線，那塊就會從「某一欄」
  // 變成撐滿 12 欄的獨立區塊 —— 寬度爆掉時這裡的寬度守恆就會紅。
  //
  // 註：2026-08-16 的沙盒定稿改成「上半 2 欄 ＋ 下半全寬縱向流」，全寬是刻意的，
  // 因此不再用「左右兩欄尾段 max(y+h) 相等」那條特化斷言（它假設下半是長段兩欄，
  // 且會把 w12 的格子誤算進左欄）。結構健全性交給這條通用檢查。
  it("cols 子寬度總和 = 自身寬度、rows 子節點佔滿整欄寬", () => {
    const walk = (n: ReturnType<typeof buildMonitorTree>): void => {
      if (n.t === "cols") {
        expect(n.children.reduce((s, c) => s + nodeWidth(c), 0)).toBe(n.w);
        n.children.forEach(walk);
      } else if (n.t === "rows") {
        n.children.forEach((c) => { expect(nodeWidth(c)).toBe(n.w); walk(c); });
      }
    };
    walk(buildMonitorTree(items));
  });

  // 上半（y0–14）是刻意的兩欄結構：左 = 新聞 Feed + 信號分級、右 = 時間軸 → 警訊 → 熱區。
  // 兩欄同止於 y17（左 newsFeed h14 + triage h3、右 timeline h6 + alertBoard h6 + hotZones h5），
  // y17 才是第一條乾淨的全寬切線。這條守住上半不被拆壞成全寬堆疊。
  it("上半拆成左右兩欄 cols(6, 6)", () => {
    const tree = buildMonitorTree(items);
    expect(tree.t).toBe("rows");
    if (tree.t !== "rows") return;
    const head = tree.children[0]!;
    expect(head.t).toBe("cols");
    if (head.t !== "cols") return;
    expect(head.children.map(nodeWidth)).toEqual([6, 6]);
  });
});
