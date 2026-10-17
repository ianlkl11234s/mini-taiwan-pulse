import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed Ministry of Agriculture POI source-coordinate snapshot; this is not a live opening or access feed. */
export const agriPoiSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-agri-pois-source-coordinates", label: "農業休閒與農旅 POI 來源座標",
  description: "農業部三份公開名冊合併的 839 筆固定 Point 快照：休閒農場、田媽媽與特色農業旅遊場域。Point 保留來源／既有 pipeline 的座標，不代表入口、目前營業、可提供的服務或道路可達性。",
  sourceUrl: "/agriculture/agriculture_pois.geojson",
  expectedSha256: "47416af00d3e8e02fae1f1f625010f09a673659028f6bfc1c556413e8cafc207",
  expectedSourceRows: 839, expectedSelectedRows: 839, fullSource: true, selection: {}, layerRefs: ["agriPOI"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "row_id", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "poi_type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "poi_name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_slug", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "TOWNID", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "AA45", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "AA46", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "農業部（data.gov.tw/dataset/177247、177245、177246）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "合併產物保留既有 pipeline 的 WGS84 來源座標；未驗證設施入口、測量精度、服務範圍或道路可達性。",
  coverageDescription: "既有合併產物全量 839 筆來源座標 Point records：休閒農場 2025、田媽媽 2024、特色農業旅遊場域 2024。177246 官方／上游原表列 331 筆，但此合併產物只有 330 筆；差異原因未驗證，不能稱原始三表完整覆蓋。年份是來源批次，不是逐筆觀測時間；pipeline 日期不是觀測日；current opening／service status unknown。",
  sourceLineage: "農業部 data.gov.tw 177247 休閒農場（2025）、177245 田媽媽（2024）、177246 特色農業旅遊場域（2024） -> existing pipeline 合併為 WGS84 GeoJSON -> fixed bytes -> SHA/count validation; 177246 upstream count 331 versus merged 330 remains unresolved; row_id and source dataset fields are retained unchanged, while record_id is version-scoped SHA plus source index.",
});
