import { describe, expect, it } from "vitest";
import { feedCounts } from "../feedCounts";

describe("情報面板數字口徑（IN-1）", () => {
  it("「全部」＝新聞＋沒折疊的警報＋進全部的全球事件", () => {
    const c = feedCounts({ news: 0, alerts: 66, alertsInAll: 11, globalEvents: 5, globalInAll: 3 });
    expect(c.all).toBe(0 + 11 + 3);
    expect(c.news).toBe(0);
    expect(c.alerts).toBe(66);
    expect(c.globalEvents).toBe(5);
  });

  it("警報分頁含折疊區：永遠不小於「全部」裡的警報數", () => {
    for (const [alerts, inAll] of [[0, 0], [3, 3], [66, 11], [10, 0]] as const) {
      const c = feedCounts({ news: 4, alerts, alertsInAll: inAll, globalEvents: 2, globalInAll: 2 });
      expect(c.alerts).toBeGreaterThanOrEqual(inAll);
      expect(c.all - c.news - 2).toBe(inAll);
    }
  });

  it("不含觀察中事件時，「全部」＝新聞＋警報（無折疊）＋全球分頁", () => {
    const c = feedCounts({ news: 7, alerts: 5, alertsInAll: 5, globalEvents: 3, globalInAll: 3 });
    expect(c.all).toBe(c.news + c.alerts + c.globalEvents);
  });

  it("全部為 0 時，每個分頁角標都是 0（不會一邊「共 0 則」一邊有非 0 的總數）", () => {
    const c = feedCounts({ news: 0, alerts: 0, alertsInAll: 0, globalEvents: 0, globalInAll: 0 });
    expect(Object.values(c)).toEqual([0, 0, 0, 0]);
  });

  it("標頭數字取目前分頁的角標", () => {
    const c = feedCounts({ news: 2, alerts: 9, alertsInAll: 4, globalEvents: 1, globalInAll: 1 });
    expect(c["news"]).toBe(2);
    expect(c["all"]).toBe(7);
  });
});
