/**
 * 愛爾蘭第 0 波（C001 行政邊界）：色票、層級、署名、備註 SSOT。
 * hook（`hooks/useIeAdminLayers.ts`）、圖例（`legend/ieLegends.tsx`）、popup（`featureInfo/iePanels.tsx`）共用。
 *
 * 資料與授權見 taipei-gis-analytics `docs/data-catalog/base_map/ie_admin_boundaries.md`（2026-11-07）。
 * 介面字串以三語 `L3` 寫在本檔（比照 `caInfraTypes.ts`）；圖層名走 layers.json。人口缺值顯示「無資料」，不補 0。
 */
import type { CaSource, L3 } from "./caInfraTypes";

export type { L3 } from "./caInfraTypes";
export { pickL3 } from "./caInfraTypes";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export const IE_FETCHED_AT = "2026-11-07";
export const IE_CC_BY_LICENSE = "CC BY 4.0";
export const IE_ADMIN_COLOR = "#9ca3af";

/** 三層級（PMTiles tile layer 名＝value，select encode 順序）；三層在國家全覽 z6 都有圖磚（§3.8 V-1）。 */
export const IE_ADMIN_LEVELS = [
  { value: "la", label: "地方政府（Local authority）", count: 31, minzoom: 3 },
  { value: "ed", label: "選舉分區（Electoral division）", count: 3420, minzoom: 5 },
  { value: "sa", label: "統計小區（Small area）", count: 18919, minzoom: 6 },
] as const;
export type IeAdminLevel = (typeof IE_ADMIN_LEVELS)[number]["value"];
export const IE_ADMIN_LEVEL_LABELS: Record<IeAdminLevel, L3> = {
  la: l3("地方政府（Local authority）", "Local authority", "地方自治体（Local authority）"),
  ed: l3("選舉分區（CSO 2022 Electoral division）", "Electoral division (CSO 2022)", "選挙区（CSO 2022 Electoral division）"),
  sa: l3("統計小區（CSO 2022 Small area）", "Small area (CSO 2022)", "スモールエリア（CSO 2022 Small area）"),
};
export const IE_ADMIN_SOURCE: CaSource = {
  org: "Tailte Éireann（Local Authorities 2026）; Central Statistics Office（Electoral Divisions／Small Areas 2022、Census 2022 SAPS）",
  url: "https://data.gov.ie/dataset/local-authorities-national-statutory-boundaries-ungeneralised-2026",
  license: IE_CC_BY_LICENSE,
  short: "© Tailte Éireann、© Central Statistics Office（CC BY 4.0）",
};
export const IE_ADMIN_NOTES: readonly L3[] = [
  l3("涵蓋愛爾蘭共和國 26 郡、31 個地方政府；北愛屬英國圖層", "Covers all 26 counties / 31 local authorities of Ireland; Northern Ireland is in the UK layers", "アイルランド 26 県・31 自治体を収録。北アイルランドは英国のレイヤー"),
  l3("選舉分區、統計小區為 CSO 2022 普查統計邊界（不是法定選區）", "Electoral divisions and small areas are CSO 2022 census statistical boundaries", "選挙区・スモールエリアは CSO 2022 国勢調査の統計境界"),
  l3("人口為 2022 年普查（SAPS）；無資料顯示「無資料」，不當 0", "Population from Census 2022 (SAPS); missing values show 'No data', never 0", "人口は 2022 年国勢調査（SAPS）。欠測は「データなし」と表示し 0 にしない"),
];
export const IE_NO_DATA = l3("無資料", "No data", "データなし");
