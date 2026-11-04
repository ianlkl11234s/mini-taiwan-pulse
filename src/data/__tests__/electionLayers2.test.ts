import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) }, supabaseConfigured: true }));

import { clearCouncilDistrictsCache, fetchCouncilDistricts, formatMemberUnits, normalizeCouncilDistricts } from "../councilDistrictsLoader";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";

const SQUARE: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[121, 25], [121.1, 25], [121.1, 25.1], [121, 25.1], [121, 25]]] };

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
