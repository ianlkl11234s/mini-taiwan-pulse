import type { ErHospital24hAllRow, ErHospitalLatest } from "../../../data/erHospitalLoader";
import { classifyErCongestion, type ErCongestionLevel } from "../../../data/erCongestionTypes";

/**
 * ERCard 卡片網格的資料整形（比照 powerCardData.ts）。
 *
 * RPC 的 area_name 是 19 個縣市（實測無離島縣市 —— 澎湖／金門／連江沒有
 * 重度級或兒童急救責任醫院）。監看卡要跟能源卡 UNIT OUTPUT 同一視覺語彙，
 * 因此把縣市收斂成台電四大區（北／中／南／東），宜蘭歸北部（台電慣例）。
 * 未知縣市（名單年年評定會變）落到「其他」，不吃掉資料。
 */

export const ER_REGION_ORDER = ["北部", "中部", "南部", "東部", "其他"] as const;
export type ErRegion = (typeof ER_REGION_ORDER)[number];

const AREA_TO_REGION: Record<string, ErRegion> = {
  臺北市: "北部", 新北市: "北部", 基隆市: "北部", 桃園市: "北部",
  新竹市: "北部", 新竹縣: "北部", 宜蘭縣: "北部",
  苗栗縣: "中部", 臺中市: "中部", 彰化縣: "中部", 南投縣: "中部", 雲林縣: "中部",
  嘉義市: "南部", 嘉義縣: "南部", 臺南市: "南部", 高雄市: "南部", 屏東縣: "南部",
  花蓮縣: "東部", 臺東縣: "東部",
};

export function erRegionOf(areaName: string | null | undefined): ErRegion {
  return (areaName && AREA_TO_REGION[areaName]) || "其他";
}

export interface ErHospitalCell {
  hospId: string;
  name: string;
  areaName: string;
  /** 當前等一般病床數（latest RPC） */
  wait: number | null;
  /** 24h wait_general_cnt 折線（已去除 null 點） */
  spark: number[];
}

export interface ErRegionGroup {
  region: ErRegion;
  hospitals: ErHospitalCell[];
}

/** latest 快照 + 24h 打包 → 依區分組，區內按等一般病床數 desc（無資料墊底） */
export function buildErRegionGroups(
  latest: ErHospitalLatest[],
  series: ErHospital24hAllRow[],
): ErRegionGroup[] {
  const sparkById = new Map<string, number[]>();
  for (const row of series) {
    const values: number[] = [];
    for (const p of row.points ?? []) {
      if (p[3] != null) values.push(p[3]);
    }
    sparkById.set(row.hosp_id, values);
  }

  const byRegion = new Map<ErRegion, ErHospitalCell[]>();
  for (const h of latest) {
    const region = erRegionOf(h.area_name);
    const cell: ErHospitalCell = {
      hospId: h.hosp_id,
      name: h.hosp_name,
      areaName: h.area_name,
      wait: h.wait_general_cnt,
      spark: sparkById.get(h.hosp_id) ?? [],
    };
    const bucket = byRegion.get(region);
    if (bucket) bucket.push(cell);
    else byRegion.set(region, [cell]);
  }

  return ER_REGION_ORDER
    .map((region) => ({
      region,
      hospitals: (byRegion.get(region) ?? []).sort((a, b) => (b.wait ?? -1) - (a.wait ?? -1)),
    }))
    .filter((g) => g.hospitals.length > 0);
}

/**
 * 總集摘要（全台 / 單區共用，`erCongestionTypes.classifyErCongestion` 沿用既有分級，
 * 不發明新閾值）。四級對映使用者需求「紅/橘/黃/綠」：
 *   severe(紅) / congested(橘) / light(黃) / smooth(綠)
 * `nodata`（wait_general_cnt 為 null）不計入 counts 也不計入 total，另以 noData 回報。
 */
export type ErSeverityLevel = Exclude<ErCongestionLevel, "nodata">;

/** 顯示順序：紅 → 橘 → 黃 → 綠（嚴重度由高到低） */
export const ER_SEVERITY_ORDER: readonly ErSeverityLevel[] = ["severe", "congested", "light", "smooth"];

export interface ErSummary {
  /** 有資料醫院的等一般病床數合計 */
  total: number;
  /** 各嚴重度家數（不含 nodata） */
  counts: Record<ErSeverityLevel, number>;
  /** 無資料（wait_general_cnt === null）家數 */
  noData: number;
}

/** 純函式：全台與單區共用，傳入不同醫院子集即可 */
export function buildErSummary(hospitals: ErHospitalCell[]): ErSummary {
  const counts: Record<ErSeverityLevel, number> = { severe: 0, congested: 0, light: 0, smooth: 0 };
  let total = 0;
  let noData = 0;
  for (const h of hospitals) {
    if (h.wait == null) { noData++; continue; }
    counts[classifyErCongestion(h.wait) as ErSeverityLevel]++;
    total += h.wait;
  }
  return { total, counts, noData };
}
