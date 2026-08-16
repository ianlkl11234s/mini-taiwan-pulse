/**
 * 台北曆日共用 helper。
 *
 * 三份 loader（earthquakeLoader / lightningLoader / nuclearLoader）原本各自逐字
 * 拷貝了 `MS_PER_DAY` / `taipeiDateKeyFromMs` / `taipeiMidnightMs`（第三份還加了
 * `_NUCLEAR` 後綴迴避一個根本不存在的模組作用域碰撞）。抽到這裡統一維護。
 *
 * 為什麼不直接複用既有的兩個相近函式：
 * - `src/lib/supabase.ts` 的 `todayTaiwan()`：不接受任何參數，語意固定是「現在」，
 *   無法回答「某個 ms timestamp 對應哪個台北曆日」，用途不同不能取代 `taipeiDateKeyFromMs`。
 * - `src/state/timeStore.ts` 的 `toDateKey()`：簽章是 unix **秒**（本檔全部走 ms）、
 *   未 export（模組私有），且引入會把 loader 綁進 timeStore 的 RAF/訂閱狀態模組，
 *   屬於不必要的耦合。
 * 兩者格式仍一致（`toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })`），
 * 只是簽章/可見度不相容，因此在此另建輕量、無狀態的版本。
 *
 * Taipei 全年 +08:00 無 DST，用固定 24h 毫秒步進即可在「本地零時」之間逐日位移，
 * 不必逐一呼叫 Intl API 找日界。
 */

export const MS_PER_DAY = 86_400_000;

/** 某個 unix ms timestamp 對應的台北曆日 YYYY-MM-DD */
export function taipeiDateKeyFromMs(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** 台北曆日 YYYY-MM-DD 的當地零時，換算成 unix ms */
export function taipeiMidnightMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00+08:00`);
}

/**
 * 把「只含有資料日期、已由舊到新排序」的 rows 補成連續 days 天。
 * 右界錨定在 rows 最後一筆的日期（不是 todayTaiwan()）—— 上游 refresh cron 通常只
 * 補到「昨天」，若錨在 todayTaiwan() 會把 rows 最舊一天擠掉、同時把 today 補成一根
 * 假的「今日 0」柱，每天都錯一格。rows 為空時直接回 []（沒有任何一天有資料，軸該
 * 錨在哪本來就無意義）。
 *
 * lightning（count 補 0，cloudToGround / maxIntensityKa 補 null）與 nuclear
 * （stationCount 補 0，meanUsvh / maxUsvh 補 null）欄位名與補值規則不同，因此
 * 「哪個 row 對應哪個 Day」的映射交給呼叫端的 `toDay`，本函式只管「補幾天、
 * 錨定在哪一天」這段兩邊完全共通的邏輯。
 */
export function padTaipeiDaily<Row, Day>(
  rows: Row[],
  days: number,
  getDateKey: (row: Row) => string,
  toDay: (dateKey: string, row: Row | undefined) => Day,
): Day[] {
  if (rows.length === 0) return [];
  const byDate = new Map(rows.map((r) => [getDateKey(r), r]));
  const anchorMidnightMs = taipeiMidnightMs(getDateKey(rows[rows.length - 1]!));
  const result: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = taipeiDateKeyFromMs(anchorMidnightMs - i * MS_PER_DAY);
    result.push(toDay(key, byDate.get(key)));
  }
  return result;
}
