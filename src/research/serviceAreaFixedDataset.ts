import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed Highway Bureau service-area source-coordinate snapshot. */
export const serviceAreaFixedPointAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-freeway-service-areas-fixed-20260524", label: "國道服務區固定快照",
  description: "高速公路局國道服務區資料的 22 筆固定 Point 快照。每筆是來源名冊中的服務區位置；不代表服務區範圍、入口、道路接入、路網距離、目前營業、營運商契約或可用服務。",
  sourceUrl: "/geo/service_area.geojson",
  expectedSha256: "68fc87e6859530aa0ccf8ecaf61a23a3a95307c23d3a7a0f5461b1448d241b65",
  expectedSourceRows: 22, expectedSelectedRows: 22, fullSource: true, selection: {}, layerRefs: ["serviceArea"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "freeway", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "location", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "direction", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "operator", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "operation_period", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "theme", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  sourceFieldMap: {
    name: "Name", freeway: "Freeway", location: "Location", direction: "Direction", address: "Address",
    operator: "Operator", operation_period: "OperationPeriod", theme: "Theme",
  },
  publisher: "交通部高速公路局（data.gov.tw/dataset/8161）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "高速公路局來源數值 WGS84 Point；可作來源位置的 bbox／直線鄰近查詢，未驗證服務區入口、建物範圍、道路接入點或行車路徑。",
  coverageDescription: "2026-05-24 固定處理快照含完整 22 筆來源服務區 Point，所有 8 個保留屬性及 geometry 均非 null。原始 CSV 的 22 列均有經緯度，沒有因缺座標排除。相同名稱可代表不同方向的服務區列，保留來源列序與版本綁定的 record_id，不能按名稱或座標去重。資料目錄標示靜態、不定期更新；此快照不是目前營業、營運商、營業時間或可用服務的觀測，freshness unknown。",
  sourceLineage: "交通部高速公路局 data.gov.tw 8161 國道服務區 CSV（22 rows；UTF-8 BOM）-> service_area pipeline 逐列以經度／緯度建立 WGS84 Point 並保留 8 個欄位 -> analytics service_area_20260524.geojson -> Mini /geo/service_area.geojson；analytics processed 與 Mini 顯示檔均為 13,526 bytes、SHA-256 68fc87e6859530aa0ccf8ecaf61a23a3a95307c23d3a7a0f5461b1448d241b65，且與原始 CSV 的轉換結果逐列相同。來源沒有穩定 UID，record_id 為固定 SHA 加來源列序，只在此版本有效。",
});
