import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const source = {
  sourceUrl: "/geo/landing_stations.geojson",
  expectedSha256: "ec6646f1ab45623c6f5dd0b074582f806572a7223934bed172ff06221da35927",
  expectedSourceRows: 58,
  layerRefs: ["landingStations"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "osm_type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "osm_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "OSM 未標記站名，不代表沒有設施。", unit: null },
    { name: "operator", type: "string", nullable: true, nullMeaning: "OSM 未標記 operator。", unit: null },
    { name: "owner", type: "string", nullable: true, nullMeaning: "OSM 未標記 owner。", unit: null },
    { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "cable_count", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "coord_qc_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "coverage_note", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "osm_url", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "© OpenStreetMap contributors；Overpass snapshot",
  license: "ODbL-1.0",
} as const;

/** Eleven direct OSM node coordinates from the fixed, incomplete candidate snapshot. */
export const landingStationsNodeCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  ...source,
  datasetId: "osm-cable-landing-stations-node-coordinates",
  label: "OSM 海纜登陸站 node 座標",
  description: "OpenStreetMap 標記的 11 筆海纜登陸站 node 座標快照；它是群眾標註的全球不完整候選集，不代表完整清冊、設施入口、工程位置或即時營運狀態。",
  expectedSelectedRows: 11,
  selection: { coord_qc_status: "node_coordinates" },
  precision: "直接使用來源 OSM node 座標；不是設施入口、工程測量或埋設位置。",
  coverageDescription: "2026-08-18 取得的固定來源中 11/58 筆 node_coordinates 候選；全來源 coverage_note=incomplete_crowdsourced，空白區域不代表沒有登陸站。",
  sourceLineage: "OpenStreetMap telecom=cable_landing_station node -> fixed GeoJSON bytes -> SHA/count validation -> coord_qc_status=node_coordinates selection; crowd mapping is incomplete and coordinates do not establish facility access, engineering precision, cable routing, or current operating status.",
});

/** Forty-seven Overpass centers remain queryable provenance records, never spatial locations. */
export const landingStationsOverpassCenterAdapter = createVerifiedPointDatasetAdapter({
  ...source,
  datasetId: "osm-cable-landing-stations-overpass-centers",
  label: "OSM 海纜登陸站 Overpass center",
  description: "OpenStreetMap 標記的 47 筆海纜登陸站 way center 快照；center 是 Overpass 代表點，只能作候選 provenance 查詢，不能用於 bbox 或 nearest 空間判定。",
  expectedSelectedRows: 47,
  selection: { coord_qc_status: "overpass_center" },
  geometryRole: "proxy",
  precision: "OSM way 的 Overpass center 代表點；不是登陸站實際座標、入口、工程測量或埋設位置。",
  coverageDescription: "2026-08-18 取得的固定來源中 47/58 筆 overpass_center 候選；全來源 coverage_note=incomplete_crowdsourced，空白區域不代表沒有登陸站。",
  sourceLineage: "OpenStreetMap telecom=cable_landing_station way -> Overpass center -> fixed GeoJSON bytes -> SHA/count validation -> coord_qc_status=overpass_center selection; centers are proxy geometry and ineligible for spatial filtering or nearest analysis.",
});
