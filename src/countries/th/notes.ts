// 泰國國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { ThLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const TH_PACK_NOTES = {
  thAdminBoundaries: [{ "zh-TW": "曼谷 khwaeng 標註：版本落後（本層 169，官方現行 180）", en: "Bangkok khwaeng note: outdated edition (this layer 169, official 180)", ja: "バンコクの khwaeng：版が古い（本レイヤー 169、公式現行 180）" }],
  thJailsCourts: [{ "zh-TW": "DOC 監所名冊為 2021 版，資料較舊", en: "The DOC prison list is the 2021 edition and is outdated", ja: "DOC 刑事施設の名簿は 2021 年版で古い" }],
  thMajorRoads: [{ "zh-TW": "鐵道來源版本 BE 2554（2011），與現況路網不完全一致", en: "Railway source edition BE 2554 (2011); not identical to the current network", ja: "鉄道の出典は BE 2554（2011）版で、現況の路線網と完全には一致しない" }],
  thMarineProtectedAreas: [{ "zh-TW": "2010 年版，資料較舊；現況保護區範圍可能已改變", en: "2010 edition, outdated; current protected-area extents may have changed", ja: "2010 年版で古いデータ。現在の保護区の範囲は変わっている可能性" }],
  // <codemod:append TH_PACK_NOTES>
} satisfies Partial<Record<ThLayerKey, SourceText[]>>;
