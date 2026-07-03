// H3 人口密度空間 join — 把任意點位對到 H3 網格，取日 / 夜間人口做排名。
// 資料：public/h3/h3_population_res*.json（{metadata:{resolution,value_columns:["d","n"]}, cells:[{h,d,n}]}）。
// 注意：目前線上只有 res7（原規劃 res8 尚未產出），resolution 直接讀 metadata，不寫死。

import { latLngToCell } from "h3-js";
import { withLoading } from "../../lib/loadingRegistry";
import { capToolResult } from "./truncate";

const H3_POP_URL = "./h3/h3_population_res7.json";

interface PopCell {
  h: string;
  d: number; // 日間人口
  n: number; // 夜間人口
}
interface PopFile {
  metadata: { resolution: number; value_columns?: string[] };
  cells: PopCell[];
}

let popCache: { resolution: number; byCell: Map<string, PopCell> } | null = null;

async function loadH3Population() {
  if (popCache) return popCache;
  const file = await withLoading("chat-h3-population", "載入人口密度網格", fetchPop());
  const byCell = new Map<string, PopCell>();
  for (const c of file.cells ?? []) byCell.set(c.h, c);
  popCache = { resolution: file.metadata?.resolution ?? 7, byCell };
  return popCache;
}

async function fetchPop(): Promise<PopFile> {
  const res = await fetch(H3_POP_URL);
  if (!res.ok) throw new Error(`載入人口網格失敗（${res.status}）`);
  return (await res.json()) as PopFile;
}

/** 測試 / 重載用 */
export function clearH3PopulationCache(): void {
  popCache = null;
}

export interface RankInputPoint {
  lng: number;
  lat: number;
  name: string;
}
export interface RankedPoint extends RankInputPoint {
  population: number;
  h3: string;
}

/**
 * 把點位對到 H3 格、取日 / 夜間人口後由高到低排名，回前 topN。
 * @param dayOrNight "day" = 日間人口(d)，"night" = 夜間人口(n)
 */
export async function rankPointsByPopulation(
  points: RankInputPoint[],
  topN = 10,
  dayOrNight: "day" | "night" = "night",
) {
  const { resolution, byCell } = await loadH3Population();
  const ranked: RankedPoint[] = points.map((p) => {
    const h3 = latLngToCell(p.lat, p.lng, resolution);
    const cell = byCell.get(h3);
    const population = cell ? (dayOrNight === "day" ? cell.d : cell.n) : 0;
    return { ...p, h3, population: Math.round(population) };
  });
  ranked.sort((a, b) => b.population - a.population);
  const top = ranked.slice(0, Math.max(1, topN));
  return {
    metric: dayOrNight,
    resolution,
    ranked: capToolResult(top, { maxItems: topN }),
  };
}
