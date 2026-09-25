import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** One official sports-venue snapshot serves five mutually exclusive map categories. */
export const sportsVenuesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-sports-venues-source-coordinates", label: "全國運動場館來源座標",
  description: "運動部 22849 全國運動場館名冊的 15,000 個有效來源 Point；五種場館層是同一份名冊依 layer 欄位切分。open_status 是名冊快照文字，不是即時開放狀態。",
  sourceUrl: "/research/sports-venues-source-20260704.geojson",
  expectedSha256: "28da39f158143c8dfd75ea8dd3755d9e91a3c56bd9fbabfa07e953a410c0dccb",
  expectedSourceRows: 15000, expectedSelectedRows: 15000, fullSource: true, selection: {},
  layerRefs: ["sportsSchool", "sportsPublicOther", "sportsPrivate", "sportsPark", "sportsCenter"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "venue_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "layer", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "open_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area_sqm", type: "number", nullable: true, nullMeaning: "來源未提供面積，不是 0 平方公尺", unit: "m²" },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "運動部（原教育部體育署），data.gov.tw dataset 22849",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "processed GeoJSON 保留來源 WGS84 Point；不保證設施入口、場館實際占地或步行可達位置。",
  coverageDescription: "2026-07-04 本地原表 15,001 列，pipeline 排除 1 列壞座標；此固定 sidecar 含 22 縣市 15,000 個 Point，五種 layer 值互斥（12,221／1,135／691／596／357）。category 為 27 類正規化標籤；area_sqm 有 380 筆 null，不能作零面積。批次日期不是逐筆觀測時間；open_status 不保證目前開放。保證範圍限發布的 8 個屬性與來源 Point，不含原始地址、時段或網站欄位。",
  sourceLineage: "運動部 22849 原始 CSV SHA 1c481e0816dad61af86bfecde452fff785315d3080ee54c13702642ccb7623ec -> analytics processed all_venues_20260704.geojson SHA f6a925cc9bd83903d4e34404680b32d9b0ced5f96a4f9ed72ae97650c298feb0 -> deterministic 8-field sidecar SHA/count validation; venue_id 由 ETL 產生，record_id 是此 sidecar SHA 加列索引。",
});
