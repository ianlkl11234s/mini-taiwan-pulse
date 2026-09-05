import { withLoading } from "../lib/loadingRegistry";
import {
  fetchGlobalEventCandidatesWindow,
  fetchGlobalEventsWindow,
  selectGlobalSituationEntries,
  type GlobalSituationEntry,
} from "./globalEventsLoader";
import { selectGlobalEventsOverview } from "./globalEventsPresentation";

/**
 * INTEL「全球情勢」分頁專用 feed loader。
 *
 * 與 `useGlobalEventsLayer` 的差異：面板不依賴地圖圖層是否開啟，也不跟隨
 * timeline 的秒級游標，只跟著 `timeStore` 的**日期**走（與國內新聞
 * `fetchNewsEventsDayClusters` 同一套契約）。
 *
 * 這裡只組合既有的 window loader / 候選分頁 loader / available_at 篩選，
 * 不複製一份 RPC 讀取邏輯，也不動圖層 hook。
 */

const DAY_MS = 86_400_000;

/** YYYY-MM-DD（Asia/Taipei），與 timeStore.getDateKey 同一套算法 */
function taipeiDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/**
 * 今天（Asia/Taipei）→ 滾動 24 小時 `[now-24h, now)`；
 * 歷史日期 → 該日 `[00:00, 24:00)`（台灣固定 UTC+8，無日光節約）。
 *
 * 對齊到分鐘：StrictMode 雙掛載與 10 分鐘背景刷新才會命中底層 loader 的
 * 同一個快取鍵，而不是每次都因為毫秒不同而重打 RPC。
 */
export function globalSituationFeedWindow(
  dateKey: string,
  nowMs = Date.now(),
): { start: string; end: string } {
  const alignedNow = Math.floor(nowMs / 60_000) * 60_000;
  if (!dateKey || dateKey >= taipeiDateKey(alignedNow)) {
    return {
      start: new Date(alignedNow - DAY_MS).toISOString(),
      end: new Date(alignedNow).toISOString(),
    };
  }
  const start = Date.parse(`${dateKey}T00:00:00+08:00`);
  if (!Number.isFinite(start)) throw new Error(`Global situation feed date key is invalid: ${dateKey}`);
  return { start: new Date(start).toISOString(), end: new Date(start + DAY_MS).toISOString() };
}

/**
 * 一個事件一張卡：同事件的多個 place row 收斂成一筆，優先留有座標的那筆。
 * canonical 已撤回／取代（mapSuppressed）不進 feed —— 面板要回答「現在重要
 * 的是什麼」，不是版本歷史。
 */
export function dedupeGlobalSituationFeed(
  entries: readonly GlobalSituationEntry[],
): GlobalSituationEntry[] {
  const byEvent = new Map<string, GlobalSituationEntry>();
  for (const entry of entries) {
    if (entry.mapSuppressed) continue;
    const current = byEvent.get(entry.eventId);
    if (!current || (current.coordinates === null && entry.coordinates !== null)) {
      byEvent.set(entry.eventId, entry);
    }
  }
  return [...byEvent.values()];
}

/** 取某一天（或今天滾動 24h）的全球情勢 feed。失敗時 throw，由呼叫端保留舊資料。 */
export async function fetchGlobalSituationFeed(
  dateKey: string,
  nowMs = Date.now(),
): Promise<GlobalSituationEntry[]> {
  const bounds = globalSituationFeedWindow(dateKey, nowMs);
  // 候選 RPC 以 observed_at 開窗，feed 的 published_ts 也是 observed_at
  // （valid_from），兩者同一把尺；不套 lookback 加寬，避免抓回來只為了被
  // RANGE 濾掉。
  const asOfSeconds = Math.min(nowMs, Date.parse(bounds.end)) / 1000;
  const [published, candidates] = await withLoading(
    `global-situation-feed:${dateKey}`,
    `全球情勢 ${dateKey}`,
    Promise.all([
      fetchGlobalEventsWindow(bounds.start, bounds.end),
      fetchGlobalEventCandidatesWindow(bounds.start, bounds.end).then((page) => page.rows),
    ]),
  );
  return dedupeGlobalSituationFeed(
    selectGlobalSituationEntries(selectGlobalEventsOverview(published), candidates, asOfSeconds),
  );
}
