import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Tourism Bureau camping snapshot: one public source record per coordinate-valid Point. */
export const campingSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-camping-source-coordinates", label: "全台露營場固定名冊",
  description: "觀光署 2026-05-24 清洗快照 1,737 筆露營場；來源座標可作有界直線距離查詢，營業與合法性欄位只代表快照。",
  sourceUrl: "/tourism/camping_national.geojson",
  expectedSha256: "e15d21b89e040cf9591c46e85bc258cad03b2eb95d13d557691007bfcdfce39e",
  expectedSourceRows: 1737, expectedSelectedRows: 1737, fullSource: true, selection: {},
  layerRefs: ["tourCamping"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: "來源以空字串表示未填地址；不是確認沒有地址", unit: null },
    { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "legal_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "in_indigenous_area", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "setup_time", type: "string", nullable: false, nullMeaning: "來源以空字串表示未填設立時間或備註", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "交通部觀光署（data.gov.tw 132066）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源 WGS84 Point；未核驗營地入口、範圍邊界或步行可達性。",
  coverageDescription: "2026-05-24 本地清洗快照 1,737 Point；Mini 展示檔同筆數且與 analytics processed 每一筆 name+座標 multiset 完全相同。address 有 215 筆空字串、setup_time 有 1,533 筆空字串，空白不當成零。來源按季更新的說明不是本檔今日新鮮度。status/legal_status/setup_time 均依原字串保留，setup_time 可為文字備註；不推論今日營業或法規符合。",
  sourceLineage: "觀光署 nid 132066 原始 camping.csv SHA e523fbf474f1f51a4d9879347fb78f3bacd799d780d9ab5032ab5852a0e82158 -> analytics camping_20260524.geojson SHA ae36a20115123be2b87291e52b2178a0fc6e84f6b96e461f363ba3e002f5e735 -> Mini camping_national.geojson SHA e15d21b89e040cf9591c46e85bc258cad03b2eb95d13d557691007bfcdfce39e；processed 與 Mini 的 1,737 個 name+座標 multiset 完全對齊。",
});
