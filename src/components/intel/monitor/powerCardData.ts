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

/** fuel_type（資料庫英文 key／中文變體）→ 中文標籤；未知值一律「其他」，不印英文 key */
const FUEL_LABEL_ZH: Record<string, string> = {
  coal: "燃煤", 煤: "燃煤", "煤/輕柴油": "燃煤",
  oil: "燃油", 重油: "燃油",
  natural_gas: "燃氣", 天然氣: "燃氣", "天然氣/煤": "燃氣", 燃氣: "燃氣",
  oil_gas: "油氣",
  nuclear: "核能", 核能: "核能",
  hydro: "水力", 水: "水力",
  storage: "抽蓄",
  solar: "太陽光電",
  wind: "陸域風電",
  offshore_wind: "離岸風電",
  cogeneration: "汽電共生",
  other: "其他",
};

export function fuelLabelZh(fuel: string | null | undefined): string {
  if (!fuel) return "其他";
  return FUEL_LABEL_ZH[fuel] ?? "其他";
}

export interface PowerFuelGroup {
  /** 中文燃料標籤（同標籤的不同 key 併成一組） */
  label: string;
  plants: PowerPlantRow[];
  /** 組內出力合計（null 出力不計入）；抽蓄抽水時可能為負 */
  totalMw: number;
}

/** 依發電方式分組：組間依合計出力由大到小，組內維持出力由大到小（plants 已排序） */
export function groupPlantsByFuel(plants: PowerPlantRow[]): PowerFuelGroup[] {
  const map = new Map<string, PowerPlantRow[]>();
  for (const p of plants) {
    const label = fuelLabelZh(p.fuel);
    const arr = map.get(label);
    if (arr) arr.push(p); else map.set(label, [p]);
  }
  return Array.from(map.entries())
    .map(([label, ps]) => ({
      label,
      plants: [...ps].sort((a, b) => (b.mw ?? -Infinity) - (a.mw ?? -Infinity)),
      totalMw: ps.reduce((sum, p) => sum + (p.mw ?? 0), 0),
    }))
    .sort((a, b) => b.totalMw - a.totalMw);
}
