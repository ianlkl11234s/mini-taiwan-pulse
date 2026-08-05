import { withLoading } from "../lib/loadingRegistry";

/**
 * 殯葬禮儀業者「區級密度」（A 源，325 區）。
 *
 * 上游刻意**不帶幾何**：原始附鄉鎮面是 48.9 MB，改成純數值只有 5.1 KB，
 * 前端 join pulse 已有的 `public/base_map/township_boundary.pmtiles`
 * （join_key = TOWNCODE，上游已驗證 325/325 全對，0 筆對不上）。
 *
 * ⚠️ 語意是業者「**登記地**」家數，不是服務涵蓋率 —— 業者常跨區服務，
 *    不可當可及性指標（見 taipei-gis-analytics/docs/handoff/funeral-layers.md §3.3）。
 */

export interface FuneralDensityData {
  /** 必為 "TOWNCODE"；不符表示上游換了 join key → 呼叫端應中止 */
  joinKey: string;
  /** TOWNCODE(8 碼字串) → 業者家數；家數 0 的區不會出現在表裡 */
  values: Record<string, number>;
  /** 單一區最大家數（2026-08-05：218，臺北市萬華區） */
  maxCount: number;
  /** 全國業者總數（4,977；與 6,233 母體的差是無法定位到區的部分） */
  total: number;
}

interface RawDensity {
  join_key?: string;
  max_count?: number;
  total?: number;
  values?: Record<string, number>;
}

const URL = "./funeral/funeral_operators_density.json";

let cache: Promise<FuneralDensityData> | null = null;

/** 載入區級密度（模組級快取，重複呼叫共用同一個 promise） */
export function fetchFuneralDensity(): Promise<FuneralDensityData> {
  if (cache) return cache;
  cache = withLoading(
    "funeral-operator-density",
    "殯葬業者密度",
    fetch(URL).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as RawDensity;
      return {
        joinKey: raw.join_key ?? "",
        values: raw.values ?? {},
        maxCount: raw.max_count ?? 0,
        total: raw.total ?? 0,
      };
    }),
  ).catch((err) => {
    cache = null; // 失敗不留壞快取，下次 toggle 可重試
    throw err;
  });
  return cache;
}
