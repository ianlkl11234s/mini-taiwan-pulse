/**
 * 開站時要先載入的國家包（B1 P5a，設計 §3.2）。
 *
 * App 模組最上層 import 本檔：模組一執行就依網址（`c=` 國家、`layers=` 圖層所屬國家、`cmpc=` 並排右國）
 * 平行發出國家包的動態 import，和 React 首次 render 同時進行。網址參數（`p.*`、期別）與會員場景
 * 要等這裡 resolve 才套用 —— 國家包沒載入前圖層規格是空的，直接套會被當成「沒有這個參數」靜默丟掉。
 */
import type { CountryCode } from "../constants/countries";
import { layerCountryOf } from "../data/layerLookup";
import { ensureCountryPacks, hasCountryPack } from "./packs";

/** 這些圖層 key 需要哪些國家包（沒有國家包的國家不列）。 */
export function packCountriesForKeys(keys: Iterable<string>): CountryCode[] {
  const out = new Set<CountryCode>();
  for (const key of keys) {
    const cc = layerCountryOf(key);
    if (cc && hasCountryPack(cc)) out.add(cc);
  }
  return [...out];
}

/** 網址需要的國家包：`c=`、`cmpc=`、`layers=` 圖層所屬國家。只讀原始字串，不依賴 parseUrlState 的驗證。 */
export function packCountriesForSearch(search: string): CountryCode[] {
  const q = new URLSearchParams(search);
  const out = new Set<CountryCode>();
  for (const name of ["c", "cmpc"]) {
    const cc = q.get(name)?.trim().toUpperCase();
    if (cc && hasCountryPack(cc as CountryCode)) out.add(cc as CountryCode);
  }
  const layers = (q.get("layers") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const cc of packCountriesForKeys(layers)) out.add(cc);
  return [...out];
}

/** 開站需要的國家包（模組載入時就開始抓）。失敗不擋開站：網址參數照常套用，那國的圖層之後再重試載入。 */
export const bootPacksReady: Promise<void> = ensureCountryPacks(
  typeof location === "undefined" ? [] : packCountriesForSearch(location.search),
).catch(() => undefined);
