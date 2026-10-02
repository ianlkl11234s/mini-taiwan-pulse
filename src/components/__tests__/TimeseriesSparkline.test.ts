import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { computeCombinedYRange, computeTimeRange, TimeseriesSparkline, type SparklinePoint, type TimeseriesSparklineProps } from "../TimeseriesSparkline";
import { MonitorStyleContext } from "../intel/monitor/monitorStyle";

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

describe("computeTimeRange", () => {
  const day = 24 * 60 * 60;
  const from = 1_700_000_000;
  const data: SparklinePoint[] = [
    { t: from + 10 * day, v: 10 },
    { t: from + 20 * day, v: 20 },
  ];

  it("不傳 timeDomain 時沿用既有 data 首尾範圍", () => {
    expect(computeTimeRange(data)).toEqual({
      tMin: data[0]!.t,
      tMax: data[data.length - 1]!.t,
    });
  });

  it("明示 30d half-open domain 時使用完整 [from, to) 範圍", () => {
    expect(computeTimeRange(data, { from, to: from + 30 * day })).toEqual({
      tMin: from,
      tMax: from + 30 * day,
    });
  });

  it.each([
    { from: 10, to: 10 },
    { from: 11, to: 10 },
    { from: Number.NaN, to: 10 },
    { from: 0, to: Number.POSITIVE_INFINITY },
  ])("無效 domain $from..$to 安全回退到既有範圍", (timeDomain) => {
    expect(computeTimeRange(data, timeDomain)).toEqual({
      tMin: data[0]!.t,
      tMax: data[data.length - 1]!.t,
    });
  });

  it("空資料維持 null，即使有明示 domain 也不渲染空圖", () => {
    expect(computeTimeRange([], { from, to: from + 30 * day })).toBeNull();
  });
});

describe("TimeseriesSparkline monitor v2 (spec §5.35 E3)", () => {
  // 第 3 → 4 點間隔 3 小時 > gapSec 1 小時 → 一個缺口
  const pts: SparklinePoint[] = [
    { t: 0, v: 1 }, { t: 600, v: 2 }, { t: 1200, v: 3 },
    { t: 12_000, v: 2 }, { t: 12_600, v: 4 },
  ];
  const props: TimeseriesSparklineProps = { data: pts, gapSec: 3600 };
  const legacy = (p: TimeseriesSparklineProps) => renderToStaticMarkup(createElement(TimeseriesSparkline, p));
  const v2 = (p: TimeseriesSparklineProps) =>
    renderToStaticMarkup(
      createElement(MonitorStyleContext.Provider, { value: "v2" }, createElement(TimeseriesSparkline, p)),
    );

  it("v2 在斷線缺口畫一條斜線帶（pattern + rect）", () => {
    const html = v2(props);
    expect(html).toContain("<pattern");
    expect(html.match(/data-testid="sparkline-gap"/g)).toHaveLength(1);
  });

  it("v2 在最後一個有值點畫實心最新點（r=2.5）", () => {
    const html = v2(props);
    // 最後一點在右緣（SSR 寬 256 − 右留白 8）
    expect(html).toMatch(/<circle data-testid="sparkline-latest" cx="248" cy="[\d.]+" r="2.5"/);
    expect(html.match(/data-testid="sparkline-latest"/g)).toHaveLength(1);
  });

  it("舊版輸出不含斜線帶與新最新點，維持 r=2.2 末點", () => {
    const html = legacy(props);
    expect(html).not.toContain("<pattern");
    expect(html).not.toContain("sparkline-gap");
    expect(html).not.toContain("sparkline-latest");
    expect(html).toContain('r="2.2"');
    // heightTier 只在有給時生效；不給維持 height 預設 120
    expect(html).toContain('height="120"');
  });

  it("heightTier 讓圖區等於 MON_CHART_H（總高＝圖區＋軸留白）", () => {
    // v2 上留白 10（無單位）／18（有單位，單位字放在留白裡）
    expect(v2({ data: pts, heightTier: "std" })).toContain('height="80"'); // 10 + 48 + 22
    expect(v2({ data: pts, heightTier: "lg" })).toContain('height="128"'); // 10 + 96 + 22
    expect(v2({ data: pts, heightTier: "std", unit: "點" })).toContain('height="88"'); // 18 + 48 + 22
    // 舊版忽略 heightTier，維持預設 height 120（舊版畫面不可變）
    expect(legacy({ data: pts, heightTier: "mini" })).toContain('height="120"');
  });
});

describe("TimeseriesSparkline bare／band（spec §5.35 F3）", () => {
  const pts: SparklinePoint[] = [
    { t: 0, v: 10 }, { t: 3600, v: 20 }, { t: 7200, v: 15 },
  ];
  const legacy = (p: TimeseriesSparklineProps) => renderToStaticMarkup(createElement(TimeseriesSparkline, p));
  const v2 = (p: TimeseriesSparklineProps) =>
    renderToStaticMarkup(
      createElement(MonitorStyleContext.Provider, { value: "v2" }, createElement(TimeseriesSparkline, p)),
    );

  it("v2 bare：無軸字、無格線、無單位字，四邊留白 2（mini 總高 28）", () => {
    const html = v2({ data: pts, heightTier: "mini", bare: true, unit: "MW" });
    expect(html).not.toContain("<text");
    expect(html).not.toContain("stroke-width=\"0.5\""); // 格線
    expect(html).toContain('height="28"'); // 2 + 24 + 2
    // 最後一點貼右緣：256 − 2
    expect(html).toMatch(/data-testid="sparkline-latest" cx="254"/);
  });

  it("v2 非 bare 仍有軸字（對照組）", () => {
    expect(v2({ data: pts, heightTier: "mini" })).toContain("<text");
  });

  it("舊版忽略 bare：輸出與不傳 bare 逐字相同", () => {
    expect(legacy({ data: pts, bare: true })).toBe(legacy({ data: pts }));
  });

  it("band 畫一條色帶 rect，Y 值域把 band 納入", () => {
    expect(computeCombinedYRange(pts, undefined, null, { lo: 5, hi: 40 })).toEqual({ vMin: 5, vMax: 40 });
    // band 落在資料範圍內：值域不變
    expect(computeCombinedYRange(pts, undefined, null, { lo: 12, hi: 18 })).toEqual({ vMin: 10, vMax: 20 });
    const html = v2({ data: pts, heightTier: "std", band: { lo: 5, hi: 40, label: "近 7 天 p10–p90" } });
    expect(html.match(/data-testid="sparkline-band"/g)).toHaveLength(1);
    expect(html).toContain("<title>近 7 天 p10–p90 5.00–40.0</title>");
    // band 擴大值域 → Y 軸頂刻度至少到 40
    const ticks = [...html.matchAll(/<text[^>]*text-anchor="end"[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(40);
  });

  it("不傳 band：無色帶（舊版與 v2 皆然）", () => {
    expect(legacy({ data: pts })).not.toContain("sparkline-band");
    expect(v2({ data: pts })).not.toContain("sparkline-band");
  });
});
