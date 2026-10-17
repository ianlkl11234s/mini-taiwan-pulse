import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed canonical gas-station snapshot; brand values are non-exclusive evidence labels. */
export const gasStationsCanonicalAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-gas-stations-canonical", label: "全國加油站 canonical 來源座標",
  description: "2026-06-20 canonical 加油站快照的 3,053 個來源 Point。brand 是來源證據整理出的可重疊標籤，以 contains 查詢；它不代表特許經營、目前營業、供油品項或服務範圍。",
  sourceUrl: "/research/gas-stations-canonical-20260620.geojson",
  expectedSha256: "326b81ef20deef1dc3f9ced16c4e124b2db0bda97c4b86422dee8c5c5b9c3da3", expectedSourceRows: 3053, expectedSelectedRows: 3053, fullSource: true, selection: {},
  layerRefs: ["gasStationCpc", "gasStationFpcc", "gasStationTaisugar", "gasStationOther", "gasStationCanonical"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "entity_id", type: "string", nullable: false, nullMeaning: "來源 entity_id 有 3,022 個不同值對應 3,053 個 Point；唯一列識別使用 version-scoped record_id", unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: "來源有 34 筆空字串名稱；空白不是無站、歇業或匿名的判定", unit: null },
    { name: "brand", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_org", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "license", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "confidence", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "n_sources", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "台灣中油、台糖、經濟部商業司與 OpenStreetMap contributors 等來源的 canonical 合併快照",
  license: "mixed: OGDL-Taiwan-1.0 (2,610 筆最高 tier) + ODbL 1.0 (443 筆最高 tier)",
  precision: "processed GeoJSON 保留 canonical WGS84 Point；不保證加油站入口、界址、道路可達性或服務範圍。",
  coverageDescription: "2026-06-20 固定快照的全國 3,053 個 Point。brand contains 標籤計數為中油 2,023、台塑 350、台糖 86、unknown 698；中油／台塑／台糖可在同一站併存，故前三者合計不可當作互斥總數。fetched_at 是擷取日，並非現況營運時間；未提供電話或 _provenance。",
  sourceLineage: "analytics processed gas_stations_canonical_20260620.geojson SHA 00ee5b007a680788c25d1c4e1abf2da2628b776aec1a4644904f49a7dff15c80 -> SHA/count/Point/id/license/brand-membership validation -> deterministic safe-field sidecar；品牌標籤從 brand_guess 加上 provenance 中的品牌字串正規化而來，但 sidecar 不發布 provenance、地址或電話。",
});
