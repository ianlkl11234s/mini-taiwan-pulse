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

/** 14 廠出力的負載率 → 配色（>100% 紅 / >85% 橘 / >50% 綠 / 其他藍）*/
export function loadRateColor(rate: number | null): string {
  if (rate == null) return "#9ca3af";
  if (rate > 1.0) return "#ef4444";
  if (rate > 0.85) return "#f97316";
  if (rate > 0.5) return "#22c55e";
  return "#64aaff";
}
