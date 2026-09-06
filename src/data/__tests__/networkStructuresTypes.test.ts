import { LAYER_MANIFEST } from "../layerManifest";
import { describe, expect, it } from "vitest";
import { comparisonGeometryFilter, comparisonStatusFilter } from "../networkStructuresTypes";

describe("bridge comparison filters", () => {
  it("circle 同時套用選定狀態與重合端點條件", () => {
    expect(comparisonStatusFilter({ bridgeComparisonNewTaipeiStatusIdx: 1 })).toEqual([
      "==", ["get", "match_status"], "MATCHED",
    ]);
    expect(comparisonGeometryFilter({ bridgeComparisonNewTaipeiStatusIdx: 1 })).toEqual([
      "all", ["==", ["get", "match_status"], "MATCHED"], ["==", ["get", "geometry_role"], "coincident_endpoints"],
    ]);
  });
});


describe("Network Structures controls are reachable", () => {
  it("每個新圖層都能展開參數面板，且對應到上游 canonical dataset", () => {
    for (const key of ["osmBridgeCarriers", "osmBridgeFootprints", "officialBridgesNewTaipei", "bridgeComparisonNewTaipei"] as const) {
      expect(LAYER_MANIFEST[key].expandable).toBe(true);
      expect(LAYER_MANIFEST[key].upstream.datasets[0]?.datasetId).toBe("network_structures");
    }
  });
});
