import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed, coordinate-rights-safe sidecar derived only from the TGOS portion of the mixed upstream artifact. */
export const ltcInstitutionsTgosUpstreamAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-ltc-institutions-tgos-upstream", label: "長照立案機構 TGOS 來源座標",
  description: "長照立案機構固定 sidecar，僅含 3,117 筆原始產物中的 3,053 筆 `tgos_upstream/upstream` Point。原始產物的 Google 與離線座標沒有放入此資產；機構紀錄數不等於唯一服務據點或目前可服務量。",
  sourceUrl: "/research/ltc_institutions_tgos_upstream.geojson",
  expectedSha256: "4d83b83a71e2898025c2a97c5189a57060c6ec67ea675732e9a9cd96c58f87c3", expectedSourceRows: 3053, expectedSelectedRows: 3053, fullSource: true, selection: {}, layerRefs: ["welfareLtcInstitutions"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    ...["uid", "name", "welfare_class", "address", "city", "coord_source", "coord_precision", "src_datasets", "sub_code", "permit_status", "inst_code", "src_system"].map(name => ({ name, type: "string" as const, nullable: false, nullMeaning: null, unit: null })),
    { name: "uni_no", type: "string", nullable: true, nullMeaning: "原始來源未提供統一編號", unit: null },
    { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "衛生福利部社會福利機構總表（data.gov.tw/dataset/165355）；existing welfare artifact",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "原始產物標示 tgos_upstream/upstream 的地址級 TGOS Point；未驗證入口、測量精度、服務轄區或目前營運狀態。",
  coverageDescription: "原始固定產物 3,117/3,117 為 Point；sidecar 只收錄 3,053 筆 tgos_upstream/upstream。另 29 筆 Google、35 筆 offline（25 l2、9 l1、1 l15）未納入；原始資料集 165355，原始觀測期與 current availability unknown。sidecar 僅 uni_no 有 15 筆 null，代表來源未提供。",
  sourceLineage: "衛福部社會福利機構總表 165355 -> existing mixed-coordinate fixed artifact SHA-256 876b771afdb69676a342750f215fbfdaffd4cdfeaf4b73704d4297a2591c72cb (3,117 Point records) -> builder equality selection tgos_upstream/upstream -> fixed 3,053-Point public sidecar -> SHA/count validation. permit_status is retained verbatim and is not an operational assertion.",
});
