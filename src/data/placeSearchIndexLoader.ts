import indexUrl from "./placeSearchIndex.json?url";
import { withLoading } from "../lib/loadingRegistry";
import { buildPlaceSearchIndex, type PlaceIndexFile, type PlaceSearchIndex } from "../lib/placeSearch";

/**
 * 地點搜尋索引懶載入：第一次展開搜尋才下載（約 0.8 MB、gzip 約 0.2 MB），之後共用同一份。
 * 失敗時清掉快取讓下次重試；呼叫端要顯示錯誤，不可當成「沒有符合的地點」。
 */
let pending: Promise<PlaceSearchIndex> | null = null;

export function loadPlaceSearchIndex(label: string): Promise<PlaceSearchIndex> {
  pending ??= withLoading("place-search-index", label, fetch(indexUrl).then(async (res) => {
    if (!res.ok) throw new Error(`地點索引載入失敗 ${res.status}`);
    const file = await res.json() as PlaceIndexFile;
    if (file?.version !== 1 || !Array.isArray(file.places)) throw new Error("地點索引格式不符");
    return buildPlaceSearchIndex(file);
  })).catch((err: unknown) => {
    pending = null;
    throw err;
  });
  return pending;
}
