import type { MonitorGridItem } from "./monitorLayout";

/**
 * 把 12 欄座標拆成「欄 / 列」巢狀結構（guillotine 切割），讓高度可以跟著內容走。
 *
 * 為什麼需要：原本 header 以下是固定列高的 CSS grid，widget 的高度＝`h` 寫死。
 * 內容比格子矮就留白、比格子高就格內捲，而且 **grid 的列是跨欄共用的**，
 * 沒辦法「這格長高、把它下面的推下去」——那是 flex 直向堆疊才有的行為。
 *
 * 拆法：反覆找一條「沒有任何 widget 跨過」的切線。
 *  - 找得到縱向切線 → 這塊是**並排的欄**（`cols`），欄寬總和不變 → x/w 完全保留
 *  - 否則找橫向切線 → 這塊是**上下堆疊**（`rows`），順序照 y → 前後關係完全保留
 *  - 兩種都找不到（風車形互卡）→ `grid` 退回原本的固定列高網格，只影響那一小塊
 *
 * 實際佈局（八版）可完整拆解：先橫切 y=12 分成「上方三欄」與「下方左右兩欄」，
 * 再各自往下切。拆完後 `y` 只決定同欄順序，實際位置由內容流出來。
 */

export type MonitorNode =
  /** 單一 widget */
  | { t: "widget"; item: MonitorGridItem }
  /** 並排：children 由左到右，寬度總和 = w */
  | { t: "cols"; w: number; children: MonitorNode[] }
  /** 堆疊：children 由上到下 */
  | { t: "rows"; w: number; children: MonitorNode[] }
  /** 退路：無法切割的區塊，照原本固定列高網格畫（x0/y0 為區塊原點） */
  | { t: "grid"; w: number; x0: number; y0: number; items: MonitorGridItem[] };

/** node 的欄寬（cols 的 children 要靠它決定 gridColumn span） */
export function nodeWidth(n: MonitorNode): number {
  return n.t === "widget" ? n.item.w : n.w;
}

function boundsX(items: MonitorGridItem[]): [number, number] {
  let a = Infinity, b = -Infinity;
  for (const it of items) { if (it.x < a) a = it.x; if (it.x + it.w > b) b = it.x + it.w; }
  return [a, b];
}

function boundsY(items: MonitorGridItem[]): [number, number] {
  let a = Infinity, b = -Infinity;
  for (const it of items) { if (it.y < a) a = it.y; if (it.y + it.h > b) b = it.y + it.h; }
  return [a, b];
}

/** 區間 (lo, hi) 內、沒有任何 item 跨過的切點 */
function cutPoints(
  items: MonitorGridItem[], lo: number, hi: number,
  start: (it: MonitorGridItem) => number, size: (it: MonitorGridItem) => number,
): number[] {
  const cuts: number[] = [];
  for (let c = lo + 1; c < hi; c++) {
    if (items.every((it) => start(it) >= c || start(it) + size(it) <= c)) cuts.push(c);
  }
  return cuts;
}

/** 依切點把 items 分成連續段（可能有空段 → 保留寬度用的空 rows 節點） */
function splitBy(
  items: MonitorGridItem[], lo: number, hi: number, cuts: number[],
  start: (it: MonitorGridItem) => number,
): { lo: number; hi: number; items: MonitorGridItem[] }[] {
  const edges = [lo, ...cuts, hi];
  return edges.slice(0, -1).map((a, k) => {
    const b = edges[k + 1]!;
    return { lo: a, hi: b, items: items.filter((it) => start(it) >= a && start(it) < b) };
  });
}

function decompose(items: MonitorGridItem[]): MonitorNode {
  if (items.length === 1) return { t: "widget", item: items[0]! };

  const [x0, x1] = boundsX(items);
  const vCuts = cutPoints(items, x0, x1, (it) => it.x, (it) => it.w);
  if (vCuts.length) {
    return {
      t: "cols",
      w: x1 - x0,
      children: splitBy(items, x0, x1, vCuts, (it) => it.x).map((seg) =>
        seg.items.length ? decompose(seg.items) : { t: "rows", w: seg.hi - seg.lo, children: [] },
      ),
    };
  }

  const [y0, y1] = boundsY(items);
  const hCuts = cutPoints(items, y0, y1, (it) => it.y, (it) => it.h);
  if (hCuts.length) {
    return {
      t: "rows",
      w: x1 - x0,
      children: splitBy(items, y0, y1, hCuts, (it) => it.y)
        .filter((seg) => seg.items.length)
        .map((seg) => decompose(seg.items)),
    };
  }

  // 互卡（例如風車形）：這塊退回固定列高網格，其餘部分不受影響
  return { t: "grid", w: x1 - x0, x0, y0, items };
}

/** 佈局 → 巢狀節點樹。空陣列回傳空的 rows 節點。 */
export function buildMonitorTree(items: MonitorGridItem[]): MonitorNode {
  if (!items.length) return { t: "rows", w: 0, children: [] };
  return decompose(items);
}

/** 樹裡是否還有無法切割的區塊（測試 / 診斷用） */
export function hasGridFallback(n: MonitorNode): boolean {
  if (n.t === "grid") return true;
  if (n.t === "widget") return false;
  return n.children.some(hasGridFallback);
}

/** 樹上所有 widget（依渲染順序，測試用） */
export function flattenNode(n: MonitorNode): MonitorGridItem[] {
  if (n.t === "widget") return [n.item];
  if (n.t === "grid") return n.items;
  return n.children.flatMap(flattenNode);
}
