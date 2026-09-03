import { describe, expect, it } from "vitest";
import {
  buildMarineHistoryRequest,
  marineHistorySeries,
  marineMetricDatumLabel,
  parseMarineMetrics,
  type MarineHistorySelection,
} from "../marinePanels";

describe("marine observation popup helpers", () => {
  it("accepts Mapbox JSON-string metrics and keeps zero distinct from missing or invalid", () => {
    const metrics = parseMarineMetrics(JSON.stringify([
      {
        metricCode: "tide_twvd",
        depthKey: "surface",
        valueNumeric: 0,
        unitCanonical: "m",
        verticalDatum: "TWVD",
        qualityFlags: { valid: true, missing: false },
      },
      {
        metric_code: "wave_height",
        depth_key: "surface",
        value_numeric: null,
        is_missing: true,
        is_valid: false,
        missing_reason: "source_missing_sentinel",
      },
    ]));

    expect(metrics).toHaveLength(2);
    expect(metrics.find((metric) => metric.metricCode === "tide_twvd")).toMatchObject({
      valueNumeric: 0,
      isMissing: false,
      isValid: true,
      verticalDatum: "TWVD",
    });
    expect(metrics.find((metric) => metric.metricCode === "wave_height")).toMatchObject({
      valueNumeric: null,
      isMissing: true,
      isValid: false,
    });
  });

  it("keeps a missing tide datum explicit instead of implying a shared reference", () => {
    const metrics = parseMarineMetrics(JSON.stringify([{
      metricCode: "tide_height",
      depthKey: "surface",
      valueNumeric: 0.63,
      unitCanonical: "m",
      verticalDatum: null,
      qualityFlags: { valid: true, missing: false },
    }]));

    expect(metrics[0]).toMatchObject({ metricCode: "tide_height", verticalDatum: "" });
    expect(marineMetricDatumLabel("tide_height", metrics[0]!.verticalDatum)).toBe("未提供");
    expect(marineMetricDatumLabel("wind_speed", "")).toBe("");
  });

  it("does not create a history RPC request until a metric is selected", () => {
    const now = Date.parse("2026-08-27T12:00:00Z");
    expect(buildMarineHistoryRequest("cwa:46694", null, "24h", now)).toBeNull();

    const selection: MarineHistorySelection = {
      stationUid: "cwa:46694",
      metricCode: "wave_height",
      depthKey: "surface",
      verticalDatum: "",
      unit: "m",
    };
    const request = buildMarineHistoryRequest("cwa:46694", selection, "24h", now);
    expect(request).toMatchObject({
      stationUid: "cwa:46694",
      metricCode: "wave_height",
      depthKey: "surface",
      to: "2026-08-27T12:00:00.000Z",
      from: "2026-08-26T12:00:00.000Z",
    });
  });

  it("supports a 7-day history window without exceeding the RPC limit", () => {
    const now = Date.parse("2026-08-27T12:00:00Z");
    const selection: MarineHistorySelection = {
      stationUid: "isohe:tp:wind",
      metricCode: "wind_speed",
      depthKey: "surface",
      verticalDatum: "",
      unit: "m/s",
    };
    expect(buildMarineHistoryRequest("isohe:tp:wind", selection, "7d", now)).toMatchObject({
      from: "2026-08-20T12:00:00.000Z",
      to: "2026-08-27T12:00:00.000Z",
      limit: 5000,
    });
  });

  it("excludes missing and invalid history values instead of turning them into zero", () => {
    const result = marineHistorySeries([
      { observedAt: "2026-08-27T10:00:00Z", valueNumeric: 1.2, isMissing: false, isValid: true, verticalDatum: "TWVD" },
      { observedAt: "2026-08-27T10:10:00Z", valueNumeric: null, isMissing: true, isValid: false, verticalDatum: "TWVD" },
      { observedAt: "2026-08-27T10:20:00Z", valueNumeric: null, isMissing: false, isValid: false, verticalDatum: "TWVD" },
      { observedAt: "2026-08-27T10:30:00Z", valueNumeric: 0, isMissing: false, isValid: true, verticalDatum: "TWVD" },
    ], "TWVD");

    expect(result.points).toEqual([
      { t: Date.parse("2026-08-27T10:00:00Z") / 1000, v: 1.2 },
      { t: Date.parse("2026-08-27T10:30:00Z") / 1000, v: 0 },
    ]);
    expect(result.excludedCount).toBe(2);
  });

  it("refuses to merge history with different vertical datums", () => {
    const rows = [
      { observed_at: "2026-08-27T10:00:00Z", value_numeric: 1, is_missing: false, is_valid: true, vertical_datum: "TWVD" },
      { observed_at: "2026-08-27T10:10:00Z", value_numeric: 2, is_missing: false, is_valid: true, vertical_datum: "CDL" },
    ];
    expect(marineHistorySeries(rows, "")).toMatchObject({ points: [], datumConflict: true, datums: ["CDL", "TWVD"] });
    expect(marineHistorySeries(rows, "TWVD").points).toEqual([
      { t: Date.parse("2026-08-27T10:00:00Z") / 1000, v: 1 },
    ]);
  });
});
