import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed Tourism Administration hot-spring outcrop coordinates; this is not a live facility or health-status feed. */
export const hotSpringsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-hot-spring-outcrops", label: "全臺溫泉露頭來源座標",
  description: "交通部觀光署 data.gov.tw 32504 的 150 筆溫泉露頭固定快照。Point 是由 TWD97（EPSG:3826）轉換的露頭座標，不代表營業場所、入口、目前流量、水質檢測或健康狀態。",
  sourceUrl: "/tourism/hot_springs_national.geojson",
  expectedSha256: "703083205d872145b281e4bc4277f0fb8e3b924694ec9dc08990a409d67214bf",
  expectedSourceRows: 150, expectedSelectedRows: 150, fullSource: true, selection: {}, layerRefs: ["tourHotSprings"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "quality", type: "string", nullable: true, nullMeaning: "來源泉質欄位空白或未提供；不代表無泉質或安全判定", unit: null },
    { name: "type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "交通部觀光署（data.gov.tw/dataset/32504）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源 CSV 的 TWD97 二度分帶（EPSG:3826）座標經既有 pipeline 轉為 WGS84 Point；未驗證露頭範圍、入口或測量精度。",
  coverageDescription: "全臺 150 筆溫泉露頭來源座標 Point records；2026-07-22 為 pipeline／快照驗證日，不是上游觀測日；更新不定期，current flow、water quality、health、entrance status unknown。",
  sourceLineage: "交通部觀光署 data.gov.tw 32504 溫泉露頭調查 CSV -> TWD97 EPSG:3826 to WGS84 pipeline conversion -> fixed GeoJSON bytes -> SHA/count validation; source has no stable record ID, so record_id is version-scoped SHA plus source index.",
});
