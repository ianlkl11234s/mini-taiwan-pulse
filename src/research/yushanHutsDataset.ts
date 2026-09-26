import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Only the coordinate-source-qualified subset; never expose OSM-derived capacity/elevation as official facts. */
export const yushanHutsAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-yushan-huts-official-coordinates", label: "玉山官方座標山屋與營地子集",
  description: "固定山屋混合來源快照中，僅讀取 coord_source=yushan_np_shp、source_tier=1、in_yushan_official=true 的30筆。名稱與座標逐筆對照快照內官方 provenance 一致；其餘106筆OSM座標不在此分析範圍。2026-08-01取得，官方資料名為114年修；不代表目前開放、安全、床位或全臺山屋。原始SHP檔案雜湊尚未取得。",
  sourceUrl: "/forestry/mountain_huts.geojson",
  expectedSha256: "5e9f4a1017089dd02540720f1da34b191048e1638dcacf0e29f5aec77f6212e4",
  expectedSourceRows: 136, expectedSelectedRows: 30,
  selection: { coord_source: "yushan_np_shp", source_tier: 1, in_yushan_official: true },
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "entity_id", type: "string", nullable: true, nullMeaning: "混合來源產製識別碼，不是官方設施代碼", unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "快照未提供官方名稱", unit: null },
    { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "in_yushan_official", type: "boolean", nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "string", nullable: true, nullMeaning: "來源取得日期不明；不是觀測日期", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "內政部國家公園署／玉山國家公園；data.gov.tw/dataset/7449；existing mixed-source artifact",
  license: "官方名稱及座標：OGDL-Taiwan-1.0（data.gov.tw/7449）；載入原檔亦含OpenStreetMap ODbL資料，並非全檔純官方資料",
  precision: "官方SHP來源座標，固定快照保留小數6位；30筆與內嵌官方provenance座標相等；未取得raw SHP SHA，不宣稱測量精度或山徑距離",
});
