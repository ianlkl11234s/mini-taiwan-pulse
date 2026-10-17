import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed national facility snapshot; one representative source point per grouped address. */
export const publicToiletsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-public-toilets-source-coordinates", label: "全國公廁來源座標",
  description: "環境部公廁名冊的 13,281 個地址分組設施點。座標取分組內代表來源列，不保證是入口、目前開放位置或逐間廁所位置。",
  sourceUrl: "/environment/public_toilets_national.geojson",
  expectedSha256: "3f8f9e75b6f05e3697a0af90224bed792e435b1605678ce8182f6045e5d2bc5b",
  expectedSourceRows: 13281, expectedSelectedRows: 13281, fullSource: true, selection: {}, layerRefs: ["publicToilets"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "grade", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "type2", type: "string", nullable: false, nullMeaning: "空字串表示來源分類未填，不能解讀成無此類別", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "環境部公廁資料 FAC_P_07（data.gov.tw）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "WGS84 來源座標；按地址合併時採一筆代表點。多列同址時可能有不同座標；不保證入口或可達位置。",
  coverageDescription: "2026-07-17 本地 pipeline 批次的全國 22 縣市固定快照，原表 45,718 列、11 列無效座標排除、48 列經座標顛倒修正，按地址合併成 13,281 設施點。可查範圍只含發布檔四個屬性與代表 Point；沒有原始設施 ID、地址、廁間數或逐列種類。type2 有 2 筆空字串。批次日非逐筆觀測日，開放／品質現況未知。",
  sourceLineage: "環境部 FAC_P_07 本地原表 SHA f5d573a1bcfb2434749371b28f8a8124700aa2cf4bfc62a70ebff0ef29364e90 -> analytics public_toilets pipeline 按地址分組 -> compact GeoJSON 與 Mini public asset 同 SHA；record_id 為發布檔 SHA 加列索引，非來源設施 ID。FAC_P_28 臺北子集未另併入，避免重複。",
});
