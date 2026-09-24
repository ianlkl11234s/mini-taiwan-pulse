import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed welfare-center snapshot; only upstream TGOS address coordinates are eligible. */
export const welfareCentersUpstreamCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-welfare-centers-upstream-coordinates", label: "社會福利服務中心來源座標",
  description: "社會福利服務中心 2026-08-12 pipeline 快照的 162 筆 Point 中，只保留 153 筆 `upstream_tgos` 地址級座標。`uid` 是上游以正規化名稱 SHA-1 前 8 碼產生、同名碰撞加順序後綴的來源快照識別，不保證跨版本永久穩定。",
  sourceUrl: "/research/welfare_centers_upstream_20260812.geojson",
  expectedSha256: "4ee40e3767ba143c725f6fb4bbbbe100d4a23cd53d792f8a2135c824f52e7c6f", expectedSourceRows: 153, expectedSelectedRows: 153, fullSource: true, selection: {}, layerRefs: ["welfareCenters"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "town", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "衛生福利部社會及家庭署社會福利服務中心資料（data.gov.tw 目錄 OGDL）；existing upstream pipeline artifact",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源標示 upstream_tgos 的地址級 WGS84 Point；位置是來源地址座標，未驗證設施入口、測量精度、服務範圍或目前營運狀態。",
  coverageDescription: "上游 pipeline 2026-08-12 快照的 162 筆 Point 中，reader 只註冊 153 筆 upstream_tgos 地址級 WGS84 Point；另 5 筆 offline_l1_cached、3 筆 google_approximate、1 筆 google_exact 不在 reader 範圍。Last-Modified 2024-11-12；snapshot 不是觀測期或目前狀態。service_area 來自較舊且分離的 160903 來源，未納入 sidecar。",
  sourceLineage: "衛福部社會及家庭署社會福利服務中心資料（catalog OGDL；Last-Modified 2024-11-12） -> upstream 02_normalize uid -> 2026-08-12 coordinate pipeline -> fixed 162-Point GeoJSON SHA/count/method validation -> upstream_tgos only deterministic sidecar SHA/count validation; uid is source-snapshot-scoped, and no current operations, entrance, or service-catchment claim is made.",
});
