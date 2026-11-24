// 南韓國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { KrPopupType } from "./popupTypes";
import { type KrDataKey } from "./keys";
import { KR_DATA_SPECS } from "./krDataLayers";

/** 南韓第 3–5 波 18 層的標題列（中文＋韓文原名，與其他國家圖層一致）。 */
const KR_HEADER_LABELS = Object.fromEntries(KR_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh}`])) as Record<KrDataKey, string>;


export const KR_PACK_HEADER_LABELS = {
  krAdminBoundaries: "南韓行政區界",
  krEcologyNaturalness: "生態自然圖 생태자연도",
  krWasteDisposalRules: "垃圾排出規則 생활쓰레기 배출",
  ...KR_HEADER_LABELS,
  krBusStops: "公車站 버스정류장",
  krRailStations: "鐵道車站 철도역",
  krAirports: "機場 공항",
  krPorts: "港灣區 항만구역",
  krNationalRoads: "一般國道 일반국도",
  krRailLines: "鐵道線 철도 노선",
  krFuelStations: "燃料與充電站 연료·충전소",
  krPowerPlants: "電廠 발전소",
  krRenewables: "再生能源點 신재생에너지 설비",
  krPowerLines: "輸配電線 송전선",
  krSubstations: "變電所 변전소",
  krPowerTowers: "高壓鐵塔 송전철탑",
  krOilGas: "油氣設施 석유·가스 시설",
  // <codemod:append KR_PACK_HEADER_LABELS>
} satisfies Record<KrPopupType, string>;
