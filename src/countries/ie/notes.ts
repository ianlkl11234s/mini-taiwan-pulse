// 愛爾蘭國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IeLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const IE_PACK_NOTES = {
  ieCareHomes: [{ "zh-TW": "名冊 2026-11-08 下載", en: "Register downloaded 2026-11-08", ja: "名簿 2026-11-08 取得" }],
  ieCoillteForestRoads: ["Coillte Teoranta — Forest Road Dataset; Recreation Trails（Coillte 使用條款：僅限研究或私人學習、不得轉供他人或用於其他網站（站主限定））"],
  ieCoillteRecreation: ["Coillte Teoranta — Recreation Information; Forest Entrances（Coillte 使用條款：僅限研究或私人學習、不得轉供他人或用於其他網站（站主限定））"],
  ieEvCharging: [{ "zh-TW": "2024-12 快照", en: "December 2024 snapshot", ja: "2024年12月時点" }],
  ieFuelStations: [{ "zh-TW": "Geofabrik 2026-11-05 快照", en: "Geofabrik snapshot 2026-11-05", ja: "Geofabrik 2026-11-05 時点" }],
  ieHealthFacilities: [{ "zh-TW": "Geofabrik 2026-11-05 快照", en: "Geofabrik snapshot 2026-11-05", ja: "Geofabrik 2026-11-05 時点" }],
  ieMuseums: [{ "zh-TW": "名冊為 2015 年版，之後新開或關閉的館未反映", en: "The list is the 2015 edition; later openings and closures are not reflected", ja: "名簿は2015年版で、その後の開館・閉館は未反映" }],
  iePowerLines: [{ "zh-TW": "Geofabrik 2026-11-05 快照", en: "Geofabrik snapshot 2026-11-05", ja: "Geofabrik 2026-11-05 時点" }],
  ieSchoolPlanningAreas: [{ "zh-TW": "學校規劃區為 2011 年版", en: "The school planning areas are the 2011 version", ja: "学校計画区は2011年版" }],
  ieSoils: [{ "zh-TW": "土壤圖 2014 年完成，之後不再更新", en: "The soil map was completed in 2014 and is not updated", ja: "土壌図は2014年完成で、以後更新なし" }],
  ieStateAssets: [{ "zh-TW": "2023 年第 3 季版，之後未更新；folio 為當時登記查詢結果、不保證現況", en: "Q3 2023 edition, not updated since; folios reflect the registry search at that time", ja: "2023年第3四半期版で以後未更新。筆は当時の登記照会の結果で現況は保証されない" }],
  ieSubstations: [{ "zh-TW": "Geofabrik 2026-11-05 快照", en: "Geofabrik snapshot 2026-11-05", ja: "Geofabrik 2026-11-05 時点" }],
  // <codemod:append IE_PACK_NOTES>
} satisfies Partial<Record<IeLayerKey, SourceText[]>>;
