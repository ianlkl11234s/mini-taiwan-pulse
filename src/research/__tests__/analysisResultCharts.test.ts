import { describe, expect, it } from "vitest";
import { isCompareSeriesRow, seriesTrendLineData, shortTaipeiDateLabel, warehouseSeriesTrendLineData } from "../analysisResultCharts";
import type { WarehouseResultStyle } from "../warehouseResultStyle";

describe("isCompareSeriesRow", () => {
  it("recognises a compare_series row by its closed status set", () => {
    expect(isCompareSeriesRow({ period_start: "2026-09-01T00:00:00+08:00", current_value: 4, baseline_value: 2, value: 2, status: "valid" })).toBe(true);
    expect(isCompareSeriesRow({ period_start: "2026-09-01T00:00:00+08:00", current_value: null, baseline_value: 2, value: null, status: "missing_current" })).toBe(true);
  });

  it("treats a plain read_series row (no status field) as not a compare_series row", () => {
    expect(isCompareSeriesRow({ period_start: "2026-09-01T00:00:00+08:00", value: 4, records: 2, missing_value: 0 })).toBe(false);
  });
});

describe("shortTaipeiDateLabel", () => {
  it("slices the fixed-width Taipei ISO period_start into MM/DD, without any further date math", () => {
    expect(shortTaipeiDateLabel("2026-09-21T00:00:00+08:00")).toBe("09/21");
    expect(shortTaipeiDateLabel("2026-01-05T00:00:00+08:00")).toBe("01/05");
  });

  it("returns anything not in that shape verbatim", () => {
    expect(shortTaipeiDateLabel("not-a-date")).toBe("not-a-date");
  });
});

describe("seriesTrendLineData", () => {
  it("maps read_series rows straight to points with no baseline", () => {
    const rows = [
      { period_start: "2026-09-01T00:00:00+08:00", value: 4, records: 1, missing_value: 0 },
      { period_start: "2026-09-02T00:00:00+08:00", value: null, records: 1, missing_value: 1 },
    ];
    const data = seriesTrendLineData(rows, "items");
    expect(data.baseline).toBeUndefined();
    expect(data.points).toEqual([
      { id: "2026-09-01T00:00:00+08:00", label: "09/01", value: 4 },
      { id: "2026-09-02T00:00:00+08:00", label: "09/02", value: null },
    ]);
    expect(data.valueKind).toBe("count");
  });

  it("maps compare_series rows to index-aligned points (current) and baseline (baseline_value)", () => {
    const rows = [
      { period_start: "2026-09-01T00:00:00+08:00", current_value: 10, baseline_value: 8, value: 1.25, status: "valid" },
      { period_start: "2026-09-02T00:00:00+08:00", current_value: null, baseline_value: 5, value: null, status: "missing_current" },
    ];
    const data = seriesTrendLineData(rows, "件");
    expect(data.points).toEqual([
      { id: "2026-09-01T00:00:00+08:00", label: "09/01", value: 10 },
      { id: "2026-09-02T00:00:00+08:00", label: "09/02", value: null },
    ]);
    expect(data.baseline).toEqual([
      { id: "2026-09-01T00:00:00+08:00", label: "09/01", value: 8 },
      { id: "2026-09-02T00:00:00+08:00", label: "09/02", value: 5 },
    ]);
  });

  it("falls back to the baseline's own sample value for valueKind when every current point is null", () => {
    const rows = [{ period_start: "2026-09-01T00:00:00+08:00", current_value: null, baseline_value: 12.5, value: null, status: "missing_current" }];
    const data = seriesTrendLineData(rows, null);
    expect(data.valueKind).toBe("ratio"); // 12.5 is non-integer -> ratio, per classifyVizNumberKind's shape guess
  });

  it("defaults to count valueKind for an entirely empty series (no rows at all)", () => {
    expect(seriesTrendLineData([], null).valueKind).toBe("count");
  });
});

describe("warehouseSeriesTrendLineData", () => {
  const withBaseline = {
    kind: "series", timeField: "m", valueField: "v", baselineField: "ly", baselineLabel: "去年同期",
    title: "事故件數", unit: "件", valueKind: "count",
    periods: ["2024-01-01", "2024-02-01", "2024-03-01"], periodUnit: "month", values: [10, null, 30], baseline: [8, 20, 25],
    min: 10, max: 30, latest: { period: "2024-03-01", value: 30 }, nullCount: 1,
  } as const satisfies WarehouseResultStyle;

  it("maps periods/values/baseline straight to index-aligned TrendLine points, with short Taipei date labels", () => {
    const data = warehouseSeriesTrendLineData(withBaseline);
    expect(data.points).toEqual([
      { id: "2024-01-01", label: "01/01", value: 10 },
      { id: "2024-02-01", label: "02/01", value: null },
      { id: "2024-03-01", label: "03/01", value: 30 },
    ]);
    expect(data.baseline).toEqual([
      { id: "2024-01-01", label: "01/01", value: 8 },
      { id: "2024-02-01", label: "02/01", value: 20 },
      { id: "2024-03-01", label: "03/01", value: 25 },
    ]);
    expect(data.title).toBe("事故件數");
    expect(data.unit).toBe("件");
    expect(data.baselineLabel).toBe("去年同期");
    expect(data.valueKind).toBe("count");
    expect(data.latestText).toBe("30");
  });

  it("omits baseline when the style has none, and says 無資料 for a null latest value", () => {
    const noBaseline = { ...withBaseline, baselineField: null, baselineLabel: null, baseline: null, latest: { period: "2024-03-01", value: null } } as const satisfies WarehouseResultStyle;
    const data = warehouseSeriesTrendLineData(noBaseline);
    expect(data.baseline).toBeUndefined();
    expect(data.baselineLabel).toBeNull();
    expect(data.latestText).toBe("無資料");
  });
});
