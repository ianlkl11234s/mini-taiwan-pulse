import { describe, it, expect } from "vitest";
import {
  buildPowerCardModel,
  loadRateColor,
  POWER_REGION_ORDER,
} from "../powerCardData";
import type { PowerDashboard, PowerGenerationDay } from "../../../../data/energyLoader";

const EMPTY_DASHBOARD: PowerDashboard = { status: null, regions: [] };
const EMPTY_DAY: PowerGenerationDay = { plants: [], ts_range: { lo: 0, hi: 0 } };

describe("buildPowerCardModel", () => {
  it("returns 4 region slots even when data missing", () => {
    const m = buildPowerCardModel(null, null);
    expect(m.regions.map((r) => r.region)).toEqual([...POWER_REGION_ORDER]);
    expect(m.regions.every((r) => r.mw === null && r.pct === 0)).toBe(true);
    expect(m.plants).toEqual([]);
    expect(m.indicator).toBeNull();
    expect(m.observedHHMM).toBe("—");
  });

  it("normalises region pct against the local max (北部 13331 → 1.0; 東部 501 → ~0.038)", () => {
    const dashboard: PowerDashboard = {
      status: {
        observed_at: "2026-06-19T13:42:11+08:00",
        curr_load_mw: 37198, curr_util_rate: 0.92,
        supply_capacity_mw: 44400, peak_load_mw: 37198,
        reserve_capacity_mw: 7202, reserve_rate_pct: 19.4,
        reserve_indicator: "G", peak_hour_range: "13:00-16:00",
        realtime_supply_capacity_mw: 44400,
      },
      regions: [
        { region: "北部", observed_at: "x", generation_mw: null, consumption_mw: 13331 },
        { region: "中部", observed_at: "x", generation_mw: null, consumption_mw: 10710 },
        { region: "南部", observed_at: "x", generation_mw: null, consumption_mw: 12656 },
        { region: "東部", observed_at: "x", generation_mw: null, consumption_mw: 501 },
      ],
    };
    const m = buildPowerCardModel(dashboard, null);
    expect(m.indicator).toBe("G");
    expect(m.observedHHMM).toBe("13:42");
    const north = m.regions.find((r) => r.region === "北部")!;
    const east = m.regions.find((r) => r.region === "東部")!;
    expect(north.pct).toBeCloseTo(1, 5);
    expect(east.pct).toBeCloseTo(501 / 13331, 5);
  });

  it("derives plant mw / load_rate from last sample, sorted desc by mw", () => {
    const day: PowerGenerationDay = {
      plants: [
        {
          plant_name: "台中",
          fuel_type: "coal",
          capacity_mw: 5780,
          lon: 120.55, lat: 24.21,
          points: [[100, 4000], [200, 4393]],
        },
        {
          plant_name: "大潭",
          fuel_type: "natural_gas",
          capacity_mw: 5000,
          lon: 121.05, lat: 25.05,
          points: [[100, 5800], [200, 6108]],
        },
        {
          plant_name: "離線廠",
          fuel_type: "wind",
          capacity_mw: 100,
          lon: 0, lat: 0,
          points: [],
        },
      ],
      ts_range: { lo: 100, hi: 200 },
    };
    const m = buildPowerCardModel(EMPTY_DASHBOARD, day);
    expect(m.plants.map((p) => p.name)).toEqual(["大潭", "台中", "離線廠"]);
    const datan = m.plants[0]!;
    expect(datan.mw).toBe(6108);
    expect(datan.rate).toBeCloseTo(6108 / 5000, 5);
    const taichung = m.plants[1]!;
    expect(taichung.spark).toEqual([4000, 4393]);
    const offline = m.plants[2]!;
    expect(offline.mw).toBeNull();
    expect(offline.rate).toBeNull();
    expect(offline.spark).toEqual([]);
  });

  it("clamps load_rate to [0, 1.5] (handle dirty data)", () => {
    const day: PowerGenerationDay = {
      plants: [{
        plant_name: "壞資料", fuel_type: null, capacity_mw: 100,
        lon: 0, lat: 0,
        points: [[1, 9999]], // implies rate 99.99 → clamp 1.5
      }],
      ts_range: { lo: 1, hi: 1 },
    };
    const m = buildPowerCardModel(EMPTY_DASHBOARD, day);
    expect(m.plants[0]!.rate).toBe(1.5);
  });

  it("uses '—' as observedHHMM placeholder when status missing", () => {
    const m = buildPowerCardModel(EMPTY_DASHBOARD, EMPTY_DAY);
    expect(m.observedHHMM).toBe("—");
  });
});

describe("loadRateColor", () => {
  it("maps load rate buckets to expected hex colors", () => {
    expect(loadRateColor(null)).toBe("#9ca3af");
    expect(loadRateColor(0.3)).toBe("#64aaff");
    expect(loadRateColor(0.6)).toBe("#22c55e");
    expect(loadRateColor(0.9)).toBe("#f97316");
    expect(loadRateColor(1.2)).toBe("#ef4444");
  });

  it("boundary values (exactly 0.5/0.85/1.0) fall to lower bucket", () => {
    expect(loadRateColor(0.5)).toBe("#64aaff");
    expect(loadRateColor(0.85)).toBe("#22c55e");
    expect(loadRateColor(1.0)).toBe("#f97316");
  });
});
