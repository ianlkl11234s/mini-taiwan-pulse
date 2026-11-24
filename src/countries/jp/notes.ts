// 日本國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { JpLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const JP_PACK_NOTES = {
  jmaAmedas: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.description" }, text: { key: "popup.jma.amedasNote" } } }],
  jmaQuakes: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.description" }, text: { key: "popup.jma.quakeNote" } } }],
  jmaSnowcap: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.description" }, text: { key: "popup.jmaTime.methodCaveat" } } }],
  jmaWarnings: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.updated" }, text: { key: "popup.jma.warningUpdated" } } }],
  jmaWbgt: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.description" }, text: { key: "popup.jmaTime.wbgtNote" } } }],
  jpAccommodationCanonical: [{ "zh-TW": "觀光廳資料時點 2026-03-31；各市與 OSM 2026-09-10", en: "JTA data as of 2026-03-31; city data and OSM as of 2026-09-10", ja: "観光庁データ 2026-03-31 時点；各市・OSM は 2026-09-10 時点" }],
  jpBusStops: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.busScopeNote" } } }],
  jpEvacuationSites: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.evacLegalNote" } } }, { key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.evacStaleNote" } } }, { "zh-TW": "共 199,346 點", en: "199,346 points in total", ja: "合計 199,346 地点" }],
  jpInlandFloodAreas: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.inlandFloodNote" } } }],
  jpLandslideWarningAreas: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.landslideAccuracyNote" } } }, { key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.landslideNestedNote" } } }],
  jpMajorRoads: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.roadNote" } } }],
  jpMunicipalRoads: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.municipalRoadNote" } } }],
  jpNationalForests: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.forestScopeNote" } } }, { key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.forestMergedNote" } } }],
  jpNaturalParkAreas2015: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.jpNature.notes" }, text: { key: "popup.jpNature.parkAreasAccuracy" } } }],
  jpPoliceFacilities: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.field.attribution" }, text: "出典：警察庁ウェブサイト「全国警察施設名称位置等」を加工して作成／位置情報：国土地理院最適化ベクトルタイル" } }],
  jpPublicOffices: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.officeBasisNote" } } }],
  jpWelfareChild: [{ key: "legend.civic.jpWelfareStale" }],
  jpWelfareDisability: [{ key: "legend.civic.jpWelfareStale" }],
  jpZoningUseDistricts: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.japan.notes" }, text: { key: "popup.japan.zoningNote" } } }],
  // <codemod:append JP_PACK_NOTES>
} satisfies Partial<Record<JpLayerKey, SourceText[]>>;
