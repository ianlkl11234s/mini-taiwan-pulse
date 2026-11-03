import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, supabaseConfigured: true }));

import { clearCouncilDistrictsCache, fetchCouncilDistricts, formatMemberUnits, normalizeCouncilDistricts } from "../councilDistrictsLoader";
import {
  clearVillageResultsCache,
  fetchVillageResults,
  normalizeVillageResults,
  snapVillageBounds,
  villageCacheKey,
  villageQueryZoom,
} from "../electionResults2022Loader";
import { VILLAGE_COLOR_MODES, VILLAGE_ELECTIONS, VILLAGE_MISSING_COLOR, VILLAGE_TOP_COLOR, villageFillColor } from "../electionResults2022Types";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";

const SQUARE: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[121, 25], [121.1, 25], [121.1, 25.1], [121, 25.1], [121, 25]]] };

function thenable(data: unknown) {
  const p = Promise.resolve({ data, error: null, status: 200 });
  return Object.assign(p, { abortSignal: () => p });
}

describe("2026 議員選區", () => {
  beforeEach(() => {
    rpc.mockReset();
    clearCouncilDistrictsCache();
  });

  it("normalize：保留面、每區加一個面內標籤點、略過非面", () => {
    const d = normalizeCouncilDistricts({
      type: "FeatureCollection",
      meta: { count: 161, loaded_at: "2026-11-03T15:00:20+00:00", source: "A0046" },
      features: [
        { type: "Feature", geometry: SQUARE, properties: { district_name: "臺北市第1選舉區", seats: 12, is_indigenous: false } },
        { type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: {} },
      ],
    });
    const polys = d.fc.features.filter((f) => f.geometry.type !== "Point");
    const labels = d.fc.features.filter((f) => f.properties?._label === 1);
    expect(polys).toHaveLength(1);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.properties!.district_name).toBe("臺北市第1選舉區");
    const [x, y] = (labels[0]!.geometry as GeoJSON.Point).coordinates as [number, number];
    expect(x).toBeGreaterThan(121);
    expect(x).toBeLessThan(121.1);
    expect(y).toBeGreaterThan(25);
    expect(d.meta).toEqual({ count: 161, loadedAt: "2026-11-03T15:00:20+00:00" });
  });

  it("fetch 一次後走快取", async () => {
    rpc.mockReturnValue(Promise.resolve({ data: { features: [] }, error: null, status: 200 }));
    const a = await fetchCouncilDistricts();
    const b = await fetchCouncilDistricts();
    expect(a).toBe(b);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_council_districts_2026");
  });

  it("組成單位：字串、陣列、JSON 字串都可顯示", () => {
    expect(formatMemberUnits("南投市、名間鄉")).toBe("南投市、名間鄉");
    expect(formatMemberUnits(["南投市", "名間鄉"])).toBe("南投市、名間鄉");
    expect(formatMemberUnits('["南投市","名間鄉"]')).toBe("南投市、名間鄉");
    expect(formatMemberUnits(null)).toBe("");
  });

  it("選項只有透明度（無區域／原住民切換：資料沒有原住民選區範圍）", () => {
    expect(LAYER_PARAMS_SPEC.councilDistricts2026.map((s) => s.kind)).toEqual(["slider"]);
  });
});

describe("2022 村里得票", () => {
  beforeEach(() => {
    rpc.mockReset();
    clearVillageResultsCache();
  });

  it("normalize：寫入 _detail、未知 status 視為 missing、略過非面", () => {
    const d = normalizeVillageResults({
      meta: { count: 3, zoom: 9, detail: "basic", reason: null, loaded_at: "x" },
      features: [
        { type: "Feature", geometry: SQUARE, properties: { villcode: "1", status: "ok", m_top: "kmt", m_margin_pp: 8.7 } },
        { type: "Feature", geometry: SQUARE, properties: { villcode: "2", status: "weird" } },
        { type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: { status: "ok" } },
      ],
    });
    expect(d.fc.features).toHaveLength(2);
    expect(d.fc.features[0]!.properties!._detail).toBe("basic");
    expect(d.fc.features[1]!.properties!.status).toBe("missing");
    expect(d.meta).toMatchObject({ count: 3, zoom: 9, detail: "basic" });
    expect(normalizeVillageResults({ meta: { detail: "full" }, features: [{ type: "Feature", geometry: SQUARE, properties: { status: "ok" } }] })
      .fc.features[0]!.properties!._detail).toBe("full");
  });

  it("整數 zoom 夾在 8–14；跨 z9→z10 快取鍵不同（要重查拿完整欄位）", () => {
    expect(villageQueryZoom(7.2)).toBe(8);
    expect(villageQueryZoom(9.9)).toBe(9);
    expect(villageQueryZoom(10.1)).toBe(10);
    expect(villageQueryZoom(17)).toBe(14);
    const b = { west: 121.45, south: 25.0, east: 121.6, north: 25.1 };
    expect(villageCacheKey(snapVillageBounds(b, 9), 9)).not.toBe(villageCacheKey(snapVillageBounds(b, 10), 10));
    // z8 對齊 1°
    expect(snapVillageBounds(b, 8)).toEqual({ west: 121, south: 25, east: 122, north: 26 });
  });

  it("fetch：以對齊 bbox＋整數 zoom 呼叫 RPC；同鍵第二次走快取", async () => {
    rpc.mockImplementation(() => thenable({ meta: { detail: "full" }, features: [] }));
    await fetchVillageResults({ west: 121.51, south: 25.01, east: 121.55, north: 25.05 }, 13.6);
    expect(rpc).toHaveBeenCalledWith("get_election_results_2022_village", {
      p_west: 121.5, p_south: 25, p_east: 121.5625, p_north: 25.0625, p_zoom: 13,
    });
    await fetchVillageResults({ west: 121.52, south: 25.02, east: 121.55, north: 25.05 }, 13.2);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("著色：missing 一律灰在最外層；議員有無黨籍色、縣市長沒有", () => {
    for (const e of VILLAGE_ELECTIONS) {
      for (const m of VILLAGE_COLOR_MODES) {
        const expr = villageFillColor(e, m);
        expect(expr.slice(0, 3)).toEqual(["case", ["==", ["get", "status"], "missing"], VILLAGE_MISSING_COLOR]);
      }
    }
    const council = JSON.stringify(villageFillColor("council", "top"));
    const mayor = JSON.stringify(villageFillColor("mayor", "top"));
    expect(council).toContain('"c_top"');
    expect(council).toContain(VILLAGE_TOP_COLOR.ind);
    expect(mayor).toContain('"m_top"');
    expect(mayor).not.toContain(VILLAGE_TOP_COLOR.ind);
    expect(JSON.stringify(villageFillColor("mayor", "margin"))).toContain("m_margin_pp");
    expect(JSON.stringify(villageFillColor("council", "turnout"))).toContain("c_turnout");
  });

  it("select encode 與 SSOT 陣列逐位相同", () => {
    const spec = LAYER_PARAMS_SPEC.electionResults2022Village;
    const enc = (name: string) => {
      const s = spec.find((x) => x.name === name);
      return s && "encode" in s ? s.encode : null;
    };
    expect(enc("electionResults2022VillageElection")).toEqual([...VILLAGE_ELECTIONS]);
    expect(enc("electionResults2022VillageColorBy")).toEqual([...VILLAGE_COLOR_MODES]);
  });
});
