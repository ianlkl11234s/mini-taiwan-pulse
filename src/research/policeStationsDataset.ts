import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed nationwide police-facility snapshot; record_id is version-scoped because entity_id repeats. */
export const policeStationsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-police-stations-source-coordinates", label: "全國警察機關來源座標",
  description: "警政署與嘉義市鏡像整併的 2026-06-26 固定快照，含派出所、分局、警察局與專業警察機關。2,065 個 Point 列不是唯一機關母體；entity_id 有重複，唯一列識別使用 version-scoped record_id。",
  sourceUrl: "/research/police-stations-20260626.geojson",
  expectedSha256: "5d2bcc9d34d5f293b70255fbbdf70d7499a701137bd384df42bb60f477b66a16", expectedSourceRows: 2065, expectedSelectedRows: 2065, fullSource: true, selection: {},
  layerRefs: ["policeStation"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "entity_id", type: "string", nullable: false, nullMeaning: "來源 entity_id 僅 1,860 個不同值對應 2,065 個 Point 列；唯一列識別使用 version-scoped record_id", unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "confidence", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "n_sources", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "內政部警政署與嘉義市政府警察局（data.gov.tw 5958、24419、168315）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "processed GeoJSON 保留來源 WGS84 Point；不保證入口、警力服務範圍、現場開放狀態或道路可達性。",
  coverageDescription: "2026-06-26 固定快照的全國 2,065 個警察機關 Point 列：派出所 1,541、分局 163、警察局 27、專業警察 298、總部 5、其他 31。來源含 1,686 列 data.gov.tw 5958、377 列 24419、2 列 168315；無地址、電話與 _provenance。fetched_at 是 pipeline 擷取日，不代表現時配置、營運或服務狀態；與任何既有 policeStation display asset 的 same-version 對齊尚未驗證。",
  sourceLineage: "data.gov.tw 5958、24419、168315 -> analytics police_stations_20260626.geojson SHA 63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7 -> SHA/count/Point/schema/source/subtype/id-duplication validation -> deterministic safe-field sidecar；entity_id 重複 205 列，保留原始列且 record_id 為發布檔 SHA 加列索引；layerRef 僅指向 policeStation，不構成 display 資產同版證據。",
});
