import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed 2026-07-17 roster sidecar; only TGOS address-level government-office coordinates are registered. */
export const govServiceOfficesTgosAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-gov-service-offices-tgos", label: "政府服務機關 TGOS 地址座標",
  description: "國發會檔案管理局政府服務機關名冊的 2026-07-17 pipeline 快照。707 筆來源名冊中，702 筆有座標 Point；此 reader 只保留 462 筆 TGOS 地址級座標。`uid` 為機關代碼衍生的來源快照識別碼，`record_id` 則由固定 sidecar SHA 與列索引產生，僅在此版本有效。TGOS 地址級座標不是測量過的機關入口，也不表示目前營運或可提供服務。",
  sourceUrl: "/research/gov_service_offices_tgos_20260717.geojson",
  expectedSha256: "8c47482c47f0e2ae6207b9a87e81158ba51cd70113c225fa04d654b38167ec9a",
  expectedSourceRows: 462, expectedSelectedRows: 462, fullSource: true, selection: {}, layerRefs: ["govServiceOffices"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "org_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "國家發展委員會檔案管理局（data.gov.tw/dataset/38403）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "TGOS 地址級 WGS84 Point；未驗證機關入口、測量精度、服務轄區或道路可達性。",
  coverageDescription: "全國來源名冊 707 筆；processed 702 筆有座標 Point。reader 註冊其中 462 筆 TGOS 地址級座標，排除 239 筆 Google L1 與 1 筆 offline_exact；另 5 筆無座標未進 processed。2026-07-17 是 pipeline 快照日，不是觀測日；目前營運／服務狀態 unknown。",
  sourceLineage: "國家發展委員會檔案管理局 data.gov.tw 38403 政府服務機關名冊 -> government-service-office pipeline 2026-07-17 coordinate/export -> fixed processed 702-Point GeoJSON SHA/count/method validation -> TGOS-only 462-Point sidecar with WGS84 geometry and selected source fields -> SHA/count validation; uid=gov_service_offices:{機關代碼} is source-snapshot-scoped, record_id is version-scoped SHA plus sidecar index; jurisdiction is deliberately excluded because its separate 7620-derived source license was not verified here, and the sidecar makes no service-catchment claim.",
});
