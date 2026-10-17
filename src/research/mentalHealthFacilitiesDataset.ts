import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const sourceUrl = "/welfare/mental_health_facilities_national.geojson";
const expectedSha256 = "b72e5a8102b409612fabda14b2fbff54dd6e51d144bdae31eb0d87e7ed8c4e34";
const fields = [
  { name: "record_id", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "uid", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "address", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "sub_code", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "permit_status", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "coord_source", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "coord_precision", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json" as const, nullable: false, nullMeaning: null, unit: null },
] as const;

const common = {
  sourceUrl, expectedSha256, expectedSourceRows: 70, fields,
  publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）；existing welfare artifact",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  sourceLineage: "衛福部社會福利機構總表 165355 -> welfare 02_classify / coordinate pipeline -> fixed GeoJSON bytes -> SHA/count validation; permit_status is retained verbatim and is not an active/inactive assertion.",
} as const;

/** The direct upstream-coordinate portion of the 70-record nationwide welfare artifact. */
export const mentalHealthFacilitiesUpstreamCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  datasetId: "tw-mental-health-facilities-upstream-coordinates", label: "心理衛生機構來源自帶座標",
  description: "70 筆全國心理衛生機構產物中，63 筆 `tgos_upstream/upstream` 來源座標的固定子集。`uid` 為來源穩定鍵；permit_status 原樣保留，C04 不代表目前有效、開放或可服務。",
  expectedSelectedRows: 63, selection: { coord_source: "tgos_upstream", coord_precision: "upstream" }, layerRefs: ["welfareMentalHealth"],
  precision: "來源標示 tgos_upstream/upstream 的 Point；未驗證設施入口、測量精度、服務轄區或目前營運狀態。",
  coverageDescription: "全台 22 縣市的原始產物共 70/70 有 Point 幾何；本可空間分析子集為 63 筆 tgos_upstream/upstream。另 5 筆 Google exact 與 2 筆 Google approximate 因使用條件 HOLD，未註冊為 reader；observed period unknown。",
});
