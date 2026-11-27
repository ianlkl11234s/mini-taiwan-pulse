import { describe, expect, it } from "vitest";
import {
  buildColorScale, coverageText, fillColorExpr, fillOpacityExpr, gridBase, isNeighbourFilled, quantileBreaks,
  resolveActiveAttr, scoreFieldFor, zeroSplitBreaks, ZERO_SPLIT_EPS, type TerritoryAttribute,
} from "../territoryAttributes";

const attr = (over: Partial<TerritoryAttribute>): TerritoryAttribute => ({ key: "k", label: "屬性", tag: "交通", kind: "count", ...over });

describe("領土格色階斷點", () => {
  it("分位數：用 p20/p40/p60/p80，只留 min < b < max", () => {
    expect(quantileBreaks({ min: 0, max: 100, p20: 0, p40: 10, p60: 30, p80: 100 })).toEqual([10, 30]);
    expect(quantileBreaks({ min: 1, max: 50, p20: 2, p40: 5, p60: 9, p80: 20 })).toEqual([2, 5, 9, 20]);
  });

  it("零值多的個數：0 單獨一階、非零依幾何級數（1→max）分級", () => {
    const stats = { min: 0, max: 81, p20: 0, p40: 0, p60: 0, p80: 0 };
    expect(zeroSplitBreaks(stats, "count")).toEqual([1, 3, 9, 27]);
    const scale = buildColorScale(attr({ kind: "count", stats: { "9": stats } }), true);
    expect(scale.type).toBe("steps");
    if (scale.type !== "steps") return;
    expect(scale.breaksByRes[9]).toEqual([1, 3, 9, 27]);
    expect(scale.zeroSplitRes).toEqual([9]);
  });

  it("零值多的連續值：第一個斷點是 >0（eps），其餘 max/1000→max 幾何級數", () => {
    const b = zeroSplitBreaks({ min: 0, max: 1000, p20: 0, p40: 0, p60: 0, p80: 0 }, "length");
    expect(b?.[0]).toBe(ZERO_SPLIT_EPS);
    expect(b?.slice(1)).toEqual([5.6, 32, 180]);
  });

  it("分位數切得出級距時不走零值分級", () => {
    expect(zeroSplitBreaks({ min: 0, max: 10, p20: 0, p40: 1, p60: 3, p80: 6 }, "count")).toBeNull();
  });

  it("比例 0–1、分數 0–100 用等距五階", () => {
    const r = buildColorScale(attr({ kind: "ratio" }), true);
    const s = buildColorScale(attr({ kind: "score" }), true);
    if (r.type !== "steps" || s.type !== "steps") throw new Error("steps expected");
    expect(r.breaksByRes[9]).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(s.breaksByRes[7]).toEqual([20, 40, 60, 80]);
  });
});

describe("缺值不上色", () => {
  it("格子沒有該欄位 → 灰底顏色與灰底透明度，不當成 0", () => {
    for (const isDark of [true, false]) {
      const a = attr({ kind: "ratio" });
      const expr = fillColorExpr(a, buildColorScale(a, isDark), isDark) as unknown as unknown[];
      expect(expr[0]).toBe("case");
      expect(expr[1]).toEqual(["has", "k"]);
      expect(expr[3]).toBe(gridBase(isDark).fill);
      const op = fillOpacityExpr(a, 0.7, isDark) as unknown as unknown[];
      expect(op).toEqual(["case", ["has", "k"], 0.7, gridBase(isDark).fillOpacity]);
    }
  });

  it("三個解析度都沒有 stats → 整層灰", () => {
    const a = attr({ kind: "count", stats: {} });
    expect(fillColorExpr(a, buildColorScale(a, true), true)).toBe(gridBase(true).fill);
  });
});

describe("全台／縣市內排名切換", () => {
  const list = [
    attr({ key: "score_wealth", label: "財力分數", tag: "標籤", kind: "score" }),
    attr({ key: "score_wealth_cty", label: "財力分數（縣市內）", tag: "標籤", kind: "score" }),
    attr({ key: "farm_ratio", label: "農地面積比", tag: "土地", kind: "ratio" }),
  ];

  it("分數欄名：縣市內加 _cty，一般屬性不變", () => {
    expect(scoreFieldFor("score_wealth", "nation")).toBe("score_wealth");
    expect(scoreFieldFor("score_wealth", "county")).toBe("score_wealth_cty");
    expect(scoreFieldFor("farm_ratio", "county")).toBe("farm_ratio");
  });

  it("縣市內：上色欄換成 _cty，標題加後綴；一般屬性不受影響", () => {
    expect(resolveActiveAttr(list, "score_wealth", "nation", "（縣市內）", "財力")).toMatchObject({ key: "score_wealth", label: "財力" });
    expect(resolveActiveAttr(list, "score_wealth", "county", "（縣市內）", "財力")).toMatchObject({ key: "score_wealth_cty", label: "財力（縣市內）" });
    expect(resolveActiveAttr(list, "farm_ratio", "county", "（縣市內）")).toMatchObject({ key: "farm_ratio", label: "農地面積比" });
    expect(resolveActiveAttr(list, null, "county", "（縣市內）")).toBeNull();
  });
});

describe("房價取自周邊（sale_median_src_res）", () => {
  it("只有 res9 且 src_res=8 時，財力與房價中位數加小標", () => {
    const filled = { res: 9, sale_median_src_res: 8 };
    expect(isNeighbourFilled(filled, "score_wealth")).toBe(true);
    expect(isNeighbourFilled(filled, "score_wealth_cty")).toBe(true);
    expect(isNeighbourFilled(filled, "sale_unit_price_median")).toBe(true);
    expect(isNeighbourFilled(filled, "sale_count")).toBe(false);
    expect(isNeighbourFilled({ res: 9, sale_median_src_res: 9 }, "score_wealth")).toBe(false);
    expect(isNeighbourFilled({ res: 8, sale_median_src_res: 8 }, "score_wealth")).toBe(false);
    expect(isNeighbourFilled({ res: 9 }, "score_wealth")).toBe(false);
  });
});

describe("涵蓋範圍白話", () => {
  const allExcept = (list: string) => `全台（不含${list}）`;
  it("全台不寫、縣市過半改寫成不含、少數縣市列出", () => {
    expect(coverageText(attr({ coverage: "全台" }), allExcept)).toBeNull();
    expect(coverageText(attr({ coverage: ["臺北市", "新北市"] }), allExcept)).toBe("臺北市、新北市");
    const most = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣"];
    expect(coverageText(attr({ coverage: most }), allExcept)).toBe("全台（不含金門縣、連江縣）");
  });
});
