import { describe, expect, it } from "vitest";
import { isCompareSeriesRow, seriesTrendLineData, shortTaipeiDateLabel } from "../analysisResultCharts";

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
