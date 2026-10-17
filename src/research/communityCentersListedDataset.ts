import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** All processed source rows remain attribute-queryable; mixed generated coordinates are never spatial evidence. */
export const communityCentersListedAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-community-centers-listed", label: "社區活動中心來源名冊",
  description: "8 縣市拼裝的活動中心固定名冊；含地址地理編碼與離線回填座標及無座標列，僅可作屬性查詢，不能作附近或距離分析。",
  sourceUrl: "/research/community-centers-listed-source-20260717.geojson",
  expectedSha256: "898e50bf7109b80675ac46203cf8c9fb94f88a76549037d373710ff856247774", expectedSourceRows: 1812, expectedSelectedRows: 1812,
  fullSource: true, selection: {}, preserveUnlocatedRecords: true, geometryRole: "proxy", layerRefs: ["communityCenters"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "來源未能定位；該中心仍保留於名冊", unit: null },
  ],
  publisher: "臺北市、花蓮縣、南投縣、高雄市、新北市、桃園市、彰化縣及金門縣政府開放資料",
  license: "各縣市來源採 CC0 或政府資料開放授權條款（OGDL）",
  precision: "592 筆來源原生座標、1,202 筆 TGOS/L1 或離線回填 proxy、18 筆 null；整份資料不具空間分析資格。",
  coverageDescription: "2026-07-17 固定 processed 快照共 1,812 筆：native 592、TGOS/L1/offline proxy 1,202、no_coord 18。8 縣市拼裝且高雄只含 17/38 區，不能解讀為全國覆蓋、缺席、零值或目前開放狀態。geometry=null 不等於設施不存在；proxy 不等於實際入口或設施位置。各來源更新週期不一，快照日不是觀測期或目前狀態。",
  sourceLineage: "各縣市公開名冊 -> community_centers 01_download / 02_normalize -> 07_export processed GeoJSON（SHA 898e50bf7109b80675ac46203cf8c9fb94f88a76549037d373710ff856247774、1,812 rows）-> deterministic safe-field sidecar SHA/count validation。native 與 TGOS/L1/offline 坐標混合，整份以 proxy 標示且不可作 spatial filtering 或 nearest analysis；18 no_coord 保留為 null。",
});
