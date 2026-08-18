import { describe, it, expect } from "vitest";
import { computeCombinedYRange, type SparklinePoint } from "../TimeseriesSparkline";

/**
 * TimeseriesSparkline 的 Y 值域計算是 view useMemo 內唯一被抽成純函式的部分
 * （其餘為 SVG geometry / hover 狀態，需要 DOM 才能渲染，此專案 vitest 環境是
 * `environment: "node"` 且只 include `*.test.ts`，不接 jsdom/testing-library，
 * 沿用 `src/data/__tests__/layerGoldenExtract.ts` 的既有做法：測純函式而非 SSR 渲染）。
 *
 * 驗兩件事：
 * 1. 不傳 extraSeries 時，計算結果與過去「只用 data 算 min/max」逐位元等價
 *    （PowerCard 既有的備轉率圖、AirportPaxCard、ERCard 都是這個分支，不可變動）。
 * 2. 傳 extraSeries 時，值域必須涵蓋兩條線（否則第二條線會超出畫布，正是本次驗收要求）。
 */
describe("computeCombinedYRange", () => {
  const data: SparklinePoint[] = [
    { t: 1, v: 10 },
    { t: 2, v: 30 },
    { t: 3, v: 20 },
  ];

  it("no extraSeries: 與過去「只用 data 算 min/max」的算法逐位元等價", () => {
    const result = computeCombinedYRange(data);
    expect(result).toEqual({ vMin: 10, vMax: 30 });
  });

  it("no extraSeries + warningValue: 警戒線一起納入值域（既有行為）", () => {
    const result = computeCombinedYRange(data, undefined, 5);
    expect(result).toEqual({ vMin: 5, vMax: 30 });
    const result2 = computeCombinedYRange(data, undefined, 999);
    expect(result2).toEqual({ vMin: 10, vMax: 999 });
  });

  it("empty data: 回傳 null（既有行為，元件據此顯示「無讀值」）", () => {
    expect(computeCombinedYRange([])).toBeNull();
  });

  it("extraSeries 值超出主線範圍時，值域必須涵蓋兩條線", () => {
    const extra: SparklinePoint[] = [
      { t: 1, v: -5 },   // 低於主線 min (10)
      { t: 2, v: 100 },  // 高於主線 max (30)
      { t: 3, v: 40 },
    ];
    const result = computeCombinedYRange(data, extra);
    expect(result).toEqual({ vMin: -5, vMax: 100 });
  });

  it("extraSeries 全落在主線範圍內：值域仍等於主線 min/max（不會因為併入計算而變寬）", () => {
    const extra: SparklinePoint[] = [
      { t: 1, v: 15 },
      { t: 2, v: 25 },
    ];
    const result = computeCombinedYRange(data, extra);
    expect(result).toEqual({ vMin: 10, vMax: 30 });
  });

  it("extraSeries 為空陣列：等同不傳（不應污染值域，例如變成 0 起跳）", () => {
    const result = computeCombinedYRange(data, []);
    expect(result).toEqual({ vMin: 10, vMax: 30 });
  });

  it("extraSeries + warningValue 同時作用：三者一起納入值域", () => {
    const extra: SparklinePoint[] = [{ t: 1, v: 200 }];
    const result = computeCombinedYRange(data, extra, -50);
    expect(result).toEqual({ vMin: -50, vMax: 200 });
  });
});
