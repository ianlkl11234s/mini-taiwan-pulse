/**
 * 印尼第 0–4 波（2026-11-23 資料端完成）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。
 * - 行政邊界（C001）：COD-AB 國界 1／38 省／514 縣市（Kemendagri 碼，不是 COD-AB pcode）；人口（C023）與農村發展指數 IDM（C022）：省、縣市兩層級，專用 hook `useIdLayers.ts`。
 * - 其餘 19 層重用菲律賓規格引擎（`PhLayerSpec`＋`usePhDataLayer`），規格在 `idWavesLayers.ts`；5 張 raster（地形 2、InaRISK 3）同檔。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/topic-research/indonesia_opendata/waves/REGISTRY_SPEC.md`。
 * 不畫任何海域主張線；陸界照 COD-AB 原樣，不代表任何立場。授權空白來源照常上線（使用者 2026-11-23），來源與授權放圖層「說明・來源」。
 * `idProtectedAreas`（WDPA，非商用、禁再散布）等授權確認前不接。
 */
import type { L3 } from "./phDataLayers";
import type { IdDataKey } from "./idDataKeys";
import type { LayerSourceInfo } from "./layerSourceInfo";
import { ID_FETCHED_AT, ID_RASTER_SPECS, ID_WAVE_SPECS, type IdLayerSpec } from "./idWavesLayers";

export type { L3 } from "./phDataLayers";
export { pickL3, phText } from "./phDataLayers";
export type { IdLayerSpec } from "./idWavesLayers";
export { ID_FETCHED_AT };

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

/** 邊界立場聲明。 */
export const ID_BOUNDARY_NOTE = l3("邊界依 OCHA COD-AB（來源 BIG、BPS），不代表任何立場；不畫海域主張線", "Boundaries follow OCHA COD-AB (sources: BIG, BPS) and imply no position; no maritime claim lines", "境界は OCHA COD-AB（出典 BIG・BPS）に基づき、いかなる立場も示さない。海域の主張線は描画しない");
export const ID_LICENSE_UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
/** 未涵蓋＝灰（不畫成 0）。 */
export const ID_NOT_COVERED_COLOR = "#6b7280";

// ═════════════════════════ 行政邊界 ═════════════════════════

/** 三層級＝PMTiles tile layer 名（select encode 順序）；srcMinzoom／srcMaxzoom＝檔內該層實際縮放範圍。 */
export const ID_ADMIN_LEVELS = [
  { value: "country", label: "國界（Country）", srcMinzoom: 2, srcMaxzoom: 8 },
  { value: "province", label: "省（Provinsi，38）", srcMinzoom: 3, srcMaxzoom: 10 },
  { value: "kabkota", label: "縣市（Kabupaten／Kota，514）", srcMinzoom: 5, srcMaxzoom: 12 },
] as const;
export type IdAdminLevel = (typeof ID_ADMIN_LEVELS)[number]["value"];
export const ID_ADMIN_LEVEL_LABELS: Record<IdAdminLevel, L3> = {
  country: l3("國界", "Country", "国境"),
  province: l3("省（Provinsi）", "Province (Provinsi)", "州（Provinsi）"),
  kabkota: l3("縣市（Kabupaten／Kota）", "Regency / city (Kabupaten / Kota)", "県・市（Kabupaten／Kota）"),
};
/** 人口、IDM 只有省、縣市兩層。 */
export const ID_LEVELS_2 = [
  { value: "province", label: "省（Provinsi，38）", srcMinzoom: 3, srcMaxzoom: 10 },
  { value: "kabkota", label: "縣市（Kabupaten／Kota，514）", srcMinzoom: 5, srcMaxzoom: 12 },
] as const;
export type IdLevel2 = (typeof ID_LEVELS_2)[number]["value"];
export const ID_ADMIN_COLOR = "#9ca3af";
export const ID_ADMIN_NOTES: readonly L3[] = [
  l3("國界 1、省 38（Kemendagri 碼）、縣市 514（416 kabupaten＋98 kota）；一次只顯示一個層級", "1 country, 38 provinces (Kemendagri codes), 514 regencies / cities (416 kabupaten + 98 kota); one level at a time", "国境 1・州 38（Kemendagri コード）・県市 514（kabupaten 416＋kota 98）。一度に 1 階層のみ表示"),
  l3("幾何為 2020 版 COD-AB（34 省舊制）以縣市重組為 38 省；kecamatan／desa 未做", "Geometry is the 2020 COD-AB (old 34 provinces) regrouped into 38 provinces from regencies; kecamatan / desa not done", "幾何は 2020 年版 COD-AB（旧 34 州）を県市から 38 州に再編。kecamatan／desa は未対応"),
  ID_BOUNDARY_NOTE,
];

// ═════════════════════════ 人口 ═════════════════════════

export const ID_POP_KEY = "idPopulation";
/**
 * 人口密度（人／km²）6 級斷點：省、縣市各自取印尼實際分布的 10／25／50／75／90 百分位（2 位有效數字，REGISTRY_SPEC）。
 * 縣市 514 個：17／53／150／820／2,700；省 38 個：13／36／97／240／1,100。與其他國家級距不同，不可直接比色。
 */
export const ID_DENSITY_BREAKS_BY_LEVEL = {
  province: [13, 36, 97, 240, 1100],
  kabkota: [17, 53, 150, 820, 2700],
} as const;
export const ID_DENSITY_LABELS_BY_LEVEL = {
  province: ["<13", "13–36", "36–97", "97–240", "240–1,100", "≥1,100"],
  kabkota: ["<17", "17–53", "53–150", "150–820", "820–2,700", "≥2,700"],
} as const;
export const ID_POPULATION_NOTES: readonly L3[] = [
  l3("2020 年推估（UNFPA／BPS COD-PS），不是 SP2020 普查或最新年度；密度＝人口 ÷ 面積", "2020 estimate (UNFPA / BPS COD-PS), not the SP2020 census or the latest year; density = population ÷ area", "2020 年推計（UNFPA／BPS COD-PS）で、SP2020 国勢調査や最新年ではない。密度＝人口 ÷ 面積"),
  l3("級距依印尼分布（省、縣市各自取百分位），與其他國家不可直接比色", "Classes follow Indonesia's own distribution (percentiles for provinces and regencies separately); colors cannot be compared directly with other countries", "区分はインドネシア国内の分布による（州・県市それぞれ百分位）。他国と色を直接比較しないこと"),
  l3("省層 z3–10、縣市層 z5–12", "Province level z3–10, regency level z5–12", "州レベル z3–10、県市レベル z5–12"),
  ID_BOUNDARY_NOTE,
];

// ═════════════════════════ 農村發展指數 IDM ═════════════════════════

export const ID_RURAL_KEY = "idRuralDevelopment";
/** IDM 村均值分位數級距（P10–P90；縣市 432/514 有資料，省 37/38）。 */
export const ID_IDM_BREAKS_BY_LEVEL = {
  province: [0.542, 0.667, 0.728, 0.78, 0.805],
  kabkota: [0.587, 0.675, 0.729, 0.788, 0.834],
} as const;
export const ID_IDM_LABELS_BY_LEVEL = {
  province: ["<0.542", "0.542–0.667", "0.667–0.728", "0.728–0.780", "0.780–0.805", "≥0.805"],
  kabkota: ["<0.587", "0.587–0.675", "0.675–0.729", "0.729–0.788", "0.788–0.834", "≥0.834"],
} as const;
export const ID_IDM_STATUS_KEYS = [
  { prop: "n_mandiri", label: l3("自立（Mandiri）", "Self-reliant (Mandiri)", "自立（Mandiri）") },
  { prop: "n_maju", label: l3("先進（Maju）", "Advanced (Maju)", "先進（Maju）") },
  { prop: "n_berkembang", label: l3("發展中（Berkembang）", "Developing (Berkembang)", "発展中（Berkembang）") },
  { prop: "n_tertinggal", label: l3("落後（Tertinggal）", "Lagging (Tertinggal)", "遅れ（Tertinggal）") },
  { prop: "n_sangat_tertinggal", label: l3("極落後（Sangat Tertinggal）", "Very lagging (Sangat Tertinggal)", "極度の遅れ（Sangat Tertinggal）") },
] as const;
export const ID_RURAL_NOTES: readonly L3[] = [
  l3("IDM 2024（Kemendes）村級指數，縣市／省值為村簡單平均（不加權）；顏色依村均值", "IDM 2024 (Kemendes) village index; regency / province values are simple village means (unweighted); colour follows the village mean", "IDM 2024（Kemendes）村落指数。県市・州の値は村の単純平均（加重なし）で、色は村平均に基づく"),
  l3("灰色＝未涵蓋：82 個縣市沒有村（市轄區），不是 0；省層雅加達無村", "Grey = not covered: 82 regencies / cities have no villages, not zero; Jakarta has none at province level", "灰色＝未収録：82 県市は村がない（市の区）ことで 0 ではない。州レベルでは ジャカルタに村なし"),
  l3("級距依印尼分布（縣市、省各自取 P10–P90）", "Classes follow Indonesia's own distribution (P10–P90, regencies and provinces separately)", "区分はインドネシア国内の分布（県市・州それぞれ P10–P90）"),
  ID_BOUNDARY_NOTE,
];

// ═════════════════════════ 規格驅動 19 層 ═════════════════════════

export const ID_DATA_SPECS: readonly IdLayerSpec[] = ID_WAVE_SPECS;
export const ID_SPEC_BY_KEY: Readonly<Record<IdDataKey, IdLayerSpec>> = Object.fromEntries(ID_DATA_SPECS.map((s) => [s.key, s])) as Record<IdDataKey, IdLayerSpec>;

// ═════════════════════════ 圖層來源表（「說明・來源」） ═════════════════════════

const st = (t: string | L3) => (typeof t === "string" ? t : { "zh-TW": t.zh, en: t.en, ja: t.ja });
const srcRow = (org: string | L3, license: string | L3, url: string, notes?: readonly L3[]): LayerSourceInfo => ({
  org: st(org), license: st(license), url, asOf: ID_FETCHED_AT, ...(notes?.length ? { notes: notes.map((n) => st(n) as never) } : {}), from: "popup",
});
/** 印尼 27 層的來源表（機關、授權、連結、取得日、固定備註）；layerSourceInfo.data.ts 展開進總表。 */
export const ID_SOURCE_INFO: Record<string, LayerSourceInfo> = {
  idAdminBoundaries: srcRow(l3("OCHA COD-AB Indonesia v01（來源 BIG、BPS），via HDX", "OCHA COD-AB Indonesia v01 (sources: BIG, BPS), via HDX", "OCHA COD-AB Indonesia v01（出典 BIG・BPS）、HDX 経由"), "CC BY-IGO 3.0", "https://data.humdata.org/dataset/cod-ab-idn", [...ID_ADMIN_NOTES]),
  idPopulation: srcRow(l3("UNFPA／BPS COD-PS Indonesia 2020（v3），via HDX；邊界 OCHA COD-AB（CC BY-IGO）", "UNFPA / BPS COD-PS Indonesia 2020 (v3), via HDX; boundaries OCHA COD-AB (CC BY-IGO)", "UNFPA／BPS COD-PS Indonesia 2020（v3）、HDX 経由。境界 OCHA COD-AB（CC BY-IGO）"), l3("HDX「Other」（條款未在資料集頁內明述）；授權未明示", "HDX 'Other' (terms not stated on the dataset page); license not stated", "HDX「Other」（データセットページに条項の記載なし）。ライセンス未明示"), "https://data.humdata.org/dataset/cod-ps-idn", [...ID_POPULATION_NOTES]),
  idRuralDevelopment: srcRow(l3("Kemendes PDTT，Indeks Desa Membangun（IDM）2024 hasil pemutakhiran；縣市彙總為本專案計算", "Kemendes PDTT, Indeks Desa Membangun (IDM) 2024 updated; regency aggregation computed here", "Kemendes PDTT、Indeks Desa Membangun（IDM）2024 更新版。県市集計は本プロジェクトで算出"), "Open Data Commons Attribution License", "https://idm.kemendesa.go.id/", [...ID_RURAL_NOTES]),
  ...Object.fromEntries(ID_DATA_SPECS.map((sp) => [sp.key, srcRow(sp.sourceOrg, sp.license, sp.sourceUrl, sp.sourceNotes)])),
  ...Object.fromEntries(ID_RASTER_SPECS.map((sp) => [sp.key, srcRow(sp.sourceShort, sp.license, sp.sourceUrl, sp.notes.slice(0, 1))])),
};
