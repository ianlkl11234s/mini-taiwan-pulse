import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed, coordinate-rights-safe sidecar derived only from the TGOS portion of the mixed upstream artifact. */
export const elderlyCareHomesTgosUpstreamAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-elderly-care-homes-tgos-upstream", label: "老人住宿機構 TGOS 來源座標",
  description: "老人住宿機構固定 sidecar，僅含 1,160 筆原始產物中的 1,043 筆 `tgos_upstream/upstream` Point。原始產物的 Google 與離線座標沒有放入此資產；機構紀錄數不等於唯一服務據點、床位或目前可服務量。",
  sourceUrl: "/research/elderly_care_homes_tgos_upstream.geojson",
  expectedSha256: "5031ace9289687cd58f1410c599caa593d51f776072067493c660565d6839cb0", expectedSourceRows: 1043, expectedSelectedRows: 1043, fullSource: true, selection: {}, layerRefs: ["welfareElderlyHomes"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    ...["uid", "name", "welfare_class", "address", "city", "coord_source", "coord_precision", "src_datasets", "sub_code", "permit_status", "inst_code", "src_system"].map(name => ({ name, type: "string" as const, nullable: false, nullMeaning: null, unit: null })),
    ...["attr_type", "beds_approved", "target", "licensed_at", "district"].map(name => ({ name, type: "string" as const, nullable: true, nullMeaning: "原始來源未提供機構屬性資料", unit: null })),
    { name: "phone", type: "string", nullable: true, nullMeaning: "原始來源未提供電話", unit: null },
    { name: "uni_no", type: "string", nullable: true, nullMeaning: "原始來源未提供統一編號", unit: null },
    ...["nature", "authority", "subtype"].map(name => ({ name, type: "string" as const, nullable: true, nullMeaning: "原始來源未提供補充分類", unit: null })),
    { name: "n_src", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "衛生福利部社會福利機構總表與既有福利資料產物（data.gov.tw/dataset/165355、8572；另有一筆來源標示 161606）；existing welfare artifact",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "原始產物標示 tgos_upstream/upstream 的地址級 TGOS Point；未驗證入口、測量精度、服務轄區或目前營運狀態。",
  coverageDescription: "原始固定產物 1,160/1,160 為 Point；sidecar 只收錄 1,043 筆 tgos_upstream/upstream。另 33 筆 Google、84 筆 offline（28 l15、46 l2、10 l1）未納入；來源欄位包含 165355、8572 與一筆 161606，原始觀測期與 current availability unknown。sidecar null 數：attr_type/beds_approved/target/licensed_at/district 各 65、phone 66、uni_no 978、nature/authority/subtype 各 1,042，皆為來源未提供。",
  sourceLineage: "既有老人住宿機構 mixed-coordinate fixed artifact SHA-256 0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f (1,160 Point records) -> builder equality selection tgos_upstream/upstream -> fixed 1,043-Point public sidecar -> SHA/count validation. permit_status is retained verbatim and is not an operational assertion.",
});
