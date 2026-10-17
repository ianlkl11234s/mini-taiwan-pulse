import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed MOHW welfare-office snapshot; direct TGOS address coordinates only. */
export const govWelfareOfficesUpstreamCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-gov-welfare-offices-upstream-coordinates", label: "公部門社福據點來源座標",
  description: "衛福部社會福利機構總表 165355 的公部門社福據點快照。processed 307 筆中，08 pulse 已在上游排除 156 筆 T0103，形成 151 筆 Point 顯示子集；本 reader 只保留其中 133 筆 `tgos_upstream/upstream` 地址級座標。`uid` 只在此來源快照中有效；record_id 由固定 SHA 與來源列索引產生。permit_status 原樣保留，不代表目前有效、開放或可服務。",
  sourceUrl: "/welfare/welfare_gov_offices_national.geojson",
  expectedSha256: "cd6b21ef107b810a70a07bbbba1b4a4308f363d321c2d6a8c15f260b152ae664",
  expectedSourceRows: 151, expectedSelectedRows: 133,
  selection: { coord_source: "tgos_upstream", coord_precision: "upstream" }, layerRefs: ["welfareGovOffices"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "sub_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "permit_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "src_datasets", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "inst_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uni_no", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源標示 tgos_upstream/upstream 的地址級 TGOS Point；未驗證設施入口、測量精度、服務轄區或目前營運狀態。",
  coverageDescription: "全台 22 縣市 processed 公部門社福據點共 307 筆；08 pulse 顯示 151 筆 Point，已由上游 presentation dedupe 排除 156 筆 T0103。reader 僅註冊 133 筆 tgos_upstream/upstream；另 17 筆 Google 與 1 筆 offline_l2 不在 reader 範圍。165355 Last-Modified 2024-11-12，pipeline 快照 2026-08-12；observed period unknown。",
  sourceLineage: "衛福部社會福利機構總表 data.gov.tw 165355（Last-Modified 2024-11-12） -> welfare pipeline 2026-08-12 classify/coordinate/export -> upstream presentation dedupe excludes T0103 -> fixed 151-Point GeoJSON bytes -> SHA/count validation -> tgos_upstream/upstream equality selection; uid is source-snapshot-scoped and record_id is version-bound SHA plus source index; permit_status is retained verbatim and is not an operational assertion.",
});
