/**
 * 圖層「資料時區」：取資料時，一天怎麼切由圖層自己宣告。
 *
 * 時間軸一律顯示台北時間；但外國按當地日存的每日資料（例：英國每日檔），
 * 要把時間軸那一刻換成「資料所屬時區的當地日期」再去抓，否則會差 7–8 小時。
 *
 * 宣告在 `layerManifest.ts` 的 `dataTimeZone`（IANA 名稱）；沒宣告＝`Asia/Taipei`，
 * 所以台灣圖層走這裡的輸出與 `timeStore.getDateKey()` 完全相同。
 * 規範見 `docs/TIMELINE_ARCHITECTURE.md`「資料時區宣告」。
 */
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { DEFAULT_TIME_ZONE, zonedDateKey, zonedDayRangeMs } from "./zonedTime";

/** 圖層宣告的資料時區；沒宣告回 Asia/Taipei。 */
export function layerDataTimeZone(layerKey: ManifestKey): string {
  const entry = LAYER_MANIFEST[layerKey] as { dataTimeZone?: string } | undefined;
  return entry?.dataTimeZone ?? DEFAULT_TIME_ZONE;
}

/** 時間軸那一刻（unix 秒）在該圖層資料時區的當地日期 YYYY-MM-DD。 */
export function dataDateKeyFor(layerKey: ManifestKey, unixSec: number): string {
  return zonedDateKey(unixSec * 1000, layerDataTimeZone(layerKey));
}

/** 該圖層資料時區的當地曆日 dateKey 的 [startSec, endSec)（DST 當天 23／25 小時）。 */
export function dataDayRangeSecFor(layerKey: ManifestKey, dateKey: string): [number, number] {
  const [a, b] = zonedDayRangeMs(dateKey, layerDataTimeZone(layerKey));
  return [a / 1000, b / 1000];
}
