import { describe, expect, it } from "vitest";
import { researchPlaces } from "../researchPlaces";
import type { PresentableResult } from "../researchAnalysisSession";
const result: PresentableResult = { resultId: "r1", datasetId: "tw-schools", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, rows: [{ record_id: "a", school_name: "雙蓮國小", geometry: { type: "Point", coordinates: [121.5167, 25.0605] }, source_0_count: 0, source_1_count: null }], presentation: { kind: "neighborhood", countField: "source_0_count", label: "學校", radiusM: 1000, sourceLabels: [{ field: "source_0_count", label: "學校" }, { field: "source_1_count", label: "圖書館" }] } };
describe("research place links", () => {
  it("links only to actual named source records and preserves zero vs unknown", () => {
    expect(researchPlaces([result])[0]).toMatchObject({ resultId: "r1", recordId: "a", label: "雙蓮國小", radiusM: 1000, detail: "直線 1000 公尺內：學校 0 筆 · 圖書館 未知 筆" });
    expect(researchPlaces([{ ...result, geometry: { ...result.geometry, role: "proxy" } }])).toEqual([]);
    expect(researchPlaces([{ ...result, rows: [{ ...result.rows[0], record_id: undefined }] }])).toEqual([]);
  });
});
