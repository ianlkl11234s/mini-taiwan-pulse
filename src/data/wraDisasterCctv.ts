/**
 * 水利署防災影像（G53 P16 wraDisasterCctv）：popup 開啟時才向水利署開放資料 API 取「當下」影像網址。
 *
 * - 水情影像（data.gov.tw 36687）的 imageurl 帶加密序號 CCTV_SN，每天換；圖磚裡的網址是 2026-11-09 快照，
 *   所以點開時重抓清單、依 cameraid 對回當天網址，抓不到才退回快照網址（可能已失效，由 CctvStreamView 顯示無法載入）。
 * - 疏濬工區（41567）的網址（CPK＋OfficeId）是固定的，但同一工區多支攝影機共用一個座標（22 處、134 支），
 *   點只會選到最上面那支，所以也抓清單，列出同工區所有攝影機讓使用者切換。
 * - opendata.wra.gov.tw 回 Access-Control-Allow-Origin: *（2026-11-10 實測），CSP connect-src 已加此網域；
 *   影像主機 fmg.wra.gov.tw／web.wra.gov.tw 由 <img> 直接載入（主站 img-src 已允許 https:）。
 * - 清單是外部資料：只接受這兩個影像主機的 https 網址，其餘丟掉。
 */

import { withLoading } from "../lib/loadingRegistry";

export type WraCctvKind = "disaster" | "dredging";

export const WRA_CCTV_LIST_URLS: Record<WraCctvKind, string> = {
  disaster: "https://opendata.wra.gov.tw/api/v2/f71b74eb-cbe5-42c6-8be5-7500450e7db0?sort=_importdate+asc&format=JSON",
  dredging: "https://opendata.wra.gov.tw/api/v2/2ac63ec4-1d43-4c8c-80b9-fedd33357444?sort=_importdate+asc&format=JSON",
};

/** 官方即時影像頁（水利署防災資訊服務網），清單或影像都失敗時給使用者的出口。 */
export const WRA_CCTV_OFFICIAL_URL = "https://fhy.wra.gov.tw/fhyv2/monitor/cctv";

const IMAGE_HOSTS = new Set(["fmg.wra.gov.tw", "web.wra.gov.tw"]);
const LIST_TTL_MS = 10 * 60_000;

type Row = Record<string, unknown>;
const cache = new Map<WraCctvKind, { at: number; promise: Promise<Row[]> }>();

/** 只放行水利署兩個影像主機的 https 網址。 */
export function safeWraImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 圖磚 cctv_id「wra_17457_0」→ 上游 cameraid「17457」。 */
export function wraCameraId(cctvId: unknown): string | null {
  const m = /^wra_([^_]+)(?:_\d+)?$/.exec(String(cctvId ?? ""));
  return m ? m[1]! : null;
}

/** 依 cameraid 從 36687 清單取當天影像網址。 */
export function resolveDisasterImage(list: readonly Row[], cctvId: unknown): string | null {
  const id = wraCameraId(cctvId);
  if (!id) return null;
  const row = list.find((r) => String(r.cameraid ?? "") === id);
  return row ? safeWraImageUrl(row.imageurl) : null;
}

/** 41567 清單裡與這個工區同名的攝影機網址（依 ccdidentifier 排序、去重）。 */
export function dredgingSiblingImages(list: readonly Row[], stationName: unknown): string[] {
  const name = String(stationName ?? "").trim();
  if (!name) return [];
  const rows = list
    .filter((r) => String(r.stationname ?? "").trim() === name)
    .sort((a, b) => Number(a.ccdidentifier ?? 0) - Number(b.ccdidentifier ?? 0));
  const urls: string[] = [];
  for (const r of rows) {
    const url = safeWraImageUrl(r.imageurl);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** 取上游清單（10 分鐘內共用同一份）；非 JSON 陣列（例如 F5 挑戰頁）視為失敗。 */
export function fetchWraCctvList(kind: WraCctvKind, fetcher: typeof fetch = fetch, now = Date.now()): Promise<Row[]> {
  const hit = cache.get(kind);
  if (hit && now - hit.at < LIST_TTL_MS) return hit.promise;
  const promise = withLoading(
    `wra-cctv-list:${kind}`,
    kind === "disaster" ? "水利署水情影像清單" : "水利署疏濬工區影像清單",
    fetcher(WRA_CCTV_LIST_URLS[kind])
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error("not a JSON array");
        return data.filter((r): r is Row => r != null && typeof r === "object");
      }),
  );
  promise.catch(() => cache.delete(kind));
  cache.set(kind, { at: now, promise });
  return promise;
}

/** 測試用：清掉清單快取。 */
export function resetWraCctvListCache(): void {
  cache.clear();
}
