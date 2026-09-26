import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed Cultural Heritage Administration source-coordinate snapshot; not a building-footprint dataset. */
export const tourHeritageFixedAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-tour-heritage-fixed-20260524", label: "文化資產固定快照",
  description: "文化部文化資產局古蹟、歷史建築與文化景觀的 2026-05-24 固定快照，共 2,894 個來源 WGS84 Point。Point 是來源代表位置，可用於 bbox 與直線鄰近參考；不是文化資產建物、基地或文化景觀的範圍，也不代表目前登錄、開放、修復或可達狀態。",
  sourceUrl: "/tourism/heritage_national.geojson",
  expectedSha256: "7bc0ccae1aea7367ceab79cc95d778a9884cfb5069a0ec902e97bf9edaa2f7b7",
  expectedSourceRows: 2_894, expectedSelectedRows: 2_894, fullSource: true, selection: {}, layerRefs: ["tourHeritage"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "grade", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "types", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "gov", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "case_url", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "image", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "文化部文化資產局（國家文化資產網；data.boch.gov.tw）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "文資局來源 WGS84 Point 是資產的代表參考位置，可作 bbox 與直線鄰近參考；不是古蹟或歷史建築的建物／基地範圍，也不是文化景觀範圍、入口、道路距離、步行或 transit 可達性。",
  coverageDescription: "固定 2026-05-24 快照完整保留 2,894 個來源 Point：古蹟 1,056、歷史建築 1,759、文化景觀 79。歷史建築的 1,759 筆 grade 是來源缺值，固定資產以空字串 \"\" 保留；它不是 null，也不是數值 0。此固定快照不代表目前登錄、保存、開放、修復、入場或交通可達狀態。",
  sourceLineage: "文化部文化資產局 data.boch.gov.tw v2 assetsCase 1.1（古蹟）／1.2（歷史建築）／3.1（文化景觀）JSON -> taipei-gis-analytics heritage_20260524.geojson SHA-256 6946a719b30a606250228d97890eed323f58a0cba10238e8290c0099a5b163e4 -> Mini heritage_national.geojson SHA-256 7bc0ccae1aea7367ceab79cc95d778a9884cfb5069a0ec902e97bf9edaa2f7b7；兩者皆有 2,894 Point，Mini 僅移除與 geometry 重複的 longitude／latitude properties。原始 API JSON 未在此 reader workspace 留存，故不能由此版本重驗原始回應。",
});
