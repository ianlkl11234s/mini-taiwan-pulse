import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Historical MOENV contaminated-site records; deannounced is not an active site. */
export const pollutionSitesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-pollution-sites-source-coordinates", label: "土壤與地下水污染場址名冊",
  description: "環境部 EMS_S_07 的 2026-07-06 固定名冊，8,253 筆確認污染場址紀錄，當中 365 筆仍列管、7,888 筆已解除公告。Point 是來源場址參考座標，不代表場址邊界或當前風險。",
  sourceUrl: "/research/pollution-sites-20260706.geojson",
  expectedSha256: "a9a948ff18112a4ccf82517fc6927a6249ed86f4ebf73d9f27f7f4ed8bfdcab2", expectedSourceRows: 8253, expectedSelectedRows: 8253, fullSource: true, selection: {},
  layerRefs: ["pollutionSite"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "site_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "site_name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "township", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "site_type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "controltype", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "is_active", type: "number", nullable: false, nullMeaning: "1 是快照當時列管，0 是已解除公告；不是今日狀態", unit: null },
    { name: "anno_date", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "anno_year", type: "number", nullable: false, nullMeaning: null, unit: "year" },
    { name: "deanno_date", type: "string", nullable: true, nullMeaning: "快照當時尚未解除公告，來源無解除日期；不是零日期", unit: null },
    { name: "sitearea", type: "number", nullable: false, nullMeaning: "取上游 staged 原值，避免 frontend 整數化截斷；不是 Point 幾何面積", unit: "m²" },
    { name: "pollutant_short", type: "string", nullable: false, nullMeaning: "來源摘要原字串，濃度的介質與單位須按文字閱讀；不是即時測量", unit: null },
    { name: "source_kind", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "max_sev", type: "number", nullable: false, nullMeaning: "固定分類 S4；不代表所有場址仍列管", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "環境部環境資料開放平臺 EMS_S_07",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源 staged GeoJSON 保留 WGS84 Point，_geocode=wgs84；座標不是公告範圍、污染羽流、地塊界址或暴露風險。",
  coverageDescription: "2026-07-06 固定名冊 8,253 個 Point，包含歷史解除公告 7,888 筆與當時仍列管 365 筆。site_id 唯一；未對今日公告狀態作即時查核。sitearea 取 staged 原始數值，frontend 曾將 1,568 筆小數面積截為整數；0/缺值不可自行解讀為實測面積。",
  sourceLineage: "MOENV EMS_S_07 -> staged soil_gw_pollution_sites_20260704.geojson SHA 9139e65862c7206fefcb298e94299e9ed5e28b9b6c072edf1fd83a9a628bd394 -> frontend pollution_sites_20260706.geojsonseq SHA 095079a9717b647a3b4ab1c5ae95d0d8ac8750c2ac8379e957b3c7b7e3ff5682 -> 8,253 ID/Point/name/status checks and staged sitearea restored -> safe fixed SHA sidecar. Existing PMTiles display release is separately pending alignment.",
});
