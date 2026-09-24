import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

export const postOfficesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-post-offices-source-coordinates", label: "全國郵局來源座標",
  description: "中華郵政 2026-07-17 取得的 1,278 筆郵局來源座標快照；服務旗標是來源欄位，不代表此刻開門、受理特定業務或可達性。",
  sourceUrl: "/civic_facilities/post_offices_national.geojson",
  expectedSha256: "ee8b89fc042fa891a0924f5d069dbed45591ad64eef8daecb9a1d6ffa1684770",
  expectedSourceRows: 1278, expectedSelectedRows: 1278, fullSource: true, selection: {}, layerRefs: ["postOffices"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供郵局名稱", unit: null },
    { name: "computer_office_no", type: "string", nullable: true, nullMeaning: "來源未提供電腦局號", unit: null },
    { name: "postal_office_no", type: "string", nullable: true, nullMeaning: "來源未提供郵務局號", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "phone", type: "string", nullable: true, nullMeaning: "來源未提供電話", unit: null },
    { name: "weekday_service", type: "boolean", nullable: true, nullMeaning: "來源未標示平日服務旗標", unit: null },
    { name: "weekday_extended_service", type: "boolean", nullable: true, nullMeaning: "來源未標示平日延長服務旗標", unit: null },
    { name: "saturday_service", type: "boolean", nullable: true, nullMeaning: "來源未標示週六服務旗標", unit: null },
    { name: "sunday_service", type: "boolean", nullable: true, nullMeaning: "來源未標示週日服務旗標", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "中華郵政（data.gov.tw/dataset/5950）；existing source-coordinate artifact", license: "OGDL-Taiwan-1.0",
  precision: "來源座標快照；未另行驗證入口或測量精度",
  coverageDescription: "全臺 1,278 筆來源座標 Point records；2026-07-17 為 source 取得日，不是觀測期；current status unknown。",
  sourceLineage: "中華郵政公開清冊 -> pipeline 07_export -> fixed source-coordinate GeoJSON bytes -> SHA/count validation; service flags retain source meaning only",
});

export const culturalFacilitiesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-cultural-facilities-source-coordinates", label: "全國文化設施來源座標",
  description: "文化部 emap 六系列合併的 787 筆來源座標文化設施快照；原始 1,170 筆中 383 筆缺座標已在產物前排除，並未作 runtime selector 或 exclusion。city 由來源地址萃取，可能為空。",
  sourceUrl: "/culture/cultural_facilities_national.geojson",
  expectedSha256: "0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d",
  expectedSourceRows: 787, expectedSelectedRows: 787, fullSource: true, selection: {}, layerRefs: ["culturalFacilities"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供設施名稱", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "無法由來源地址萃取縣市", unit: null },
    { name: "facility_type", type: "string", nullable: true, nullMeaning: "來源未提供設施類型", unit: null },
    { name: "source_type_id", type: "string", nullable: true, nullMeaning: "來源未提供系列識別", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "文化部文化資料開放服務網（data.gov.tw/dataset/10046）；existing source-coordinate artifact", license: "OGDL-Taiwan-1.0",
  precision: "來源座標快照；上游 pipeline sanity 已處理座標 swap，精簡產物已移除 coord_status；未另行驗證入口、營業或測量精度",
  coverageDescription: "全臺 787 筆來源座標 Point records；文化部原始 1,170 筆中 383 筆缺座標已在產物前排除；2026-07-16 為 source 取得日，不是觀測期；current status unknown。",
  sourceLineage: "文化部 emap 六系列 -> address city extraction and coordinate validation in pipeline 07_export -> source-coordinate GeoJSON bytes -> SHA/count validation; no runtime coord_status selector",
});
