import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey } from "../lib/loaderCache";

/**
 * 省道路況（TDX live_highway）動態圖層 loader（v1 highway only）
 *
 * 與 freeway 最大不同：幾何走 PMTiles（6818 段，payload 大），這裡只載
 * 「section_uid → 288 字元 timeline」對照表，前端以 Mapbox setFeatureState
 * 按當前 5 分鐘槽染色（見 useRoadCongestionLayer）。
 *
 * timeline：288 字元字串，每字元一個 5 分鐘槽，Asia/Taipei 00:00 對齊。
 *   '1'~'4' = congestion_level（1 順暢 / 2 車多 / 3 略壅 / 4 壅塞）
 *   '-' / '0' = 無資料（含當日尚未發生的未來槽）
 */

export interface RoadCongestionDateInfo {
  day: string;
  sections: number;
}

export interface RoadCongestionSection {
  section_uid: string;
  section_id: string;
  /** 288 字元；每字元一個 5 分鐘槽 */
  timeline: string;
}

export interface RoadCongestionDayData {
  date: string;
  sections: RoadCongestionSection[];
  /**
   * 全日「有資料」的最後一個 slot（跨所有路段取 max）。
   * refresh 只填已發生的槽，當下（leading edge）之後皆 '-'；realtime 讀「當下」
   * 常落在尚未刷新的槽 → 若不處理會全灰。用它把有效 slot clamp 到最新快照，
   * 呈現與 freeway 一致的「最新可得路況」；真正無資料的路段該槽仍是 '-' → 灰。
   */
  lastPopulatedSlot: number;
}

/** 等級 1~4 對應顏色（對齊 freeway 綠→紅；0 = 無資料灰） */
export const ROAD_CONGESTION_COLORS: Record<number, string> = {
  0: "#808080",
  1: "#22c55e",
  2: "#eab308",
  3: "#f97316",
  4: "#ef4444",
};

export const ROAD_CONGESTION_LABELS: Record<number, string> = {
  0: "無資料",
  1: "順暢",
  2: "車多",
  3: "略壅",
  4: "壅塞",
};

/** timeline 單一字元 → congestion level（非 1~4 皆視為無資料 0） */
export function levelFromChar(ch: string | undefined): number {
  if (ch === "1" || ch === "2" || ch === "3" || ch === "4") return Number(ch);
  return 0;
}

/**
 * 給定 unix 秒 → timeline slot index（0~287）。
 * slot = floor((台北當下 − 當日 00:00+08) / 300)，clamp 0~287。
 * 台北無 DST，固定 UTC+8，直接由 date key 組 00:00+08:00 即可。
 */
export function slotIndexAt(t: number): number {
  const dateKey = new Date(t * 1000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  });
  const midnight = Date.parse(`${dateKey}T00:00:00+08:00`) / 1000;
  const slot = Math.floor((t - midnight) / 300);
  return slot < 0 ? 0 : slot > 287 ? 287 : slot;
}

/** 取得可用日期 */
export async function fetchRoadCongestionDates(): Promise<RoadCongestionDateInfo[]> {
  const { data, error } = await withLoading(
    "roadCongestion:dates",
    "省道路況日期",
    supabase.rpc("get_road_congestion_dates"),
  );
  if (error) throw new Error(`get_road_congestion_dates: ${error.message}`);
  return (data ?? []) as RoadCongestionDateInfo[];
}

interface RawRow {
  section_uid: string;
  section_id: string;
  timeline: string;
}

async function fetchRoadCongestionDayUncached(date: string): Promise<RoadCongestionDayData> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `roadCongestion:${date}`,
    `省道路況 ${date}`,
    supabase.rpc("get_road_congestion_day", { target_date: date }),
  );
  if (error) throw new Error(`get_road_congestion_day(${date}): ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const sections: RoadCongestionSection[] = [];
  let lastPopulatedSlot = 0;
  for (const r of rows) {
    if (!r.section_uid || !r.timeline) continue;
    sections.push({
      section_uid: r.section_uid,
      section_id: r.section_id,
      timeline: r.timeline,
    });
    // 該段最後一個有資料的 slot → 更新全域 max
    for (let i = r.timeline.length - 1; i > lastPopulatedSlot; i--) {
      if (levelFromChar(r.timeline[i]) > 0) {
        lastPopulatedSlot = i;
        break;
      }
    }
  }

  console.log(
    `[RoadCongestion] Loaded ${sections.length} sections for ${date} (lastPopulatedSlot=${lastPopulatedSlot}) in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return { date, sections, lastPopulatedSlot };
}

const fetchRoadCongestionDayCached = cachedByKey(fetchRoadCongestionDayUncached, 10 * 60_000);

/** 載入某一天全部路段 timeline。10min TTL 快取，toggle 不重抓 */
export function fetchRoadCongestionDay(date: string): Promise<RoadCongestionDayData> {
  return fetchRoadCongestionDayCached(date);
}
