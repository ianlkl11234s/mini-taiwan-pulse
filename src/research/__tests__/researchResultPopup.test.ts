import { describe, expect, it } from "vitest";
import { researchResultPopupDistance, researchResultPopupFacts, researchResultPopupOverlaps, researchResultPopupTitle, type ResearchResultPopupOverlapFeature } from "../researchResultPopup";

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
