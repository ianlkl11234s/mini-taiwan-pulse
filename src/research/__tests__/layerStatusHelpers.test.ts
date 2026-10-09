import { describe, expect, it } from "vitest";

// build-layer-status 的純函式在 scripts/（.mjs、無型別）；以動態 import 載入以免 tsc 對 JS 報型別錯。
const helpersPath = "../../../scripts/research/layer-status-helpers.mjs";
const load = async () => await import(/* @vite-ignore */ helpersPath) as {
  layerAlias: (map: Record<string, unknown>, key: string) => { datasets: string[]; rowFilter: string; geometry: string; explicit: boolean };
  sharedTableWarning: (input: { spatial: { table: string; geometry_type: string }[]; rowFilter: string; tableUsers: Map<string, Set<string>> }) => string;
};

describe("layer-status helpers", () => {
  it("reads array and object byLayer entries; an empty array is an explicit 'no warehouse table'", async () => {
    const { layerAlias } = await load();
    const map = { a: ["t1"], b: [], c: { datasets: ["jp_water_ksj"], rowFilter: "source_dataset = 'W01'", geometry: "POINT" } };
    expect(layerAlias(map, "a")).toMatchObject({ datasets: ["t1"], rowFilter: "", explicit: true });
    expect(layerAlias(map, "b")).toMatchObject({ datasets: [], explicit: true });
    expect(layerAlias(map, "c")).toMatchObject({ rowFilter: "source_dataset = 'W01'", geometry: "POINT" });
    expect(layerAlias(map, "none")).toMatchObject({ explicit: false });
  });

  it("flags a mixed-geometry table shared by several layers unless the layer carries a rowFilter", async () => {
    const { sharedTableWarning } = await load();
    const spatial = [{ table: "ds_world_jp_water_ksj", geometry_type: "LINESTRING+POINT" }];
    const tableUsers = new Map([["ds_world_jp_water_ksj", new Set(["jpWaterDams", "jpWaterLakes"])]]);
    expect(sharedTableWarning({ spatial, rowFilter: "", tableUsers })).toBe("unfiltered_shared_table");
    expect(sharedTableWarning({ spatial, rowFilter: "source_dataset = 'W01'", tableUsers })).toBe("");
    expect(sharedTableWarning({ spatial: [{ table: "t", geometry_type: "POINT" }], rowFilter: "", tableUsers: new Map([["t", new Set(["x", "y"])]]) })).toBe("");
    expect(sharedTableWarning({ spatial, rowFilter: "", tableUsers: new Map([["ds_world_jp_water_ksj", new Set(["only"])]]) })).toBe("");
  });
});
