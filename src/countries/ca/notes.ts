// 加拿大國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CaLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const CA_PACK_NOTES = {
  caDroughtMonitor: [{ "zh-TW": "2026 年 10 月一期", en: "October 2026 edition", ja: "2026 年 10 月版" }],
  caEarthquakes: [{ "zh-TW": "目錄停在 2019 年，之後不再更新", en: "The catalogue stops in 2019 and is no longer updated", ja: "カタログは 2019 年で更新停止" }],
  caFederalDistricts: [{ "zh-TW": "2025 大選起改用 2023 代表令 343 區（本層未更新）", en: "From the 2025 election the 2023 Representation Order (343 districts) applies; this layer is not updated", ja: "2025 年総選挙からは 2023 年代表令（343 区）。本レイヤーは未更新" }],
  caLodeHealth: [{ "zh-TW": "ODHF 2020 版", en: "ODHF 2020 edition", ja: "ODHF 2020 年版" }],
  caLodeSchools: [{ "zh-TW": "ODEF 2022 版", en: "ODEF 2022 edition", ja: "ODEF 2022 年版" }],
  caPermafrost: [{ "zh-TW": "1993 年地圖（Atlas of Canada 第 5 版）", en: "1993 map (Atlas of Canada, 5th edition)", ja: "1993 年の地図（Atlas of Canada 第 5 版）" }],
  // <codemod:append CA_PACK_NOTES>
} satisfies Partial<Record<CaLayerKey, SourceText[]>>;
