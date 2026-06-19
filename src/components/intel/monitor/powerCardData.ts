import type { PowerDashboard, PowerGenerationDay } from "../../../data/energyLoader";

export const POWER_REGION_ORDER = ["北部", "中部", "南部", "東部"] as const;

export interface PowerRegionRow {
  region: string;
  mw: number | null;
  pct: number; // 0~1 normalized against current max
}

export interface PowerPlantRow {
  name: string;
  mw: number | null;
  rate: number | null;
  spark: number[];
  fuel: string | null;
}

export interface PowerCardModel {
  indicator: string | null;
  observedHHMM: string;
  regions: PowerRegionRow[];
  plants: PowerPlantRow[];
}

export function buildPowerCardModel(
  dashboard: PowerDashboard | null,
  day: PowerGenerationDay | null,
): PowerCardModel {
  const status = dashboard?.status ?? null;

  const regionMap: Record<string, number | null> = {};
  for (const r of dashboard?.regions ?? []) {
    if (r.consumption_mw != null) regionMap[r.region] = r.consumption_mw;
  }
  const max = Math.max(
    1,
    ...POWER_REGION_ORDER.map((r) => regionMap[r] ?? 0),
  );
  const regions: PowerRegionRow[] = POWER_REGION_ORDER.map((r) => {
    const mw = regionMap[r] ?? null;
    return { region: r, mw, pct: mw != null ? Math.min(1, mw / max) : 0 };
  });

  const plantList = day?.plants ?? [];
  const plants: PowerPlantRow[] = plantList
    .map((p) => {
      const pts = p.points ?? [];
      const last = pts.length ? pts[pts.length - 1]! : null;
      const mw = last ? last[1] : null;
      const rate = mw != null && p.capacity_mw && p.capacity_mw > 0
        ? Math.min(1.5, Math.max(0, mw / p.capacity_mw))
        : null;
      return {
        name: p.plant_name,
        mw,
        rate,
        spark: pts.map((pt) => pt[1]),
        fuel: p.fuel_type,
      };
    })
    .sort((a, b) => (b.mw ?? 0) - (a.mw ?? 0));

  return {
    indicator: status?.reserve_indicator ?? null,
    observedHHMM: status?.observed_at ? status.observed_at.slice(11, 16) : "—",
    regions,
    plants,
  };
}

export interface PowerKpiFuelSlice {
  fuel: string;
  mw: number;
  pct: number; // 0~1 of totalMW
}

export interface PowerKpiSummary {
  /** 14 廠 24h 內每個 ts 的全國出力總和的最高峰 */
  peakMW: number;
  /** 該峰所在 ts (unix seconds)，若無資料為 null */
  peakTs: number | null;
  /** 最新一個 ts 的全國總出力 */
  latestMW: number;
  /** 最新一個 ts 的 fuel 分佈，按 mw desc 排序 */
  fuelMix: PowerKpiFuelSlice[];
}

const EMPTY_KPI: PowerKpiSummary = {
  peakMW: 0, peakTs: null, latestMW: 0, fuelMix: [],
};

/**
 * 從 24h preload 算 KPI：
 *  - 全國 24h 各時點負載和的 peak
 *  - 最新時點的 fuel 分佈
 *
 * 假設：所有廠的 points 共用同一份 ts 軸；若沒有則回退用最末點。
 */
export function summarisePowerKpis(day: PowerGenerationDay | null): PowerKpiSummary {
  const plants = day?.plants ?? [];
  if (plants.length === 0) return EMPTY_KPI;

  // step 1：合併所有 unique ts → 每個 ts 全國總和
  const totalByTs = new Map<number, number>();
  for (const p of plants) {
    for (const [ts, mw] of p.points ?? []) {
      totalByTs.set(ts, (totalByTs.get(ts) ?? 0) + mw);
    }
  }
  let peakMW = 0;
  let peakTs: number | null = null;
  let latestTs = -Infinity;
  let latestMW = 0;
  for (const [ts, mw] of totalByTs) {
    if (mw > peakMW) { peakMW = mw; peakTs = ts; }
    if (ts > latestTs) { latestTs = ts; latestMW = mw; }
  }

  // step 2：最新時點的 fuel 分佈 — 對每廠取「最後一個 ts <= latestTs 的 mw」
  const fuelTotals = new Map<string, number>();
  for (const p of plants) {
    const pts = p.points ?? [];
    if (pts.length === 0) continue;
    // 取最後一個 ts <= latestTs（若所有 ts 都 > latestTs，跳過）
    let last: number | null = null;
    for (const [ts, mw] of pts) {
      if (ts <= latestTs) last = mw;
    }
    if (last == null) continue;
    const fuel = p.fuel_type ?? "unknown";
    fuelTotals.set(fuel, (fuelTotals.get(fuel) ?? 0) + last);
  }
  const totalFuel = Array.from(fuelTotals.values()).reduce((a, b) => a + b, 0) || 1;
  const fuelMix: PowerKpiFuelSlice[] = Array.from(fuelTotals.entries())
    .map(([fuel, mw]) => ({ fuel, mw, pct: mw / totalFuel }))
    .sort((a, b) => b.mw - a.mw);

  return {
    peakMW,
    peakTs,
    latestMW,
    fuelMix,
  };
}

/** 14 廠出力的負載率 → 配色（>100% 紅 / >85% 橘 / >50% 綠 / 其他藍）*/
export function loadRateColor(rate: number | null): string {
  if (rate == null) return "#9ca3af";
  if (rate > 1.0) return "#ef4444";
  if (rate > 0.85) return "#f97316";
  if (rate > 0.5) return "#22c55e";
  return "#64aaff";
}
