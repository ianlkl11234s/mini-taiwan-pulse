import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Tourism Administration V2.1 attraction snapshot, source-coordinate Point rows only. */
export const tourAttractionsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-tour-attractions-source-coordinates", label: "觀光景點來源座標",
  description: "觀光署觀光資訊標準 V2.1 的 2026-07-22 固定快照；6,070 筆非零來源座標 Point 可作有界附近查詢。",
  sourceUrl: "/research/tour-attractions-source-20260722.geojson",
  expectedSha256: "ccdff175dfce339bf68a6ae125da470de1b3f018df62f346d474ebffeb9f4b6d",
  expectedSourceRows: 6070, expectedSelectedRows: 6070, fullSource: true, selection: {},
  layerRefs: ["tourAttractions"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "attraction_class", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "open_time", type: "string", nullable: false, nullMeaning: "4,379 筆空字串表示來源未填開放時間；不能當作全天開放", unit: null },
    { name: "annual_visitors_2024", type: "number", nullable: true, nullMeaning: "5,807 筆無 2024 年訪客統計，非 0 人", unit: "visitors/year" },
    { name: "yoy_pct", type: "number", nullable: true, nullMeaning: "5,836 筆無年變化率，非 0%", unit: "%" },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "交通部觀光署（data.gov.tw 7777）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "官方 V2.1 來源 WGS84 Point；未核驗入口、景點實際面積、道路可達或現時開放。",
  coverageDescription: "原始 V2.1 AttractionList 6,095 列中 6,071 筆非零座標；processed/display 為 6,070 筆同 ID、同數值座標。24 筆原始零座標及剩餘 1 筆非零而未發布的原因尚未核明，不代表景點不存在。2024 訪客數 263 筆有值、5,807 null；年增率 234 筆有值、5,836 null；未統計者不能當 0。每日更新是來源週期，不代表本固定快照今日有效。",
  sourceLineage: "觀光署 V2.1 raw Attraction-json_v2.1.zip SHA 32fce35366927d53bf7c3d6f53e5c011b080f34ecc072af870d292b7846a6633 -> analytics attraction_20260722.geojson SHA 58cb09c2b0f75a6150be15759f76654b6374ce0e11531d60f7d238e2a2a6db94 -> Mini S3 display attractions_national.geojson SHA f10f820f74155ac7583c110f08b1f0068902b1bd076e52acfe0f497c3d86371f -> deterministic safe-field sidecar SHA ccdff175dfce339bf68a6ae125da470de1b3f018df62f346d474ebffeb9f4b6d；6,070 IDs 及數值座標逐筆對齊。",
});
