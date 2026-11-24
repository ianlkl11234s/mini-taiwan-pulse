import { describe, expect, it } from "vitest";
import { feedCounts } from "../feedCounts";

describe("情報面板數字口徑（IN-1／IN-1b）", () => {
  const RANGES = [0, 8, 76];       // 1H／6H／24H 可能的新聞則數
  const ALERTS = [0, 6, 25, 66];   // 含折疊區的生效中警報
  const GLOBALS = [0, 2, 5];

  it("任何篩選組合下，「全部」＝新聞＋警報＋全球三個分頁角標相加", () => {
    for (const news of RANGES) for (const alerts of ALERTS) for (const globalEvents of GLOBALS) {
      const c = feedCounts({ news, alerts, globalEvents });
      expect(c.all).toBe(c.news + c.alerts + c.globalEvents);
      expect(c.all).toBeGreaterThanOrEqual(Math.max(c.news, c.alerts, c.globalEvents));
    }
  });

  it("站主看到的矛盾情境：全部不再小於警報", () => {
    const c = feedCounts({ news: 8, alerts: 25, globalEvents: 0 });
    expect(c.all).toBe(33);
    expect(c.all).toBeGreaterThanOrEqual(c.alerts);
  });

  it("空狀態一致：全部為 0 時每個角標都是 0；只要有一個分頁非 0，「全部」就非 0", () => {
    expect(Object.values(feedCounts({ news: 0, alerts: 0, globalEvents: 0 }))).toEqual([0, 0, 0, 0]);
    expect(feedCounts({ news: 0, alerts: 3, globalEvents: 0 }).all).toBe(3);
  });

  it("標頭數字取目前分頁的角標", () => {
    const c = feedCounts({ news: 2, alerts: 9, globalEvents: 1 });
    expect(c["news"]).toBe(2);
    expect(c["all"]).toBe(12);
  });
});
