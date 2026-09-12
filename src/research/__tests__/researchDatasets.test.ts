import { afterEach, describe, expect, it, vi } from "vitest";
import { clearNearbyDataCache } from "../nearbyData";
import { describeDataset, queryRecords, searchDatasets } from "../researchDatasets";

afterEach(() => { clearNearbyDataCache(); vi.unstubAllGlobals(); });

describe("built-in research datasets", () => {
  it("discovers the three pilot families with explicit geometry and null semantics", () => {
    expect(searchDatasets("").datasets.map(item => item.datasetId)).toEqual(["tw-schools", "tw-news-events", "land-use:paddy-area-township"]);
    expect(describeDataset("tw-news-events").geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
    expect(describeDataset("land-use:paddy-area-township").fields.find(field => field.name === "value")?.nullMeaning).toContain("suppressed");
  });

  it("queries the real schools adapter without consulting layer visibility", async () => {
    const body = JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { code: "A", school_name: "甲校", city: "臺北市", region_type: null } },
      { type: "Feature", geometry: null, properties: { code: "B", school_name: "缺座標校" } },
    ] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-length": String(body.length) } })));
    const result = await queryRecords({ datasetId: "tw-schools", select: ["record_id", "school_name", "region_type", "geometry"], filters: [{ field: "city", op: "eq", value: "臺北市" }] });
    expect(result).toMatchObject({ datasetId: "tw-schools", totalMatched: 1, returned: 1, excludedByReason: { missing_geometry: 1 } });
    expect((result.rows as Array<Record<string, unknown>>)[0]?.region_type).toBeNull();
  });
});
