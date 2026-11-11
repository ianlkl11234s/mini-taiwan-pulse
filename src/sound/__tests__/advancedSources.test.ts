/**
 * W5 自然聲源三族：unknown 不變 0、離海太遠 inactive、水位無歷史 unknown、無植被 unknown／inactive。
 */
import { describe, expect, it } from "vitest";
import { DATE, DAY_START, RECV, latNorth } from "./fixtures";
import { queryFamilyInterval, queryReceiver, SOUND_FAMILIES_ADVANCED } from "../engines/receiverQuery";
import { percentileRank, vegetationFactor, wavePotential, windPotential } from "../engines/naturalKernels";
import { NATURAL_BLOCK_SCHEMA, loadAdvancedFamily, naturalSnapshotSet, parseNaturalBlock, type SceneNaturalBlock } from "../advancedSources";
import { canopyCover, type CanopyGrid } from "../sourceAdapters/windVegetationAdapter";
import { loadRiverWater } from "../sourceAdapters/riverWaterAdapter";
import type { AnySoundFamily, SoundSourceSet } from "../types";

type AnySet = SoundSourceSet<unknown, AnySoundFamily>;
const H = 3600;
const T10 = DAY_START + 10 * H; // 10:00
const bboxAround = (half = 0.2): [number, number, number, number] => [RECV.longitude - half, RECV.latitude - half, RECV.longitude + half, RECV.latitude + half];

/** 接收點周圍 ±0.01° 的樹冠格網，填固定高度（-1＝遮罩） */
function grid(fill: number): CanopyGrid {
  const nx = 40;
  const ny = 40;
  return { bbox: [RECV.longitude - 0.01, RECV.latitude - 0.01, RECV.longitude + 0.01, RECV.latitude + 0.01], nx, ny, heights: new Array(nx * ny).fill(fill) };
}

const QTABLE = { probs: [0.05, 0.5, 0.95], values: [1.0, 1.5, 3.0], n: 1000 };

function block(over: Partial<SceneNaturalBlock> = {}): SceneNaturalBlock {
  const b = bboxAround();
  const near: [number, number] = [RECV.longitude, latNorth(2_000)];
  const hours = Array.from({ length: 24 }, (_, h) => DAY_START + h * H);
  return {
    schema: NATURAL_BLOCK_SCHEMA,
    wind: { health: "ok", bbox: b, stations: [{ id: "W1", name: "風站", lon: near[0], lat: near[1], alt_m: 10 }], obs: hours.map((t) => [0, t, 8, 12] as [number, number, number, number]) },
    wave: { health: "ok", bbox: b, stations: [{ id: "B1", name: "浮標", type: "浮標站", lon: near[0], lat: latNorth(10_000) }], obs: hours.map((t) => [0, t, 2, 9] as [number, number, number, number]) },
    river: { health: "ok", bbox: b, history_basis: "test 60d", stations: [{ id: "R1", name: "水位站", lon: near[0], lat: near[1], q: QTABLE }], obs: hours.map((t) => [0, t, 2.25] as [number, number, number]) },
    canopy: { ...grid(10), heights: [...grid(10).heights] },
    // 海岸：接收點北方 300 m 起的一塊海面
    coast: { bbox: b, geometry: { type: "Polygon", coordinates: [[[RECV.longitude - 0.1, latNorth(300)], [RECV.longitude + 0.1, latNorth(300)], [RECV.longitude + 0.1, latNorth(20_000)], [RECV.longitude - 0.1, latNorth(20_000)], [RECV.longitude - 0.1, latNorth(300)]]] } },
    // 河道：接收點北方 50 m 的東西向線
    river_network: { bbox: b, geometry: { type: "LineString", coordinates: [[RECV.longitude - 0.05, latNorth(50)], [RECV.longitude + 0.05, latNorth(50)]] } },
    ...over,
  };
}

function setsOf(b: SceneNaturalBlock): AnySet[] {
  return SOUND_FAMILIES_ADVANCED.map((f) => naturalSnapshotSet(b, f, DATE)).filter((s): s is NonNullable<typeof s> => !!s) as AnySet[];
}

describe("natural kernels", () => {
  it("are monotone, 0–1, and null on invalid input (never 0)", () => {
    expect(windPotential(1)).toBe(0);
    expect(windPotential(5)!).toBeLessThan(windPotential(10)!);
    expect(windPotential(40)!).toBeLessThanOrEqual(1);
    expect(windPotential(null)).toBeNull();
    expect(windPotential(-1)).toBeNull();
    expect(vegetationFactor(0.25)).toBeCloseTo(0.5);
    expect(vegetationFactor(0.9)).toBe(1);
    expect(wavePotential(1, 8)!).toBeLessThan(wavePotential(3, 8)!);
    expect(wavePotential(2, null)).toBeNull();
    expect(wavePotential(null, 8)).toBeNull();
    expect(percentileRank(1.5, QTABLE)).toBeCloseTo(0.5);
    expect(percentileRank(0.1, QTABLE)).toBe(0.05);
    expect(percentileRank(9, QTABLE)).toBe(0.95);
    expect(percentileRank(null, QTABLE)).toBeNull();
    expect(percentileRank(2, null)).toBeNull();
  });
});

describe("advanced families via receiverQuery", () => {
  it("all three active on a healthy block", () => {
    const q = queryReceiver(RECV, T10, setsOf(block()), SOUND_FAMILIES_ADVANCED);
    const by = Object.fromEntries(q.families.map((f) => [f.family, f]));
    expect(by.wind_vegetation!.status).toBe("active");
    expect(by.wind_vegetation!.contributions[0]!.proxyKind).toBe("wind_speed_x_canopy");
    expect(by.coastal_wave!.status).toBe("active");
    expect(by.river_water!.status).toBe("active");
    // 2.25 m 在 1.5–3.0 之間 → 分位 0.725；× 距離係數（50 m / 80 m）
    expect(by.river_water!.relativePotential!).toBeCloseTo(0.725 / (1 + (50 / 80) ** 2), 2);
    for (const f of q.families) expect(f.contributions.every((c) => c.modeledDbA === null)).toBe(true);
  });

  it("wind: no vegetation sampled → unknown; all masked → unknown; zero canopy → inactive (no urban turbulence)", () => {
    const noGrid = block({ canopy: undefined });
    expect(queryFamilyInterval("wind_vegetation", setsOf(noGrid), RECV, T10, T10)).toMatchObject({ status: "unknown", relativePotential: null, reason: "vegetation_not_sampled" });
    const masked = block({ canopy: { ...grid(-1), heights: [...grid(-1).heights] } });
    expect(queryFamilyInterval("wind_vegetation", setsOf(masked), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "canopy_masked_ambiguous" });
    const bare = block({ canopy: { ...grid(0), heights: [...grid(0).heights] } });
    expect(queryFamilyInterval("wind_vegetation", setsOf(bare), RECV, T10, T10)).toMatchObject({ status: "inactive", relativePotential: 0 });
  });

  it("wind: missing hour or null speed → unknown, not 0", () => {
    const b = block();
    b.wind!.obs = b.wind!.obs.filter(([, t]) => t !== T10);
    expect(queryFamilyInterval("wind_vegetation", setsOf(b), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "station_hour_missing" });
    const n = block();
    n.wind!.obs = n.wind!.obs.map(([i, t, ws, g]) => (t === T10 ? [i, t, null, null] : [i, t, ws, g]));
    expect(queryFamilyInterval("wind_vegetation", setsOf(n), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "wind_speed_null", relativePotential: null });
  });

  it("wind: a never-reporting nearer station does not shadow a reporting one", () => {
    const b = block();
    b.wind!.stations.push({ id: "W0", name: "壞站", lon: RECV.longitude, lat: RECV.latitude, alt_m: 0 });
    b.wind!.obs.push(...b.wind!.obs.map(([, t]) => [1, t, null, null] as [number, number, null, null]));
    expect(queryFamilyInterval("wind_vegetation", setsOf(b), RECV, T10, T10).status).toBe("active");
  });

  it("wind: station too far → unknown", () => {
    const b = block();
    b.wind!.stations[0]!.lat = latNorth(20_000);
    expect(queryFamilyInterval("wind_vegetation", setsOf(b), RECV, T10, T10).status).toBe("unknown");
  });

  it("canopyCover: alpha0 cells count as no-tree only when neighbours have data", () => {
    const g = grid(-1);
    const h = [...g.heights];
    h[20 * g.nx + 20] = 12; // 接收點附近一格有樹
    const c = canopyCover({ ...g, heights: h }, RECV.longitude, RECV.latitude);
    expect(c).not.toBeNull();
    expect(c).not.toBe("masked");
    expect(typeof c === "object" && c!.cover > 0 && c!.cover < 0.2).toBe(true);
    expect(canopyCover(g, RECV.longitude + 1, RECV.latitude)).toBeNull();
  });

  it("wave: receiver farther than threshold from coast → inactive even when wave data missing", () => {
    const far = { ...RECV, latitude: latNorth(-3_000) };
    const b = block();
    b.wave!.obs = [];
    expect(queryFamilyInterval("coastal_wave", setsOf(b), far, T10, T10)).toMatchObject({ status: "inactive", relativePotential: 0 });
  });

  it("wave: near coast but height/period missing → unknown; no coastline → unknown", () => {
    const b = block();
    b.wave!.obs = b.wave!.obs.map(([i, t, hs, tp]) => [i, t, hs, t === T10 ? null : tp]);
    expect(queryFamilyInterval("coastal_wave", setsOf(b), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "wave_height_or_period_null", relativePotential: null });
    expect(queryFamilyInterval("coastal_wave", setsOf(block({ coast: undefined })), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "coastline_not_loaded_here" });
  });

  it("river: no history quantiles (or too few samples) → unknown", () => {
    const b = block();
    b.river!.stations[0]!.q = null;
    expect(queryFamilyInterval("river_water", setsOf(b), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "no_station_history_quantiles", relativePotential: null });
    const few = block();
    few.river!.stations[0]!.q = { ...QTABLE, n: 10 };
    expect(queryFamilyInterval("river_water", setsOf(few), RECV, T10, T10).reason).toBe("no_station_history_quantiles");
  });

  it("river: far from channel → inactive; no network → unknown", () => {
    const far = { ...RECV, latitude: latNorth(-1_000) };
    expect(queryFamilyInterval("river_water", setsOf(block()), far, T10, T10).status).toBe("inactive");
    expect(queryFamilyInterval("river_water", setsOf(block({ river_network: undefined })), RECV, T10, T10)).toMatchObject({ status: "unknown", reason: "river_network_not_loaded_here" });
  });

  it("snapshot health error → family unknown (not 0)", () => {
    const b = block();
    b.wind!.health = "error";
    expect(queryFamilyInterval("wind_vegetation", setsOf(b), RECV, T10, T10)).toMatchObject({ status: "unknown", relativePotential: null });
  });
});

describe("loading", () => {
  it("parseNaturalBlock drops malformed sub-blocks and rejects other schemas", () => {
    expect(parseNaturalBlock({ natural: { schema: "x" } })).toBeNull();
    const p = parseNaturalBlock({ natural: { ...block(), canopy: { bbox: [0, 0, 1, 1], nx: 2, ny: 2, heights: [1] } } });
    expect(p?.canopy).toBeUndefined();
    expect(p?.wind).toBeDefined();
  });

  it("live wind / wave are unavailable sources → unknown, never 0", async () => {
    const w = await loadAdvancedFamily("wind_vegetation", DATE, null);
    const v = await loadAdvancedFamily("coastal_wave", DATE, null);
    for (const r of [w, v]) {
      expect(r.origin).toBe("live");
      const res = queryFamilyInterval(r.set.family, [r.set as AnySet], RECV, T10, T10);
      expect(res.status).toBe("unknown");
      expect(res.relativePotential).toBeNull();
    }
  });

  it("live river without quantile file / network → unknown", async () => {
    const set = await loadRiverWater(
      { date: DATE },
      {
        day: async () => [{ station_id: "R1", station_name: "x", lat: RECV.latitude, lng: RECV.longitude, bucket_at: new Date(T10 * 1000).toISOString(), observed_at: new Date(T10 * 1000).toISOString(), water_level_m: 2, check_result: null }],
        quantiles: async () => ({}),
      },
    );
    const res = queryFamilyInterval("river_water", [set as AnySet], RECV, T10, T10);
    expect(res).toMatchObject({ status: "unknown", reason: "river_network_not_loaded_here" });
  });
});
