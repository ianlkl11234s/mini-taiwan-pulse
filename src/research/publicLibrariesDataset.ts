import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const common = {
  sourceUrl: "/research/public-libraries-source-20260717.geojson",
  expectedSha256: "d096a63d3b4c6c61be29e236c6e3e4f9f5139a89189b67e541011a112f9805f8", expectedSourceRows: 644, layerRefs: ["publicLibraries"],
  fields: [
    { name: "record_id", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "type", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json" as const, nullable: true, nullMeaning: "名冊列未取得可用座標；不代表圖書館不存在、停業或不在該縣市", unit: null },
  ] as const,
  publisher: "國家圖書館圖書館名錄（guide.ncl.edu.tw opendata；data.gov.tw 8306）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  sourceLineage: "國家圖書館 2026-07-17 BIG5 原始 CSV SHA 09762ba750e9da4a392481507fd20a462cdcd05037ef5e35b7b29ac84a7173b3 -> 公共圖書館 644 筆子集 -> processed 634 Point GeoJSON SHA 4223d9558df384c8bcbad50087091d2038408157569f512deebf2bb6ce5600a2（TGOS 570、L1 62、offline_exact 2）-> 644-row sidecar SHA/count/alignment validation。",
} as const;

/** Full official library list is attribute-queryable, including the 10 unlocated records. */
export const publicLibrariesListedAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  datasetId: "tw-public-libraries-listed", label: "全國公共圖書館官方名冊",
  description: "國家圖書館 2026-07-17 公共圖書館名冊 644 筆；保留 10 筆未定位紀錄。座標混合 TGOS、L1 與 offline_exact 地址級回填，整份不作附近或距離證據。",
  expectedSelectedRows: 644, fullSource: true, selection: {}, preserveUnlocatedRecords: true, geometryRole: "proxy",
  precision: "570 筆 TGOS、62 筆 L1 cache、2 筆 offline_exact 地址級座標及 10 筆 null；整份不保證館舍入口、邊界、道路可達性或服務範圍。",
  coverageDescription: "全國 22 縣市公共圖書館固定名冊 644 筆：634 筆有座標、10 筆 coord_method=none 且 geometry=null。county/town 直接保留來源欄位，不由座標推回；名冊更新頻率 yearly，2026-07-17 為本地快照日，非目前開館、座位或館藏狀態。",
});

/** Only TGOS address-level coordinates are eligible for bounded straight-line nearby queries. */
export const publicLibrariesTgosCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  fields: common.fields.map(field => field.name === "geometry" ? { ...field, nullable: false, nullMeaning: null } : field),
  datasetId: "tw-public-libraries-tgos-coordinates", label: "公共圖書館 TGOS 地址座標",
  description: "同版 644 筆官方名冊中 570 筆 TGOS 地址級 Point；可做有界直線距離或 bbox 候選查詢，不能代表圖書館入口或步行可達。",
  expectedSelectedRows: 570, selection: { coord_method: "TGOS" },
  precision: "TGOS 地址級 WGS84 Point；未驗證館舍入口、測量精度、服務範圍或道路可達性。",
  coverageDescription: "同版 644 筆名冊中，只註冊 570 筆 TGOS 地址級 Point 供空間查詢；62 筆 L1、2 筆 offline_exact 及 10 筆無座標均排除。此 subset 是座標方法篩選，並非名冊覆蓋率或館舍類型篩選。",
});
