import { describe, expect, it } from "vitest";
import { GIS_LAYERS } from "../gisClickRegistry";
import { bssBridgeLineFilter, bssBridgePointFilter, bssBridgeQualityFilter } from "../../data/bssBridgeTypes";

describe("BSS bridge quality filters", () => {
  it("opens the bridge popup for supplemental direction lines", () => {
    expect(GIS_LAYERS.find(entry => entry.layers.includes("bss-national-bridge-preview-stage1-local-direction-candidate"))?.type).toBe("bssNationalBridgePreview");
  });
  it("admits stage-1 supported location/direction only with a release", () => {
    expect(bssBridgeQualityFilter(1)).toEqual(["all",
      ["==", ["get", "stage1_status"], "supported"],
      ["==", ["typeof", ["get", "stage1_release_id"]], "string"],
      ["!=", ["get", "stage1_release_id"], ""],
    ]);
    expect(bssBridgeQualityFilter(2)).toEqual(["!", bssBridgeQualityFilter(1)]);
  });

  it("keeps point and line quality controls independent while missing stage-1 evidence stays pending", () => {
    expect(bssBridgeLineFilter("original_direction_line", 1, 1)).toEqual(["all",
      ["==", ["get", "geometry_role"], "original_direction_line"],
      ["==", ["get", "facility_class_candidate"], "road_bridge_carrier_candidate"],
      bssBridgeQualityFilter(1),
    ]);
    expect(bssBridgePointFilter(2)).toEqual(["all",
      ["==", ["get", "geometry_role"], "point"],
      bssBridgeQualityFilter(2),
    ]);
    expect(bssBridgeLineFilter("original_direction_line")).toEqual(["==", ["get", "geometry_role"], "original_direction_line"]);
    expect(bssBridgePointFilter()).toEqual(["==", ["get", "geometry_role"], "point"]);
  });

  it("shows the supplemental local-direction role only outside image-supported quality", () => {
    const roleOnly = ["==", ["get", "geometry_role"], "stage1_local_direction_candidate"];
    expect(bssBridgeLineFilter("stage1_local_direction_candidate")).toEqual(roleOnly);
    expect(bssBridgeLineFilter("stage1_local_direction_candidate", 0, 1)).toEqual(["all",
      roleOnly,
      bssBridgeQualityFilter(1),
    ]);
    expect(bssBridgeLineFilter("stage1_local_direction_candidate", 0, 2)).toEqual(["all",
      roleOnly,
      bssBridgeQualityFilter(2),
    ]);
  });
});
