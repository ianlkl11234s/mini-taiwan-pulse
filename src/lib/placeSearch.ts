/**
 * 側欄地點搜尋（地址搜尋第一階段）：只比對本地靜態索引 src/data/placeSearchIndex.json
 * （縣市、鄉鎮市區、村里、軌道車站；產生腳本 scripts/preprocess/build-place-search-index.py）。
 * 不呼叫外部 geocoding；找不到就是找不到，不猜座標。
 */

export type PlaceKind = "county" | "town" | "village" | "station";

/** 索引列：[名稱, 類別, 上層, lng, lat, w?, s?, e?, n?]（行政區才有 bbox） */
export type PlaceIndexRow = [string, PlaceKind, string, number, number, number?, number?, number?, number?];

export interface PlaceIndexFile {
  version: number;
  places: PlaceIndexRow[];
}

export interface PlaceSearchHit {
  /** 顯示名（車站補「站」字） */
  label: string;
  kind: PlaceKind;
  /** 縣市／縣市＋鄉鎮，或車站系統名（台鐵、高鐵、台北捷運…） */
  parent: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  score: number;
}

interface IndexedPlace {
  hit: Omit<PlaceSearchHit, "score">;
  keys: string[];
  rank: number;
}

export interface PlaceSearchIndex {
  places: readonly IndexedPlace[];
}

/** 同分時的層級順序：縣市 > 鄉鎮 > 車站 > 村里（避免「大安」被同名村里佔滿） */
const KIND_RANK: Record<PlaceKind, number> = { county: 0, town: 1, station: 2, village: 3 };

/** 「台／臺」互通、全形轉半形、去空白與常見分隔符號 */
export function normalizePlaceQuery(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/臺/g, "台")
    .replace(/[\s_\-.,，、·]+/g, "");
}

function stationKeys(name: string): string[] {
  const base = name.replace(/(車站|站)$/, "");
  return [name, base, `${base}站`, `${base}車站`];
}

/** 行政區另收去掉「市縣區鄉鎮」字尾的簡稱（「台北」→臺北市、「板橋」→板橋區），剩不到 2 字不收 */
function adminKeys(name: string, parent: string): string[] {
  const short = name.replace(/[市縣區鄉鎮]$/, "");
  return [name, `${parent}${name}`, ...(short.length >= 2 && short !== name ? [short] : [])];
}

export function buildPlaceSearchIndex(file: PlaceIndexFile): PlaceSearchIndex {
  const places = file.places.map((row): IndexedPlace => {
    const [name, kind, parent, lng, lat, w, s, e, n] = row;
    const bbox = w != null && s != null && e != null && n != null ? [w, s, e, n] as [number, number, number, number] : undefined;
    const isStation = kind === "station";
    const label = isStation && !/站$/.test(name) ? `${name}站` : name;
    const raw = isStation ? stationKeys(name) : kind === "village" ? [name, `${parent}${name}`] : adminKeys(name, parent);
    const keys = [...new Set(raw.map(normalizePlaceQuery).filter(Boolean))];
    return { hit: { label, kind, parent, center: [lng, lat], ...(bbox ? { bbox } : {}) }, keys, rank: KIND_RANK[kind] };
  });
  return { places };
}

/** 完全相符 3 > 開頭相符 2 > 包含 1；0 = 不相符 */
function matchScore(keys: readonly string[], query: string): number {
  let best = 0;
  for (const key of keys) {
    if (key === query) return 3;
    if (key.startsWith(query)) best = Math.max(best, 2);
    else if (best < 1 && key.includes(query)) best = 1;
  }
  return best;
}

export function searchPlaces(index: PlaceSearchIndex, query: string, limit = 8): PlaceSearchHit[] {
  const q = normalizePlaceQuery(query);
  if (!q) return [];
  const scored: { place: IndexedPlace; score: number; order: number }[] = [];
  index.places.forEach((place, order) => {
    const score = matchScore(place.keys, q);
    if (score > 0) scored.push({ place, score, order });
  });
  scored.sort((a, b) =>
    b.score - a.score
    || a.place.rank - b.place.rank
    || a.place.hit.label.length - b.place.hit.label.length
    || a.order - b.order);
  return scored.slice(0, limit).map(({ place, score }) => ({ ...place.hit, score }));
}
