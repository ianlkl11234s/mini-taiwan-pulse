import type { PowerDashboard, PowerGenerationDay, TaipowerRegion } from "../../../data/energyLoader";

export const POWER_REGION_ORDER = ["北部", "中部", "南部", "東部"] as const;

export interface PowerRegionRow {
  region: string;
  mw: number | null;
  pct: number | null; // 0~1 normalized against current max；缺區＝null（v2 顯示「—」）
}

export interface PowerPlantRow {
  name: string;
  mw: number | null;
  rate: number | null;
  spark: number[];
  fuel: string | null;
  region: TaipowerRegion | null;
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
    return { region: r, mw, pct: mw != null ? Math.min(1, mw / max) : null };
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
        region: p.taipower_region ?? null,
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

const REGION_GROUP_DEFS: { key: TaipowerRegion | null; label: string; note?: string; always?: boolean }[] = [
  { key: "north", label: "北部", always: true },
  { key: "central", label: "中部", always: true },
  { key: "south", label: "南部", always: true },
  { key: "east", label: "東部", always: true },
  { key: "offshore_island", label: "離島", note: "不屬台電本島四區", always: true },
  { key: null, label: "未分區" },
];

/** 區域中文標籤；null＝未分區 */
export function regionLabelZh(region: TaipowerRegion | null | undefined): string {
  return REGION_GROUP_DEFS.find((d) => d.key === (region ?? null))?.label ?? "未分區";
}

export interface PowerRegionGroup {
  label: string;
  note?: string;
  plants: PowerPlantRow[];
  totalMw: number;
}

/**
 * 依台電區域分組：固定順序 北部、中部、南部、東部、離島、未分區；
 * 前五組永遠存在（東部沒電廠時 plants 為空，由 UI 顯示「沒有資料」而非 0 MW），未分區有電廠才出現。
 * 組內依出力由大到小。
 */
export function groupPlantsByRegion(plants: PowerPlantRow[]): PowerRegionGroup[] {
  return REGION_GROUP_DEFS
    .map((d) => {
      const ps = plants
        .filter((p) => (p.region ?? null) === d.key)
        .sort((a, b) => (b.mw ?? -Infinity) - (a.mw ?? -Infinity));
      return { label: d.label, note: d.note, plants: ps, totalMw: ps.reduce((s, p) => s + (p.mw ?? 0), 0), always: d.always };
    })
    .filter((g) => g.always || g.plants.length > 0)
    .map(({ always: _a, ...g }) => g);
}
