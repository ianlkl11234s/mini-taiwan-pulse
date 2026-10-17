import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const common = {
  sourceUrl: "/research/amusement-parks-source-20260723.geojson",
  expectedSha256: "65e70b6312204b5b40b974e382e328f88d872d139a845e435c6e70e3b1b0c4ea",
  expectedSourceRows: 27, layerRefs: ["tourAmusementParks"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "id", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "inspection_date", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "inspection_issues_count", type: "number", nullable: false, nullMeaning: null, unit: "records" },
    { name: "has_accessible_facility", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "has_aed", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "主檔未提供可解析座標；園區仍在名冊中", unit: null },
  ] as const,
  publisher: "交通部觀光署（data.gov.tw 38257 基本資料、46676 安檢）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  sourceLineage: "觀光署 38257 主檔 27 園區與 46676 安檢 193 筆 join -> analytics amusement_park_20260723.geojson SHA f9285d1d13f9693b33ee885a58f8f7c7d61ce84334839787b440aa3567870303 -> deterministic safe-field sidecar SHA/count validation。inspection_issues_count 是督導紀錄數，不可當目前未改善缺失數；record_id 是發布檔 SHA 加列索引。",
};

/** All 27 park rows remain attribute-queryable, including parking proxies and one unlocated park. */
export const amusementParksListedAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  datasetId: "tw-amusement-parks-listed", label: "民營遊樂園官方名冊",
  description: "觀光署 27 園區固定主檔與最新安檢摘要欄位的有界查詢；座標混合園區、停車場與缺值，整體不作精確附近運算。",
  expectedSelectedRows: 27, fullSource: true, selection: {}, preserveUnlocatedRecords: true, geometryRole: "proxy",
  precision: "24 筆由來源地址內嵌園區座標解析，2 筆採停車場座標，1 筆 null；整份混合資料只作屬性查詢。",
  coverageDescription: "2026-07-23 本地固定名冊 27 筆全可按屬性查；24 筆 park_address、2 筆 parking、1 筆 none。geometry=null 不等於園區不存在；停車場點不等於園區入口。設施旗標是來源快照，不保證今日服務；安檢日期逐筆不同，督導紀錄數不是未改善缺失數。",
});

/** Only the 24 parsed source park coordinates qualify for bounded nearby questions. */
export const amusementParksSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  fields: common.fields.map(field => field.name === "geometry" ? { ...field, nullable: false, nullMeaning: null } : field),
  datasetId: "tw-amusement-parks-source-coordinates", label: "民營遊樂園園區來源座標",
  description: "觀光署名冊中 24 筆直接從園區地址內嵌座標解析的 Point；排除停車場代理點與無座標園區。",
  expectedSelectedRows: 24, selection: { coord_source: "park_address" },
  precision: "來源地址內嵌的 WGS84 園區座標；未驗證入口、園區邊界、測量精度或步行可達。",
  coverageDescription: "同版名冊 27 園區中，只有 24 筆 park_address Point 納入附近查詢；2 筆 parking 代理點與 1 筆無座標排除。安檢日期及服務旗標是來源快照，不表示目前安全或營業。",
});
