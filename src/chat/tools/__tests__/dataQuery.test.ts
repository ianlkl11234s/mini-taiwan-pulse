import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { latLngToCell } from "h3-js";
import {
  groupByField,
  filterEqField,
  filterContainsField,
  nearestPoints,
  countDataset,
  fetchDataset,
  clearDatasetCache,
  type GeoFeature,
} from "../geojsonQuery";
import { capToolResult, type CappedResult } from "../truncate";
import { rankPointsByPopulation, clearH3PopulationCache } from "../h3Population";
import { callWhitelistedRpc, RPC_WHITELIST } from "../rpcTools";

// ── 小 GeoJSON fixture ──
function pt(lng: number, lat: number, props: Record<string, unknown>): GeoFeature {
  return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props };
}

const FIRE_FIXTURE: GeoFeature[] = [
  pt(121.5, 25.04, { name: "台北中隊", cat: "分隊", county: "臺北市" }),
  pt(121.51, 25.05, { name: "大安分隊", cat: "分隊", county: "臺北市" }),
  pt(121.56, 25.03, { name: "第一大隊", cat: "大隊", county: "臺北市" }),
  pt(120.3, 22.6, { name: "高雄分駐所", cat: "分駐所", county: "高雄市" }),
];

describe("geojsonQuery.groupByField", () => {
  it("counts by field, sorted desc", () => {
    const r = groupByField(FIRE_FIXTURE, "cat");
    expect("groups" in r).toBe(true);
    const groups = (r as { groups: { value: string; count: number }[] }).groups;
    expect(groups[0]).toEqual({ value: "分隊", count: 2 });
    expect((r as unknown as { distinct: number }).distinct).toBe(3);
  });

  it("returns availableFields when field is absent", () => {
    const r = groupByField(FIRE_FIXTURE, "nonexistent") as {
      error: string;
      availableFields: string[];
    };
    expect(r.error).toContain("nonexistent");
    expect(r.availableFields).toContain("cat");
  });
});

// ── FX-5: 教學性工具回饋（0 筆 / 欄位不存在 → availableFields + fieldSamples + hint） ──
describe("geojsonQuery.filterEqField (FX-5)", () => {
  it("returns matched sample when value exists", () => {
    const r = filterEqField(FIRE_FIXTURE, "cat", "分隊") as { matched: number };
    expect(r.matched).toBe(2);
  });

  it("returns availableFields + fieldSamples + hint on 0 matches with a valid field", () => {
    const r = filterEqField(FIRE_FIXTURE, "cat", "不存在的分類") as {
      matched: number;
      error?: string;
      hint: string;
      availableFields: string[];
      fieldSamples: Record<string, string[]>;
    };
    expect(r.matched).toBe(0);
    expect(r.error).toBeUndefined(); // 欄位本身存在，只是值查不到
    expect(r.hint).toBeTruthy();
    expect(r.availableFields).toEqual(expect.arrayContaining(["name", "cat", "county"]));
    expect(r.fieldSamples.cat).toEqual(expect.arrayContaining(["分隊"]));
  });

  it("flags the field itself as missing (欄位不存在) with the same feedback shape", () => {
    const r = filterEqField(FIRE_FIXTURE, "district", "隨便") as {
      matched: number;
      error: string;
      hint: string;
      availableFields: string[];
      fieldSamples: Record<string, string[]>;
    };
    expect(r.matched).toBe(0);
    expect(r.error).toContain("district");
    expect(r.error).toContain("不存在");
    expect(r.hint).toBeTruthy();
    expect(r.availableFields).toEqual(expect.arrayContaining(["name", "cat", "county"]));
  });
});

describe("geojsonQuery.filterContainsField (FX-5)", () => {
  const ADDRESS_FIXTURE: GeoFeature[] = [
    pt(121.5, 25.04, { name: "台北一號", address: "臺北市中正區重慶南路一段" }),
    pt(121.51, 25.05, { name: "台北二號", address: "Taipei City Da-an District" }),
    pt(120.3, 22.6, { name: "高雄一號", address: "高雄市苓雅區" }),
  ];

  it("matches by substring (Traditional Chinese)", () => {
    const r = filterContainsField(ADDRESS_FIXTURE, "address", "臺北市") as {
      matched: number;
      sample: unknown;
    };
    expect(r.matched).toBe(1);
  });

  it("matches case-insensitively for ASCII text", () => {
    const upper = filterContainsField(ADDRESS_FIXTURE, "address", "TAIPEI") as { matched: number };
    const lower = filterContainsField(ADDRESS_FIXTURE, "address", "taipei") as { matched: number };
    expect(upper.matched).toBe(1);
    expect(lower.matched).toBe(1);
  });

  it("returns availableFields + fieldSamples + hint on 0 matches", () => {
    const r = filterContainsField(ADDRESS_FIXTURE, "address", "不存在的地址片段") as {
      matched: number;
      hint: string;
      availableFields: string[];
      fieldSamples: Record<string, string[]>;
    };
    expect(r.matched).toBe(0);
    expect(r.hint).toBeTruthy();
    expect(r.availableFields).toContain("address");
    expect(r.fieldSamples.address?.length).toBeGreaterThan(0);
  });

  it("flags a nonexistent field as 不存在", () => {
    const r = filterContainsField(ADDRESS_FIXTURE, "county", "台北") as {
      matched: number;
      error: string;
    };
    expect(r.matched).toBe(0);
    expect(r.error).toContain("不存在");
  });
});

describe("geojsonQuery fieldSamples 抽樣上限 (FX-5)", () => {
  it("only samples the first 200 features when building fieldSamples", () => {
    const features: GeoFeature[] = Array.from({ length: 250 }, (_, i) =>
      i < 200
        ? pt(121.5, 25.0, { name: `pt-${i}`, tag: "early" })
        : pt(121.5, 25.0, { name: `pt-${i}`, tag: "early", onlyLate: "late-value" }),
    );
    const r = filterEqField(features, "tag", "查無此值") as {
      matched: number;
      fieldSamples: Record<string, string[]>;
    };
    expect(r.matched).toBe(0);
    expect(r.fieldSamples.tag).toContain("early");
    // onlyLate 只出現在第 200 筆之後，超過抽樣上限應該完全掃不到
    expect(r.fieldSamples.onlyLate).toBeUndefined();
  });
});

describe("geojsonQuery.nearestPoints", () => {
  it("returns k nearest points ordered by distance", () => {
    const r = nearestPoints(FIRE_FIXTURE, 121.5, 25.04, 2);
    const points = r.points as { name: string; distanceKm: number }[];
    expect(points).toHaveLength(2);
    expect(points[0]!.name).toBe("台北中隊"); // same coord → ~0 km
    expect(points[0]!.distanceKm).toBeLessThanOrEqual(points[1]!.distanceKm);
  });

  it("distances are in km (Haversine sanity)", () => {
    const r = nearestPoints(FIRE_FIXTURE, 121.5, 25.04, 4);
    const kaohsiung = (r.points as { name: string; distanceKm: number }[]).find(
      (p) => p.name === "高雄分駐所",
    )!;
    // 台北→高雄 直線約 300km 量級
    expect(kaohsiung.distanceKm).toBeGreaterThan(250);
    expect(kaohsiung.distanceKm).toBeLessThan(360);
  });
});

describe("truncate.capToolResult", () => {
  it("returns array unchanged when under limits", () => {
    const data = [1, 2, 3];
    expect(capToolResult(data)).toBe(data);
  });

  it("truncates by maxItems", () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ i }));
    const r = capToolResult(data, { maxItems: 20 }) as CappedResult<{ i: number }>;
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(50);
    expect(r.returned).toBe(20);
    expect(r.sample).toHaveLength(20);
    expect(r.note).toContain("不是聚合或完整清單");
  });

  it("truncates further by maxChars", () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ blob: "x".repeat(500), i }));
    const r = capToolResult(data, { maxItems: 20, maxChars: 1000 }) as CappedResult<unknown>;
    expect(r.truncated).toBe(true);
    expect(JSON.stringify(r.sample).length).toBeLessThanOrEqual(1000);
  });
});

describe("geojsonQuery.fetchDataset", () => {
  beforeEach(() => clearDatasetCache());
  afterEach(() => vi.unstubAllGlobals());

  it("fetches a whitelisted dataset and caches it", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ type: "FeatureCollection", features: FIRE_FIXTURE }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const a = await fetchDataset("fireStations");
    const b = await fetchDataset("fireStations");
    expect(a).toBe(b); // cache hit → same array reference
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(countDataset(a).total).toBe(4);
  });

  it("rejects an unauthorized dataset id", async () => {
    await expect(fetchDataset("__not_whitelisted__")).rejects.toThrow(/未授權/);
  });
});

describe("h3Population.rankPointsByPopulation", () => {
  beforeEach(() => clearH3PopulationCache());
  afterEach(() => vi.unstubAllGlobals());

  it("joins points to H3 cells and ranks by night population", async () => {
    const res = 7;
    const points = [
      { lng: 121.5, lat: 25.04, name: "A" },
      { lng: 120.3, lat: 22.6, name: "B" },
      { lng: 121.0, lat: 23.5, name: "C-no-cell" },
    ];
    // 只給 A、B 建 cell（C 對不到 → 缺值，不可假裝為 population 0）
    const cells = [
      { h: latLngToCell(points[0]!.lat, points[0]!.lng, res), d: 5000, n: 8000 },
      { h: latLngToCell(points[1]!.lat, points[1]!.lng, res), d: 3000, n: 2000 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          metadata: {
            resolution: res,
            value_columns: ["d", "n"],
            source: "fixture-source",
            generated_at: "2026-01-02T03:04:05Z",
          },
          cells,
        }),
      })),
    );

    const r = await rankPointsByPopulation(points, 10, "night");
    const ranked = r.ranked as { name: string; population: number }[];
    expect(r.metric).toBe("night");
    expect(ranked[0]!.name).toBe("A"); // 夜間 8000 最高
    expect(ranked[0]!.population).toBe(8000);
    expect(ranked[1]!.name).toBe("B");
    expect(ranked).toHaveLength(2);
    expect(r.coverage).toMatchObject({
      inputPoints: 3,
      validPopulationPoints: 2,
      missingPopulationPoints: 1,
      coverageRatio: 2 / 3,
    });
    expect(r.data).toMatchObject({
      source: "fixture-source",
      generatedAt: "2026-01-02T03:04:05Z",
      interpretation: expect.stringContaining("不是附近人口密度"),
      aggregation: expect.stringContaining("不可跨點位加總"),
    });
    expect(r.coverage.coverageMeaning).toContain("不代表地理涵蓋率");
  });

  it("switches to day population when metric=day", async () => {
    const res = 7;
    const points = [
      { lng: 121.5, lat: 25.04, name: "A" },
      { lng: 120.3, lat: 22.6, name: "B" },
    ];
    const cells = [
      { h: latLngToCell(points[0]!.lat, points[0]!.lng, res), d: 1000, n: 9000 },
      { h: latLngToCell(points[1]!.lat, points[1]!.lng, res), d: 9000, n: 1000 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ metadata: { resolution: res }, cells }),
      })),
    );

    const r = await rankPointsByPopulation(points, 10, "day");
    const ranked = r.ranked as { name: string }[];
    expect(ranked[0]!.name).toBe("B"); // 日間 B 較高
  });

  it("keeps a valid zero but excludes null and invalid population values", async () => {
    const res = 7;
    const points = [
      { lng: 121.5, lat: 25.04, name: "zero" },
      { lng: 120.3, lat: 22.6, name: "null" },
      { lng: 121.0, lat: 23.5, name: "invalid" },
    ];
    const cells = [
      { h: latLngToCell(points[0]!.lat, points[0]!.lng, res), d: 0, n: 0 },
      { h: latLngToCell(points[1]!.lat, points[1]!.lng, res), d: 1, n: null },
      { h: latLngToCell(points[2]!.lat, points[2]!.lng, res), d: 1, n: "unknown" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ metadata: { resolution: res }, cells }),
      })),
    );

    const r = await rankPointsByPopulation(points, 10, "night");
    expect(r.ranked).toEqual([
      expect.objectContaining({ name: "zero", population: 0 }),
    ]);
    expect(r.coverage).toMatchObject({ validPopulationPoints: 1, missingPopulationPoints: 2 });
  });

  it("marks top-N rankings as samples with total and returned counts", async () => {
    const res = 7;
    const points = Array.from({ length: 3 }, (_, i) => ({
      lng: 121.5 + i * 0.02,
      lat: 25.04,
      name: `point-${i}`,
    }));
    const cells = points.map((point, i) => ({
      h: latLngToCell(point.lat, point.lng, res),
      d: i,
      n: i,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ metadata: { resolution: res }, cells }),
      })),
    );

    const r = await rankPointsByPopulation(points, 2, "night");
    expect(r.ranked).toMatchObject({ truncated: true, total: 3, returned: 2 });
  });
});

describe("rpcTools.callWhitelistedRpc", () => {
  it("rejects an unknown RPC name without hitting the network", async () => {
    const r = await callWhitelistedRpc("drop_table_users", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("未授權");
  });

  it("rejects when params fail schema validation", async () => {
    // get_fire_events_by_year 需要 target_year:number
    const r = await callWhitelistedRpc("get_fire_events_by_year", { target_year: "not-a-number" });
    expect(r.ok).toBe(false);
  });

  it("whitelist includes the required RPCs", () => {
    for (const name of [
      "get_data_catalog_by_theme",
      "get_data_catalog_for_layer",
      "get_fire_events_by_year",
      "get_h3_demographics_yearly",
    ]) {
      expect(RPC_WHITELIST[name]).toBeTruthy();
    }
  });
});
