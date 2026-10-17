import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed 2026-07-17 retail-market snapshot; only upstream TGOS address-level coordinates are registered. */
export const retailMarketsTgosAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-public-retail-markets-tgos", label: "公有零售市場 TGOS 地址座標",
  description: "經濟部商業發展署公有零售市場名冊的 2026-07-17 processed 快照。731 筆有座標 Point 中，此 reader 只保留 653 筆 TGOS 地址級座標；`record_id` 由固定 SHA 與本 sidecar 列索引產生，僅在此版本有效。地址級座標不是測量過的市場入口，亦不表示目前開市或營運。",
  sourceUrl: "/research/retail_markets_tgos_20260717.geojson",
  expectedSha256: "545124678354a59c27c087af62553acaffd74c61b1717751d21614561b12bd88",
  expectedSourceRows: 653, expectedSelectedRows: 653, fullSource: true, selection: {}, layerRefs: ["retailMarkets"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string", nullable: true, nullMeaning: "來源 town 為空字串（48 筆），未推補行政區", unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "business_hours", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "經濟部商業發展署（歷史 catalog：經濟部中部辦公室；data.gov.tw/dataset/59855）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "TGOS 地址級 Point；未驗證市場入口、測量精度、服務範圍或道路可達性。",
  coverageDescription: "全國原始名冊 789 筆；processed 731 筆有座標 Point。reader 註冊其中 653 筆 TGOS 地址級座標，排除 70 筆 Google L1 與 8 筆 offline（4 exact、4 interpolated）；另 58 筆無座標未進 processed。2026-07-17 是 pipeline 快照日，不是觀測日；目前開市／營運狀態 unknown。",
  sourceLineage: "經濟部商業發展署 data.gov.tw 59855 公有零售市場名冊 -> retail-market pipeline 2026-07-17 coordinate/export -> fixed processed 731-Point GeoJSON SHA/count/method validation -> TGOS-only 653-Point sidecar -> SHA/count validation; processed sidecar does not carry a source UID, so record_id is version-scoped SHA plus sidecar index; source fields and geometry are retained unchanged.",
});
