import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const publisher = "林業及自然保育署；2026-06-07 落地的固定公開資料快照";
const license = "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）";
const proxyPrecision = "來源以地址對應縣市中心點；不是園區或中心實際位置，不可作距離、環域、行政界包含或可及性分析。";

/** These source records are searchable; their county-centroid display coordinates are not analytical locations. */
export const forestryProxyAdapters = [
  createVerifiedPointDatasetAdapter({
    datasetId: "tw-flat-forest-parks", label: "平地森林園區來源紀錄",
    description: "林業及自然保育署 datagov:71507 的 3 筆固定紀錄；位置為縣市代表點。",
    sourceUrl: "/forestry/flat_forest_parks.geojson",
    expectedSha256: "76f0764c475902eba9780802e9919f8aa035f98ef0638867ee87bf513c8f608c",
    expectedSourceRows: 3, expectedSelectedRows: 3, fullSource: true, selection: {}, geometryRole: "proxy",
    layerRefs: ["forestFlatParks"],
    fields: [
      { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "admin_name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "branch", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "opening_hours_text", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "area_source_text", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
    ],
    sourceFieldMap: { name: "FP_NAME", admin_name: "ADMIN_Name", branch: "DEP_NAME", opening_hours_text: "OPEN_TIME", area_source_text: "FP_AREA" },
    publisher: `${publisher}；data.gov.tw/dataset/71507`, license, precision: proxyPrecision,
    coverageDescription: "3 筆平地森林園區來源紀錄；上游 2026-06-07 落地，來源實際更新日與現場營運狀態 unknown。地點欄位可文字查詢，幾何為 county centroid proxy。",
    sourceLineage: "林業及自然保育署 datagov:71507 -> 地址轉 county centroid 的 GeoJSON -> 固定 SHA/筆數驗證；proxy 座標不具空間分析資格。",
  }),
  createVerifiedPointDatasetAdapter({
    datasetId: "tw-forest-education-centers", label: "自然教育中心來源紀錄",
    description: "林業及自然保育署 datagov:71514 的 8 筆固定紀錄；位置為縣市代表點。",
    sourceUrl: "/forestry/forest_education_centers.geojson",
    expectedSha256: "2a9fa1bab22450837112103772e8c6744a6e3e6eb8a7d1283fb153857260ef1f",
    expectedSourceRows: 8, expectedSelectedRows: 8, fullSource: true, selection: {}, geometryRole: "proxy",
    layerRefs: ["forestEducationCenters"],
    fields: [
      { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "admin_unit", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
    ],
    sourceFieldMap: { name: "AduName", address: "Addr", admin_unit: "AdminUnit" },
    publisher: `${publisher}；data.gov.tw/dataset/71514`, license, precision: proxyPrecision,
    coverageDescription: "8 筆自然教育中心來源紀錄；上游 2026-06-07 落地，來源實際更新日與現場營運狀態 unknown。地址可文字查詢，幾何為 county centroid proxy。",
    sourceLineage: "林業及自然保育署 datagov:71514 -> 地址轉 county centroid 的 GeoJSON -> 固定 SHA/筆數驗證；proxy 座標不具空間分析資格。",
  }),
] as const;
