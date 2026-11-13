import { describe, expect, it } from "vitest";
import { pickDemographicsYearlyResolution } from "../h3Loader";

// 正式站 get_h3_demographics_years.json 的形狀：res7 104–113 年、res8 只有 104–108 年
const available = [
  ...[104, 105, 106, 107, 108, 109, 110, 111, 112, 113].map((year) => ({ year, resolution: 7 })),
  ...[104, 105, 106, 107, 108].map((year) => ({ year, resolution: 8 })),
];

describe("pickDemographicsYearlyResolution（歷史人口網格缺 res8 時改讀 res7）", () => {
  it("113 年沒有 res8：改讀 res7，不去打不存在的檔（VPB-3）", () => {
    expect(pickDemographicsYearlyResolution(available, 113, 8)).toBe(7);
  });

  it("有 res8 的年份照讀 res8", () => {
    expect(pickDemographicsYearlyResolution(available, 106, 8)).toBe(8);
  });

  it("res7 照讀 res7", () => {
    expect(pickDemographicsYearlyResolution(available, 113, 7)).toBe(7);
  });

  it("年份清單讀不到時照原解析度，不猜", () => {
    expect(pickDemographicsYearlyResolution(null, 113, 8)).toBe(8);
    expect(pickDemographicsYearlyResolution([], 113, 8)).toBe(8);
  });

  it("連 res7 都沒有的年份照原解析度（交給 404 處理）", () => {
    expect(pickDemographicsYearlyResolution(available, 114, 8)).toBe(8);
  });
});
