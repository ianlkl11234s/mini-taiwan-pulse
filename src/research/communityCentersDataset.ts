import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Source-native coordinates only; address-geocoded and offline fallback points stay outside this reader. */
export const communityCentersNativeCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-community-centers-native-coordinates", label: "社區活動中心來源原生座標",
  description: "8 縣市拼裝活動中心快照中，592 筆 `coord_method=native` 的固定來源座標子集。資料只涵蓋已收錄的縣市與行政區，不能視為全國活動中心名冊或目前開放狀態。",
  sourceUrl: "/civic_facilities/community_centers_national.geojson",
  expectedSha256: "673c56098634d8174d32c3d02471133219ee107c3182a44fea413f66fe97bfb2",
  expectedSourceRows: 1794, expectedSelectedRows: 592, selection: { coord_method: "native" }, layerRefs: ["communityCenters"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "臺北市、花蓮縣、南投縣及高雄市政府開放資料；existing civic-facilities artifact",
  license: "各縣市來源採 CC0 或政府資料開放授權條款（OGDL）；本 reader 僅選原生座標列",
  precision: "來源標示 native 的 WGS84 Point；臺北、花蓮、南投原始 TWD97 TM2 座標已轉為 WGS84，高雄原始 WGS84。未驗證設施入口、測量精度、服務範圍或目前營運狀態。",
  coverageDescription: "2026-07-17 固定快照的 public asset 有 1,794 個有效 Point；本 reader 只保留 592 筆 native 座標（臺北市 162、花蓮縣 102、南投縣 221、高雄市 107）。完整處理產物為 1,812 筆，另 18 筆 no_coord 已在 public asset 前排除；其餘 1,202 個有效 Point 是 TGOS、L1 或離線回填，未註冊。8 縣市拼裝且高雄只含 17/38 區，不能解讀為全國覆蓋、缺席或零值。各來源更新週期不一，快照日不是觀測期或目前狀態。",
  sourceLineage: "各縣市公開名冊 -> community_centers 01_download / 02_normalize -> 07_export processed GeoJSON（1,812 rows、18 no_coord）-> 08_pulse_export 排除 no_coord -> fixed public GeoJSON SHA/count validation -> coord_method=native equality selection。TGOS、L1 與 offline fallback 坐標不進入這個 source-native reader。",
});
