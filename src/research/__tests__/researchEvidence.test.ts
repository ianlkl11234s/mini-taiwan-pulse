import { describe, it, expect } from "vitest";
import { analysisErrorMessage, researchEvidence } from "../researchEvidence";
describe("executed research evidence", () => {
  it("keeps nested bbox scope, source version and the administrative whole-area warning", () => {
    const evidence = researchEvidence("spatial_query", { center: [121.5, 25], radiusM: 2000 }, {
      resultId: "r1", recordGrain: "admin_statistic", rows: [{value: 0, geometry: {type: "Polygon"}}],
      lineage: { inputs: [{ lineage: { queryScope: { datasetId: "housing", totalMatched: 2, bbox: [121,24,122,26], parameters: {releaseId: "2020"} } } }] },
      sourceRefs: [{sourceId: "source", version: "2020"}],
    });
    expect(evidence.scope.join(" ")).toContain("完整符合 2 筆");
    expect(evidence.scope.join(" ")).toContain("不能分攤");
    expect(evidence.scope.join(" ")).toContain("不是步行距離");
    expect(evidence.sources).toEqual(["source / 2020"]);
    expect(evidence.rows).toEqual([{value: 0}]);
  });
  it("explains rejection without inventing a zero result", () => {
    expect(analysisErrorMessage("REGION_PERIOD_MISMATCH")).toContain("比較未執行");
    expect(analysisErrorMessage("UNAVAILABLE")).toContain("不會以零代替");
  });
});
