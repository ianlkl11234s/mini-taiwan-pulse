// H3 人口空間 join — 把任意點位對到所在 H3 網格，取日 / 夜間人口做排名。
// 資料：public/h3/h3_population_res*.json（{metadata:{resolution,value_columns:["d","n"]}, cells:[{h,d,n}]}）。
// 注意：目前線上只有 res7（原規劃 res8 尚未產出），resolution 直接讀 metadata，不寫死。

import { latLngToCell } from "h3-js";
import { withLoading } from "../../lib/loadingRegistry";
import { capToolResult } from "./truncate";

const H3_POP_URL = "./h3/h3_population_res7.json";

interface PopCell {
  h: string;
  d?: unknown; // 日間人口
  n?: unknown; // 夜間人口
}
interface PopFile {
  metadata: {
    resolution?: number;
    value_columns?: string[];
    source?: string;
    generated_at?: string;
  };
  cells: PopCell[];
}

let popCache: {
  resolution: number;
  source: string | null;
  generatedAt: string | null;
  byCell: Map<string, PopCell>;
} | null = null;

async function loadH3Population() {
  if (popCache) return popCache;
  const file = await withLoading("chat-h3-population", "載入人口密度網格", fetchPop());
  const byCell = new Map<string, PopCell>();
  for (const c of file.cells ?? []) byCell.set(c.h, c);
  popCache = {
    resolution: file.metadata?.resolution ?? 7,
    source: typeof file.metadata?.source === "string" ? file.metadata.source : null,
    generatedAt: typeof file.metadata?.generated_at === "string" ? file.metadata.generated_at : null,
    byCell,
  };
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

function validPopulation(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * 把點位對到所在 H3 格、取日 / 夜間人口後由高到低排名，回前 topN。
 * 找不到格、人口為 null 或無效值時，不以 0 代替，而是明確排除並回 coverage。
 * @param dayOrNight "day" = 日間人口(d)，"night" = 夜間人口(n)
 */
export async function rankPointsByPopulation(
  points: RankInputPoint[],
  topN = 10,
  dayOrNight: "day" | "night" = "night",
) {
  const { resolution, source, generatedAt, byCell } = await loadH3Population();
  const ranked: RankedPoint[] = [];
  let missingPopulationPoints = 0;
  for (const p of points) {
    const h3 = latLngToCell(p.lat, p.lng, resolution);
    const cell = byCell.get(h3);
    const population = cell && (dayOrNight === "day" ? cell.d : cell.n);
    if (!validPopulation(population)) {
      missingPopulationPoints++;
      continue;
    }
    ranked.push({ ...p, h3, population: Math.round(population) });
  }
  ranked.sort((a, b) => b.population - a.population);
  return {
    metric: dayOrNight,
    resolution,
    data: {
      value: "population",
      unit: "people",
      interpretation: `每個點位所在 H3 resolution ${resolution} 格的${dayOrNight === "day" ? "日" : "夜"}間人口；不是附近人口密度或服務範圍。`,
      aggregation: "同一 H3 格內的多個點位共用同一人口值，不可跨點位加總。",
      source,
      generatedAt,
    },
    coverage: {
      inputPoints: points.length,
      validPopulationPoints: ranked.length,
      missingPopulationPoints,
      coverageRatio: points.length === 0 ? null : ranked.length / points.length,
      coverageMeaning: "輸入點成功取得有效 H3 人口值的比例，不代表地理涵蓋率。",
    },
    ranked: capToolResult(ranked, { maxItems: Math.max(1, topN) }),
  };
}
