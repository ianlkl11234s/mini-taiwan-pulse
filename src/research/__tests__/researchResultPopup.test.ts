import { describe, expect, it } from "vitest";
import { UNNAMED_DATASET_LABEL, researchResultDatasetLabel, researchResultPanelProperties, researchResultPopupDistance, researchResultPopupFacts, researchResultPopupOverlaps, researchResultPopupTitle, researchResultRecordFacts, type ResearchResultPopupOverlapFeature } from "../researchResultPopup";

describe("researchResultPopupFacts", () => {
  it("keeps original and normalized values distinct, including their units", () => {
    expect(researchResultPopupFacts({ status: "observed", value: 20, unit: "cases", normalizedValue: 12.5, normalizedUnit: "cases per 10000 persons", normalization_status: "valid", comparison_status: "valid", absoluteDifference: 10, differenceUnit: "raw cases", ratio: 2 })).toEqual([
      { label: "原始值", value: "20 cases" },
      { label: "標準化值", value: "12.5 cases per 10000 persons" },
      { label: "比較基準", value: "本區÷基準；可比較" },
      { label: "差值（本區－基準）", value: "10 raw cases" },
      { label: "相對基準（本區÷基準）", value: "2" },
    ]);
  });

  it("preserves missing, suppression, denominator, and baseline states without inventing values or units", () => {
    expect(researchResultPopupFacts({ status: "suppressed", value: null, normalizedValue: null, normalization_status: "denominator_suppressed", comparison_status: "baseline_zero" })).toEqual([
      { label: "原始值狀態", value: "數值受抑制" },
      { label: "標準化狀態", value: "分母受抑制" },
      { label: "比較基準", value: "本區÷基準；基準為零，無法計算比值" },
    ]);
  });

  it("does not invent a normalized unit when the result contract declares none", () => {
    expect(researchResultPopupFacts({ status: "observed", value: 20, normalizedValue: 10, normalization_status: "valid" })).toContainEqual({ label: "標準化值", value: "10（單位未隨圖徵提供）" });
  });

  it("formats a % unit as a percentage without re-appending the unit, and a per-X unit with thousands grouping (spec U1)", () => {
    expect(researchResultPopupFacts({ status: "observed", value: 12.34, unit: "%" })).toContainEqual({ label: "原始值", value: "12.3%" });
    expect(researchResultPopupFacts({ status: "observed", value: 27450, unit: "人/km²" })).toContainEqual({ label: "原始值", value: "27,450 人/km²" });
  });

  it("never rounds away a fractional value with no unit signal (falls back to ratio, not count)", () => {
    expect(researchResultPopupFacts({ status: "observed", value: 12.5, unit: "cases per 10000 persons" })).toContainEqual({ label: "原始值", value: "12.5 cases per 10000 persons" });
  });

  it("does not turn null or undefined distance into a zero-metre straight line", () => {
    expect(researchResultPopupDistance(null)).toBeNull();
    expect(researchResultPopupDistance(undefined)).toBeNull();
    expect(researchResultPopupDistance("0")).toBeNull();
    expect(researchResultPopupDistance(0)).toBe("0 公尺 · 直線");
  });

  it("shows a zero source area with its metadata unit instead of treating it as missing", () => {
    expect(researchResultPopupFacts({ area_ha: 0, sourceAreaUnit: "hectares (source EPSG:3826 planar area)" })).toContainEqual({ label: "來源面積", value: "0 hectares (source EPSG:3826 planar area)" });
    expect(researchResultPopupFacts({ area_ha: 0 })).toContainEqual({ label: "來源面積", value: "0 ha" });
  });

  it("keeps area names first, then uses analysis, route, and zoning labels before record ids", () => {
    expect(researchResultPopupTitle({ area_name: "甲區", label: "250 公尺環域", record_id: "row-1" })).toBe("甲區");
    expect(researchResultPopupTitle({ label: "250 公尺環域", route_label: "嘉義市1路", zone_label: "公墓用地", record_id: "row-1" })).toBe("250 公尺環域");
    expect(researchResultPopupTitle({ route_label: "嘉義市1路", zone_label: "公墓用地", record_id: "row-1" })).toBe("嘉義市1路");
    expect(researchResultPopupTitle({ zone_label: "公墓用地", record_id: "row-1" })).toBe("公墓用地");
  });

  it("shows CWA event facts with contract units and preserves absent values", () => {
    expect(researchResultPopupTitle({ location: "花蓮縣近海", event_id: "E-1" })).toBe("花蓮縣近海");
    expect(researchResultPopupFacts({ occurred_at: "2026-09-24T00:00:00Z", magnitude: 4.2, magnitudeUnit: "M", depth_km: 12, depthUnit: "km" })).toEqual([
      { label: "發生時間", value: "2026-09-24T00:00:00Z" }, { label: "規模", value: "4.2 M" }, { label: "深度", value: "12 km" },
    ]);
    expect(researchResultPopupFacts({ occurred_at: "2026-09-24T00:00:00Z", magnitude: null, depth_km: null })).toEqual([{ label: "發生時間", value: "2026-09-24T00:00:00Z" }]);
  });

  it("also excludes a nearby_profile scope-circle row (_role: scope) from overlap stats, defense in depth", () => {
    const ring = { id: "ring", properties: { resultId: "wh-1:polygon", _role: "scope" }, geometry: { type: "Polygon" } };
    const point = { id: "same", properties: { resultId: "nursing", record_id: "N-1" }, geometry: { type: "Point" } };
    const overlaps = researchResultPopupOverlaps([ring, point]);
    expect(overlaps.features).toEqual([point]);
    expect(overlaps.total).toBe(1);
  });

  it("prefers real points over display scope, deduplicates result feature pairs, and discloses overlap truncation", () => {
    const scope = { id: "scope", properties: { resultId: "scope", datasetId: "derived:analysis-scope-area" }, geometry: { type: "Polygon" } };
    const point = { id: "same", properties: { resultId: "nursing", record_id: "N-1" }, geometry: { type: "Point" } };
    const features: ResearchResultPopupOverlapFeature[] = [scope, point, point, ...Array.from({ length: 9 }, (_, index) => ({ id: `n-${index}`, properties: { resultId: "nursing", record_id: `N-${index + 2}` }, geometry: { type: "Point" } }))];
    const overlaps = researchResultPopupOverlaps(features);
    expect(overlaps.features).toHaveLength(8);
    expect(overlaps.features.every(feature => feature.properties?.datasetId !== "derived:analysis-scope-area")).toBe(true);
    expect(overlaps.total).toBe(10);
    expect(overlaps.omitted).toBe(2);
  });
});

describe("docked analysis result panel data", () => {
  const noDescriptor = () => { throw new Error("DATASET_NOT_FOUND"); };

  it("never shows an internal dataset identifier as the dataset name", () => {
    expect(researchResultDatasetLabel("warehouse:wh-8", "新北市國小周邊", noDescriptor)).toBe("新北市國小周邊");
    // displayLabel falls back to the raw datasetId upstream; that echo is not a name.
    expect(researchResultDatasetLabel("warehouse:wh-8", "warehouse:wh-8", noDescriptor)).toBe(UNNAMED_DATASET_LABEL);
    expect(researchResultDatasetLabel("edu-schools", "edu-schools", id => id === "edu-schools" ? "各級學校" : null)).toBe("各級學校");
    expect(researchResultDatasetLabel("a+b", undefined, noDescriptor)).toBe(UNNAMED_DATASET_LABEL);
    expect(researchResultDatasetLabel("edu-schools", "", id => id)).toBe(UNNAMED_DATASET_LABEL);
  });

  it("orders facts dataset → source values → distance → versions, with Chinese labels", () => {
    expect(researchResultRecordFacts({ datasetId: "warehouse:wh-8", status: "observed", value: 3, distanceM: 120.4, source_version: "2026-09", boundary_version: "113" }, "國小周邊")).toEqual([
      { label: "資料集", value: "國小周邊" },
      { label: "原始值", value: "3" },
      { label: "距離", value: "120 公尺 · 直線" },
      { label: "版本", value: "2026-09" },
      { label: "邊界版本", value: "113" },
    ]);
  });

  it("keeps the generic record fact when a hit carries nothing else", () => {
    expect(researchResultRecordFacts({}, UNNAMED_DATASET_LABEL)).toEqual([{ label: "紀錄", value: "本次分析命中的空間紀錄" }]);
  });

  it("resolves every overlapping hit at click time, keeping total and omitted counts", () => {
    const features = [
      { id: 1, properties: { resultId: "r1", datasetId: "warehouse:wh-8", name: "甲國小" }, geometry: { type: "Point" } },
      { id: 2, properties: { resultId: "r2", datasetId: "warehouse:wh-9", name: "乙國小" }, geometry: { type: "Point" } },
    ];
    const panel = researchResultPanelProperties({ features, total: 10, omitted: 8 }, resultId => resultId === "r1" ? { displayLabel: "國小周邊", color: "#38bdf8" } : { displayLabel: "warehouse:wh-9" }, noDescriptor);
    expect(panel.total).toBe(10);
    expect(panel.omitted).toBe(8);
    expect(panel.records.map(record => [record.title, record.color, record.facts[0]])).toEqual([
      ["甲國小", "#38bdf8", { label: "資料集", value: "國小周邊" }],
      ["乙國小", null, { label: "資料集", value: UNNAMED_DATASET_LABEL }],
    ]);
    expect(JSON.stringify(panel)).not.toContain("warehouse:");
  });

  it("attaches a trend (P3=W3) only when trendFor returns one for that record's resultId", () => {
    const features = [
      { id: 1, properties: { resultId: "r1", datasetId: "warehouse:wh-8", name: "甲區" }, geometry: { type: "Polygon" } },
      { id: 2, properties: { resultId: "r2", datasetId: "warehouse:wh-9", name: "乙區" }, geometry: { type: "Polygon" } },
    ];
    const trend = { points: [{ label: "01/01", value: 1 }], caption: "近 1 期", markerIndex: 0 };
    const panel = researchResultPanelProperties(
      { features, total: 2, omitted: 0 },
      () => ({ displayLabel: "x" }),
      noDescriptor,
      resultId => (resultId === "r1" ? trend : null),
    );
    expect(panel.records[0]!.trend).toEqual(trend);
    expect(panel.records[1]!.trend).toBeUndefined();
  });

  it("omits trend entirely when no trendFor is given (every other caller's existing behaviour)", () => {
    const features = [{ id: 1, properties: { resultId: "r1", name: "甲區" }, geometry: { type: "Polygon" } }];
    const panel = researchResultPanelProperties({ features, total: 1, omitted: 0 }, () => ({ displayLabel: "x" }), noDescriptor);
    expect(panel.records[0]).not.toHaveProperty("trend");
  });

  it("titles warehouse rows by their source name column and shows address and dist_m", () => {
    const stop = { StationName: "捷運大安站(信義)", StationAddress: "信義路四段上近復興南路同向(向西)", dist_m: 25, _wh_label: "大安捷運站 300m 內公車站位" };
    expect(researchResultPopupTitle(stop)).toBe("捷運大安站(信義)");
    expect(researchResultRecordFacts(stop, "大安捷運站 300m 內公車站位")).toEqual([
      { label: "地址", value: "信義路四段上近復興南路同向(向西)" },
      { label: "距離", value: "25 公尺 · 直線" },
    ]);
    expect(researchResultPopupTitle({ _wh_label: "只有內部標籤" })).toBe("分析結果");
  });
});
