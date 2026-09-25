import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Two independent official fixed snapshots; the checked display bytes equal the analytics outputs. */
export const taxiStandsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-taxi-stands-source-20260524", label: "計程車招呼站（臺北、嘉義固定快照）",
  description: "臺北市與嘉義市官方名冊的 224 個 Point；資料範圍只有這兩市，不能推論其他縣市沒有招呼站或現在仍有空車位。",
  sourceUrl: "/geo/taxi_stand.geojson", expectedSha256: "ac4b83e60768754276e142d3c0b41626ed50ec41a58581edf7d64bd340c5c532",
  expectedSourceRows: 224, expectedSelectedRows: 224, fullSource: true, selection: {}, layerRefs: ["taxiStand"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "Name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "District", type: "string", nullable: true, nullMeaning: "嘉義來源未附行政區，不表示站點沒有行政區", unit: null },
    { name: "Slots", type: "string", nullable: true, nullMeaning: "嘉義來源未附席位數，不是零席位", unit: null },
    { name: "Schedule", type: "string", nullable: true, nullMeaning: "嘉義來源未附服務時段，不代表全天候", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "臺北市交通局與嘉義市交通處（data.taipei 134597、data.chiayi 74927）",
  license: "政府資料開放授權條款第 1 版；限本兩市來源快照與已核欄位",
  precision: "來源數值 WGS84 站位 Point；不是候車區邊界、道路進出動線或即時空位。",
  coverageDescription: "2026-05-24 處理快照有 224 個 Point，僅臺北與嘉義；Kaohsiung raw 檔存在但未納本版，臺南檔標示 wrong dataset。資料更新與營運狀態未即時驗證。",
  sourceLineage: "臺北 134597 與嘉義 74927 原始名冊 -> analytics taxi_stand_20260524.geojson -> Mini taxi_stand.geojson；後兩者 SHA ac4b83e60768754276e142d3c0b41626ed50ec41a58581edf7d64bd340c5c532 完全相同。",
});

export const etcGantrySourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-etc-gantry-source-20260524", label: "國道 ETC 門架固定快照",
  description: "高公局 2026-05-24 處理版的 341 個門架 Point；收費牌價、目前通行規則或交通狀態須另核版本。",
  sourceUrl: "/geo/etc_gantry.geojson", expectedSha256: "f3e1b2433fec26b506482846a56027f8bc986c1ecbaec21f731ebc635d3ed5f1",
  expectedSourceRows: 341, expectedSelectedRows: 341, fullSource: true, selection: {}, layerRefs: ["etcGantry"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "GantryID", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "Freeway", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "Direction", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "StartInterchange", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "EndInterchange", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "TollMile", type: "string", nullable: false, nullMeaning: null, unit: "km_source_text" },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "交通部高速公路局（data.gov.tw 21165）",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）",
  precision: "來源數值 WGS84 門架 Point；不是國道線、交流道邊界或駕車路徑距離。",
  coverageDescription: "2026-05-24 固定處理快照 341 個 Point；高公局當前門架或牌價是否異動未驗證。",
  sourceLineage: "高公局 21165 原始 CSV -> analytics etc_gantry_20260524.geojson -> Mini etc_gantry.geojson；後兩者 SHA f3e1b2433fec26b506482846a56027f8bc986c1ecbaec21f731ebc635d3ed5f1 完全相同。",
});
