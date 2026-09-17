import { describe, expect, it } from "vitest";
import type { StoredDataResult } from "../analysisOperations";
import { neighborhoodCount } from "../neighborhoodAnalysis";

const receipt = (sourceId: string) => ({ sourceId, version: "v1", acquiredAt: "2026-09-15T00:00:00.000Z", checksumSha256: null, reference: `fixture://${sourceId}` });
function result(id: string, rows: readonly Record<string, unknown>[], options: Partial<StoredDataResult> = {}): StoredDataResult {
  return { resultId: id, datasetId: id, rows, recordGrain: "place", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, sourceRefs: [receipt(id)], coverage: `${id} supplied snapshot`, freshness: "current", units: {}, lineage: { fixture: id }, ...options };
}
const point = (lng: number, lat = 25) => ({ type: "Point", coordinates: [lng, lat] });

describe("neighborhoodCount", () => {
  it("uses true Haversine radius distances and preserves separate source counts", () => {
    const candidates = result("candidates", [{ id: "a", geometry: point(121.5) }, { id: "b", geometry: point(121.51) }]);
    const schools = result("schools", [{ geometry: point(121.5005) }, { geometry: point(121.504) }]);
    const clinics = result("clinics", [{ geometry: point(121.5007) }, { geometry: point(121.514) }], { freshness: "unknown" });
    const output = neighborhoodCount({ candidates, sources: [schools, clinics], radiusM: 100, includeSelf: true });
    expect(output.rows).toEqual([
      expect.objectContaining({ id: "a", source_0_count: 1, source_1_count: 1 }),
      expect.objectContaining({ id: "b", source_0_count: 0, source_1_count: 0 }),
    ]);
    expect(output.freshness).toBe("unknown");
    expect(output.coverage).toContain("schools supplied snapshot");
    expect(output.summary).toMatchObject({ returned: 2, displayTruncated: false, countsLimitedToProvidedSourceSnapshots: true });
  });

  it("does not deduplicate colocated records and makes self inclusion explicit", () => {
    const candidates = result("same", [{ id: "a", geometry: point(121.5) }, { id: "b", geometry: point(121.5) }]);
    expect(neighborhoodCount({ candidates, sources: [candidates], radiusM: 100, includeSelf: true }).rows).toEqual([
      expect.objectContaining({ source_0_count: 2 }), expect.objectContaining({ source_0_count: 2 }),
    ]);
    expect(neighborhoodCount({ candidates, sources: [candidates], radiusM: 100, includeSelf: false }).rows).toEqual([
      expect.objectContaining({ source_0_count: 1 }), expect.objectContaining({ source_0_count: 1 }),
    ]);
  });

  it("keeps the complete candidate result and uses stable input order for ranking ties", () => {
    const candidates = result("candidates", Array.from({ length: 51 }, (_, index) => ({ id: index, geometry: point(121.5 + index / 100_000) })));
    const source = result("source", [{ geometry: point(121.5) }]);
    const output = neighborhoodCount({ candidates, sources: [source], radiusM: 100, includeSelf: false, rankSourceIndex: 0 });
    expect(output.rows).toHaveLength(51);
    expect(output.rows.slice(0, 3).map(row => row.id)).toEqual([0, 1, 2]);
    expect(output.method).toMatchObject({ rankSourceIndex: 0, includeSelf: false });
  });

  it("retains every receipt and input lineage while rejecting invalid spatial inputs and caps", () => {
    const candidates = result("candidates", [{ geometry: point(121.5) }], { sourceRefs: [receipt("candidate-a"), receipt("candidate-b")] });
    const source = result("source", [{ geometry: point(121.5) }], { sourceRefs: [receipt("candidate-a")] });
    const output = neighborhoodCount({ candidates, sources: [source], radiusM: 100, includeSelf: false });
    expect(output.sourceRefs).toHaveLength(3);
    expect(output.lineage).toMatchObject({ candidates: { resultId: "candidates" }, sources: [{ resultId: "source" }] });
    expect(() => neighborhoodCount({ candidates, sources: [{ ...source, geometry: { type: "Point", role: "proxy", spatialAnalysisEligible: false } }], radiusM: 100, includeSelf: false })).toThrow("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
    expect(() => neighborhoodCount({ candidates: result("bad", [{ geometry: point(181) }]), sources: [source], radiusM: 100, includeSelf: false })).toThrow("INVALID_WGS84_POINT_GEOMETRY");
    expect(() => neighborhoodCount({ candidates: result("many", Array.from({ length: 2_001 }, () => ({ geometry: point(121.5) }))), sources: [source], radiusM: 100, includeSelf: false })).toThrow("NEIGHBORHOOD_CANDIDATE_LIMIT_EXCEEDED");
    expect(() => neighborhoodCount({ candidates, sources: [result("oversized-source", Array.from({ length: 20_001 }, () => ({ geometry: point(121.5) })))], radiusM: 100, includeSelf: false })).toThrow("NEIGHBORHOOD_SOURCE_RECORD_LIMIT_EXCEEDED");
    expect(() => neighborhoodCount({ candidates: result("pair-candidates", Array.from({ length: 2_000 }, () => ({ geometry: point(121.5) }))), sources: [result("pair-source", Array.from({ length: 2_501 }, () => ({ geometry: point(121.5) })))], radiusM: 100, includeSelf: false })).toThrow("NEIGHBORHOOD_PAIR_COMPARISON_LIMIT_EXCEEDED");
    expect(() => neighborhoodCount({ candidates, sources: [source], radiusM: 99, includeSelf: false })).toThrow("INVALID_NEIGHBORHOOD_INPUT");
  });
});
