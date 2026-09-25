#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";
import { RESEARCH_QUERY_EXECUTOR, registeredDatasetsForLayer } from "../../src/research/researchDatasets.ts";
import { describeRegisteredLayer } from "../../src/research/registeredLayerReader.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DEFAULT_AUDIT_DATE = "2026-09-23";
const DEFAULT_OUTPUT_BASE = "docs/features/general-analysis/capability-audit-20260923";
const VERIFIED_RAW_FAMILIES = {
  "business_registry:company_stock:202608": {
    sourceArtifact: "taipei-gis-analytics/data/processed/business_registry/company_stock/company_stock_202608.csv",
    sourceArtifactRole: "canonical processed assembly; upstream raw is a 118-file regional CSV matrix, not one company_stock raw CSV",
    evidence: [
      "taipei-gis-analytics/data/processed/business_registry/company_points/company_points_202608_r2_qa.json",
      "taipei-gis-analytics/data/processed/business_registry/company_capital_grid/company_capital_grid_202608_r2_qa.json",
      "taipei-gis-analytics/data/processed/business_registry/manufacturing_company_points/manufacturing_company_points_202608_r2_qa.json",
    ],
    sourceVersion: "202608",
    publisher: "經濟部商業發展署 GCIS",
    license: "OGDL-Taiwan-1.0",
    observedAt: "2026-08 snapshot",
    acquiredAt: null,
    acquiredAtAvailability: "not recorded in the inspected QA receipts; 2026-08-18 is processed release date, not asserted raw acquisition time",
    coverageAndMissingness: "657,882 source rows; 1,152 dead_or_abnormal and 2,565 invalid-coordinate rows excluded; 654,165 published. capital_total missing 2,435; setup_year missing 16. Manufacturing exact-C: 186,054 source, 1,110 invalid-coordinate, 184,944 published.",
    geometry: "company_points is EPSG:4326 Point; company_capital_grid is EPSG:4326 Polygon at 150m/450m/1500m; manufacturing is an exact-C filter view over company_points.",
    sourceSha256: "c3a191b234e718dc7b5ca4a9b5c599c279b1fefc9e2d1d606e5722c3eb4e900c",
  },
  "nlsc:county_boundary:COUNTY_MOI_1140318": {
    sourceArtifact: "taipei-gis-analytics/data/raw/demographics/county_boundary/COUNTY_MOI_1140318.zip",
    evidence: [
      "taipei-gis-analytics/docs/data-catalog/demographics/county_boundary.md",
      "taipei-gis-analytics/data/processed/demographics/county_boundary/_manifest.json",
    ],
    sourceVersion: "COUNTY_MOI_1140318",
    publisher: "內政部國土測繪中心 (NLSC)",
    license: "政府資料開放授權條款-第1版",
    observedAt: "2025-03-18 snapshot",
    acquiredAt: null,
    acquiredAtAvailability: "not recorded in inspected manifest/catalog; 2026-06-26 is catalog update date, not asserted raw acquisition time",
    coverageAndMissingness: "22 county MultiPolygon features; null-field and null-geometry rates were not recorded in the inspected manifest.",
    geometry: "MultiPolygon, EPSG:4326; source GML lacked CRS metadata and pipeline assigns EPSG:4326.",
    sourceSha256: null,
  },
  "moa:forest_roads:datagov-38213": {
    sourceArtifact: "taipei-gis-analytics/data/raw/forestry/forest_roads/",
    evidence: [
      "taipei-gis-analytics/docs/data-catalog/forestry/forest_roads.md",
      "taipei-gis-analytics/data/processed/forestry/forest_roads/_manifest.json",
      "taipei-gis-analytics/data/processed/forestry/forest_roads/_verification.json",
    ],
    sourceVersion: "not supplied by the inspected local receipt",
    publisher: "林業及自然保育署",
    license: "政府資料開放授權條款-第1版",
    observedAt: null,
    acquiredAt: null,
    acquiredAtAvailability: "not recorded; catalog says 2026-06-07 night ingest while processed manifest says last_updated 2026-05-19, so neither is asserted as source observation/acquisition time",
    coverageAndMissingness: "107 records; verification reports all 107 as LineString. Field-level null rates were not recorded in the inspected receipt.",
    geometry: "LineString, EPSG:4326 in processed GeoJSON; source wrapper to SHP UTF-8.",
    sourceSha256: null,
    localDisplayReceipt: "P2 2026-09-25 rebuild: analytics raw SHA-256 68f261…1f16 rebuilt with exact metadata/tippecanoe options and exactly matched original-checkout forest_roads.pmtiles SHA-256 68bfbdb3…67cc. This proves local raw-to-display identity only; runtime release was not read.",
  },
};
const VERIFIED_RAW_FAMILY_BY_LAYER = {
  companyPoints: "business_registry:company_stock:202608",
  manufacturingCompanyPoints: "business_registry:company_stock:202608",
  companyCapitalGrid: "business_registry:company_stock:202608",
  countyBoundary: "nlsc:county_boundary:COUNTY_MOI_1140318",
  forestRoads: "moa:forest_roads:datagov-38213",
};
const DISPLAY_RAW_ALIGNMENT_BY_LAYER = {
  companyPoints: {
    status: "LINEAGE_VERIFIED_LOCAL_RELEASE",
    evidence: "company_points and both declared company_capital_grid r2 artifacts have matching 202608 processed QA/manifest lineage to company_stock_202608.csv; mini remote release is not read in this audit.",
  },
  companyCapitalGrid: {
    status: "LINEAGE_VERIFIED_LOCAL_RELEASE",
    evidence: "all three declared r2 grid artifacts are recorded in the 202608 processed manifest/QA and reconcile to company_stock_202608.csv; mini remote release is not read in this audit.",
  },
  manufacturingCompanyPoints: {
    status: "DISPLAY_ARTIFACT_RECEIPT_MISSING",
    evidence: "analytics r2 receipt names shared company_points detail/overview artifacts, while this manifest declares manufacturing_company_points_202608_allzoom.pmtiles; no inspected receipt proves that display artifact is the same release.",
  },
  countyBoundary: {
    status: "DISPLAY_ARTIFACT_RECEIPT_MISSING",
    evidence: "analytics catalog/processed lineage proves COUNTY_MOI_1140318 raw-to-local output, but the inspected local manifest records no SHA tying mini base_map/county_boundary.pmtiles to that output.",
  },
  forestRoads: {
    status: "LOCAL_RAW_TO_DISPLAY_PROVEN",
    evidence: "P2 2026-09-25 rebuilt from analytics raw SHA-256 68f261…1f16 using exact metadata/tippecanoe options and matched original-checkout forest_roads.pmtiles SHA-256 68bfbdb3…67cc. Runtime release was not read.",
  },
};
const VERIFIED_RAW_FAMILY_BY_DATASET = {
  gas_stations: "taiwan:gas_stations:20260615",
  dgbas_county_transport_supply_10935: "dgbas:county_transport_supply:2023-2024",
  jp_water_ksj: "mlit:ksj_water:inspected-20260918",
  network_performance_grid: "ookla:network_performance:2026q1",
  all_venues: "sports:all_venues:20260704",
  segis_taipei_bicycle_usage_township_110: "segis:3792EA_1D2:2021",
  schools: "moe:schools:113-academic-year",
};
Object.assign(VERIFIED_RAW_FAMILIES, {
  "taiwan:gas_stations:20260615": {
    sourceArtifact: "taipei-gis-analytics/data/raw/energy/gas_stations/", evidence: ["taipei-gis-analytics/data/processed/energy/gas_stations/_manifest.json", "taipei-gis-analytics/docs/data-catalog/energy/gas_stations.md"],
    sourceVersion: "20260615", publisher: "台灣中油與臺中市政府 data.gov.tw sources", license: "OGDL-Taiwan-1.0",
    observedAt: null, acquiredAt: null, acquiredAtAvailability: "not recorded in inspected manifest/catalog",
    coverageAndMissingness: "660 government source records deduplicated to 573 coordinate-valid Point features; not a full national all-brand census.", geometry: "Point, EPSG:4326; records lacking coordinates are omitted.", sourceSha256: null,
  },
  "dgbas:county_transport_supply:2023-2024": {
    sourceArtifact: "taipei-gis-analytics/data/raw/transportation/dgbas_county_transport_supply/", evidence: ["taipei-gis-analytics/data/processed/transportation/dgbas_county_transport_supply/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/dgbas_county_transport_supply_10935.md"],
    sourceVersion: "2023-2024", publisher: "行政院主計總處", license: "政府資料開放授權條款-第1版",
    observedAt: "annual source periods", acquiredAt: null, acquiredAtAvailability: "not recorded in inspected manifest/catalog",
    coverageAndMissingness: "12 immutable releases, six indicators and 22 county values per release; missing is not zero.", geometry: "None; COUNTY_MOI_1140318 is identity reference, not historical native geometry.", sourceSha256: null,
  },
  "mlit:ksj_water:inspected-20260918": {
    sourceArtifact: "taipei-gis-analytics/data/raw/world/jp_water_ksj/receipt.csv", evidence: ["taipei-gis-analytics/data/processed/world/jp_water_ksj/_manifest.json", "taipei-gis-analytics/docs/data-catalog/world/jp_water_ksj.md"],
    sourceVersion: "per W01/W05/W09/P21/P22 shard", publisher: "日本國土數值情報 (MLIT)", license: "W09 commercial candidate; other inspected old terms are non-commercial/re-distribution hold",
    observedAt: "W09 2005; W01 2014; other shards per source file", acquiredAt: null, acquiredAtAvailability: "receipt.csv has per-file retrieval time; no single family acquisition time",
    coverageAndMissingness: "47 W05 shards; 286,437 stream records include 1 null geometry and 15 invalid non-null geometries retained locally; source roles remain separate.", geometry: "mixed/Point/Polygon by source; geometry_role retained.", sourceSha256: null,
  },
  "ookla:network_performance:2026q1": {
    sourceArtifact: ["taipei-gis-analytics/data/raw/infrastructure/network_performance_grid/2026Q1_fixed_tiles.parquet", "taipei-gis-analytics/data/raw/infrastructure/network_performance_grid/2026Q1_mobile_tiles.parquet"], evidence: ["taipei-gis-analytics/data/processed/infrastructure/network_performance_grid/_manifest.json", "taipei-gis-analytics/docs/data-catalog/infrastructure/network_performance_grid.md"],
    sourceVersion: "2026-Q1", publisher: "Ookla Open Data", license: "CC BY-NC-SA 4.0",
    observedAt: "2026-Q1", acquiredAt: "2026-08-25T12:00:00Z",
    acquiredAtAvailability: "recorded in catalog", coverageAndMissingness: "measured tests only; empty cells are not coverage absence and Taiwan bbox includes Fujian coast cells.", geometry: "Web Mercator source z16 tiles aggregated to EPSG:4326 Polygon grids.", sourceSha256: null,
  },
  "sports:all_venues:20260704": {
    sourceArtifact: "taipei-gis-analytics/data/raw/sports/all_venues/22849_all_venues_20260704.csv", evidence: ["taipei-gis-analytics/docs/data-catalog/sports/all_venues.md", "taipei-gis-analytics/data/processed/sports/all_venues/_manifest.json"],
    sourceVersion: "20260704", publisher: "運動部", license: "OGDL-Taiwan-1.0",
    observedAt: "current snapshot", acquiredAt: null, acquiredAtAvailability: "not recorded in inspected manifest/catalog",
    coverageAndMissingness: "15,001 raw rows; one bad coordinate excluded, 15,000 Point features across 22 counties.", geometry: "Point, EPSG:4326.", sourceSha256: null,
  },
  "segis:3792EA_1D2:2021": {
    sourceArtifact: "taipei-gis-analytics/data/raw/transportation/segis_taipei_bicycle_usage_township_110/", evidence: ["taipei-gis-analytics/data/processed/transportation/segis_taipei_bicycle_usage_township_110/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/segis_taipei_bicycle_usage_township_110.md"],
    sourceVersion: "ROC 110 (2021)", publisher: "臺北市政府主計處 via SEGIS", license: "not recorded in inspected manifest/catalog",
    observedAt: "2021", acquiredAt: "2026-09-06T16:04:52Z", acquiredAtAvailability: "recorded in catalog",
    coverageAndMissingness: "12 Taipei townships, five retained fields; C2/C4 all-zero questionable fields and C8 ratio excluded, Taipei-external areas out of coverage.", geometry: "None; township_reference_20260626_v1 used for identity only.", sourceSha256: "ad18a1819e69e53a070b63def2d49cdd633fad5e8aaff16eb165bd3baee2dd68",
  },
  "moe:schools:113-academic-year": {
    sourceArtifact: "taipei-gis-analytics/data/raw/education/schools/113學年度各級學校名錄(含經緯度) 20250814.xlsx", evidence: ["taipei-gis-analytics/docs/data-catalog/education/schools.md", "taipei-gis-analytics/data/processed/education/schools/_manifest.json"],
    sourceVersion: "113 academic year / 20250814 export", publisher: "教育部統計處 EduGis", license: "unverified; do not assume OGDL",
    observedAt: "113 academic year", acquiredAt: null, acquiredAtAvailability: "not recorded in inspected manifest/catalog",
    coverageAndMissingness: "4,315 raw and processed rows, direct mapping; historic iChef output had 4,268 filtered rows and is not equivalent.", geometry: "Point from source longitude/latitude; invalid/missing geometry rates not recorded in inspected manifest.", sourceSha256: null,
  },
});
const INSPECTED_UPSTREAM_DATASETS = {
  celestrak_satellites: { status: "EVIDENCE_GAP", reason: "catalog describes live TLE feed, but no immutable raw snapshot/release receipt was found in this pass" },
  land_use_township_statistics: { status: "EVIDENCE_GAP", reason: "processed manifest exists but this checkout has no immutable raw/release receipt and no recorded license" },
  education_county_statistics: { status: "EVIDENCE_GAP", reason: "processed releases exist but the claimed raw receipt directory is absent from this checkout" },
  waste_facilities: { status: "EVIDENCE_GAP", reason: "catalog states processed 66-row file may be out of sync with Supabase; no authoritative same-version receipt" },
  gas_stations: { status: "VERIFIED_RAW_LINEAGE", familyKey: "taiwan:gas_stations:20260615" },
  livestock_farms: { status: "EVIDENCE_GAP", reason: "mixed ARIS/NLSC/EMS/Google geometry provenance and no inspected processed manifest/immutable receipt in this pass" },
  dgbas_county_transport_supply_10935: { status: "VERIFIED_RAW_LINEAGE", familyKey: "dgbas:county_transport_supply:2023-2024" },
  jp_medical_reports: { status: "EVIDENCE_GAP", reason: "no analytics catalog/processed manifest found in this pass" },
  jp_water_ksj: { status: "RIGHTS_HOLD", familyKey: "mlit:ksj_water:inspected-20260918", reason: "only W09 is a commercial/public candidate; other source shards retain non-commercial/re-distribution holds" },
  osm_power: { status: "EVIDENCE_GAP", reason: "catalog found but no inspected immutable raw/release receipt in this pass" },
  pollution_source: { status: "EVIDENCE_GAP", reason: "catalog staging path exists but no inspected immutable raw/release receipt in this pass" },
  real_estate: { status: "EVIDENCE_GAP", reason: "multiple partial quarterly sources; no single release identity maps this generic dataset ID" },
  schools: { status: "RIGHTS_HOLD", familyKey: "moe:schools:113-academic-year", reason: "raw lineage is verified but catalog explicitly leaves EduGis license unconfirmed" },
  all_venues: { status: "VERIFIED_RAW_LINEAGE", familyKey: "sports:all_venues:20260704" },
  jp_medical_navii: { status: "EVIDENCE_GAP", reason: "no analytics catalog/processed manifest found in this pass" },
  ncdr_alerts: { status: "EVIDENCE_GAP", reason: "realtime DB collector has no bounded immutable raw/release receipt" },
  segis_taipei_bicycle_usage_township_110: { status: "RIGHTS_HOLD", familyKey: "segis:3792EA_1D2:2021", reason: "raw lineage/version is verified but inspected catalog/manifest does not record a license" },
  crop_township_statistics: { status: "EVIDENCE_GAP", reason: "catalog names a per-page raw receipt, but it is absent from this checkout" },
  network_performance_grid: { status: "RIGHTS_HOLD", familyKey: "ookla:network_performance:2026q1", reason: "raw lineage is verified but CC BY-NC-SA 4.0 requires non-commercial/attribution clearance" },
  network_structures: { status: "EVIDENCE_GAP", reason: "processed bundle mixes distinct Geofabrik OSM PBF, NTPC official CSV, and NLSC boundary inputs; no single raw-family receipt is present in this checkout" },
};

function options(argv) {
  let date = DEFAULT_AUDIT_DATE;
  let outputBase = null;
  let familyLedgerBase = null;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === "--date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) throw new Error("INVALID_AUDIT_DATE");
      date = value;
      index += 1;
    } else if (option === "--output-base") {
      if (!value) throw new Error("MISSING_OUTPUT_BASE");
      outputBase = value;
      index += 1;
    } else if (option === "--family-ledger-base") {
      if (!value) throw new Error("MISSING_FAMILY_LEDGER_BASE");
      familyLedgerBase = value;
      index += 1;
    } else if (option === "--help") {
      console.log("Usage: npx vite-node --script scripts/research/capability-audit.mjs [--date YYYY-MM-DD] [--output-base path-without-extension] [--family-ledger-base path-without-extension]");
      process.exit(0);
    } else {
      throw new Error(`UNKNOWN_OPTION:${option}`);
    }
  }
  return {
    date,
    outputBase: resolve(root, outputBase ?? DEFAULT_OUTPUT_BASE),
    familyLedgerBase: familyLedgerBase === null ? null : resolve(root, familyLedgerBase),
  };
}

const auditOptions = options(process.argv.slice(2));
const outputBase = auditOptions.outputBase;

function sourceKinds(source) {
  return [...new Set((Array.isArray(source) ? source : [source]).map(item => item.kind))].sort();
}

function declaredAssets(source) {
  return (Array.isArray(source) ? source : [source]).flatMap(item => {
    if (item.kind === "custom") return (item.staticAssets ?? []).map(path => ({ kind: item.kind, path }));
    if (item.kind === "supabase") return item.fallbackUrl ? [{ kind: item.kind, path: item.fallbackUrl }] : [];
    return [{ kind: item.kind, path: item.url }];
  });
}

function descriptorSummary(descriptor) {
  return {
    datasetId: descriptor.datasetId,
    layerRefs: [...descriptor.layerRefs],
    kind: descriptor.kind,
    recordGrain: descriptor.recordGrain,
    adapterId: descriptor.adapterId,
    access: {
      mode: descriptor.access.mode,
      method: descriptor.access.method,
      queryEnabled: descriptor.access.query.enabled,
      requiredParameters: (descriptor.parameters ?? []).filter(item => item.required).map(item => item.name).sort(),
    },
    geometry: {
      type: descriptor.geometry.type,
      role: descriptor.geometry.role,
      spatialAnalysisEligible: descriptor.geometry.spatialAnalysisEligible,
    },
    supportedOperations: [...descriptor.supportedOperations].sort(),
    versions: descriptor.versions.length,
  };
}

function manifestSourceContract(source) {
  return (Array.isArray(source) ? source : [source]).map(item => ({
    kind: item.kind,
    sourceId: item.sourceId ?? null,
    declaredAssets: item.kind === "custom"
      ? [...(item.staticAssets ?? [])]
      : [item.kind === "supabase" ? item.fallbackUrl : item.url].filter(Boolean),
  }));
}

function layerCapability(key) {
  const entry = LAYER_MANIFEST[key];
  const descriptors = registeredDatasetsForLayer(key);
  const queryable = descriptors.filter(item => item.access.query.enabled);
  const analyzable = descriptors.filter(item => item.access.query.enabled && item.supportedOperations.length > 0);
  const onDemandGeojson = descriptors.length === 0 && describeRegisteredLayer(key) !== null;
  const analysisPath = queryable.length > 0 ? "registered_adapter" : onDemandGeojson ? "bounded_geojson_point_readback" : "source_family_contract_required";
  return {
    layerKey: key,
    label: entry.section === null ? key : entry.label,
    dataClass: entry.dataClass,
    sourceKinds: sourceKinds(entry.source),
    declaredAssets: declaredAssets(entry.source),
    manifestSourceContract: manifestSourceContract(entry.source),
    upstream: entry.upstream === undefined ? null : {
      status: entry.upstream.status,
      datasetIds: (entry.upstream.datasets ?? []).map(item => item.datasetId).sort(),
      processing: entry.upstream.processing ?? null,
      note: entry.upstream.note ?? null,
    },
    analysisPath,
    blocker: queryable.length > 0 ? null : onDemandGeojson ? "SOURCE_READBACK_AND_POINT_SEMANTICS_UNVERIFIED" : descriptors.length > 0 ? "QUERY_ACCESS_DISABLED" : "NO_QUERY_DESCRIPTOR_OR_READER",
    discoverable: true,
    datasetIds: descriptors.map(item => item.datasetId).sort(),
    readable: queryable.length > 0 ? "registered" : onDemandGeojson ? "metadata_candidate_requires_readback" : "unknown_or_unavailable",
    analyzable: analyzable.length > 0 ? "registered_operations" : onDemandGeojson ? "metadata_candidate_requires_readback" : "unknown_or_unavailable",
    descriptors: descriptors.map(descriptorSummary),
    geometryKinds: [...new Set(descriptors.map(item => item.geometry.type))].sort(),
    geometryRoles: [...new Set(descriptors.map(item => item.geometry.role))].sort(),
    spatialAnalysisEligibleDatasetIds: descriptors.filter(item => item.geometry.spatialAnalysisEligible).map(item => item.datasetId).sort(),
    evidenceBasis: descriptors.length > 0 ? "researchDatasets runtime registry" : onDemandGeojson ? "registeredLayerReader path candidate only; not hydrated and geometry not verified" : "manifest only; no reader descriptor",
  };
}

const layers = MANIFEST_KEYS.map(layerCapability).sort((a, b) => a.layerKey.localeCompare(b.layerKey));
const sourceKindLayerCounts = Object.fromEntries(
  ["custom", "geojson", "pmtiles", "supabase"].map(kind => [kind, layers.filter(layer => layer.sourceKinds.includes(kind)).length]),
);
const sourceKindAssignments = Object.values(sourceKindLayerCounts).reduce((total, count) => total + count, 0);
const independentDatasets = RESEARCH_QUERY_EXECUTOR.descriptors().filter(item => item.layerRefs.length === 0).map(descriptorSummary);
const datasets = [...new Map([...layers.flatMap(item => item.descriptors), ...independentDatasets].map(item => [item.datasetId, item])).values()]
  .sort((a, b) => a.datasetId.localeCompare(b.datasetId));
const byKind = Object.fromEntries(["point", "line", "polygon", "grid", "event", "admin_statistic", "unknown"].map(kind => {
  const rows = layers.filter(layer => {
    if (kind === "unknown") return layer.descriptors.length === 0;
    return layer.descriptors.some(descriptor => descriptor.kind === kind);
  });
  return [kind, {
    manifestLayerCount: rows.length,
    registeredDatasetCount: datasets.filter(dataset => dataset.kind === kind).length,
    independentDatasetIds: datasets.filter(dataset => dataset.kind === kind && dataset.layerRefs.length === 0).map(dataset => dataset.datasetId),
    layerKeys: rows.map(row => row.layerKey),
  }];
}));
const datasetsByKind = kind => datasets.filter(dataset => dataset.kind === kind);
const standalonePopulation = datasets.filter(dataset => /(^|[:_])(population|resident_population|registered_population)([:_]|$)/i.test(dataset.datasetId));
const support = {
  point: { status: datasetsByKind("point").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("point").length} registered point dataset(s); manifest layers without descriptors remain unknown; metadata-only GeoJSON candidates require source readback.` },
  line: { status: datasetsByKind("line").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("line").length} registered line dataset(s) in the runtime registry; display line geometry alone is not proof of readable or analyzable geometry.` },
  polygon: { status: datasetsByKind("polygon").length > 0 || datasetsByKind("admin_statistic").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("polygon").length} polygon and ${datasetsByKind("admin_statistic").length} admin-statistic dataset(s) are registered; display PMTiles/custom polygons without descriptors remain unknown.` },
  grid: { status: datasetsByKind("grid").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("grid").length} registered grid dataset(s); independent datasets are not one-to-one with manifest layers, and generalized/occupied-only semantics remain explicit.` },
  event: { status: datasetsByKind("event").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("event").length} registered event dataset(s); event parameters and geometry role come from descriptors, not display layers.` },
  population: { status: standalonePopulation.length > 0 ? "candidate" : "gap_or_unknown", evidence: standalonePopulation.length > 0 ? `Standalone population candidates: ${standalonePopulation.map(dataset => dataset.datasetId).join(", ")}. Verify denominator contract before use.` : "No descriptor currently matches a standalone population dataset identity; population-derived indicators are not an independent denominator." },
};
const report = {
  schemaVersion: `pulse-research-capability-audit/${auditOptions.date}`,
  auditDate: auditOptions.date,
  generatedBy: "scripts/research/capability-audit.mjs",
  evidence: {
    manifest: "src/data/layerManifest.ts:LAYER_MANIFEST/MANIFEST_KEYS",
    datasetRegistry: "src/research/researchDatasets.ts:RESEARCH_QUERY_EXECUTOR/registeredDatasetsForLayer",
    lazyReader: "src/research/registeredLayerReader.ts:readRegisteredLayer",
    descriptorContract: "src/research/dataContracts.ts:DatasetDescriptor",
    note: "No source assets are fetched; this audit reports runtime registration and declared contracts only.",
  },
  counts: {
    manifestLayers: layers.length,
    registeredDatasets: datasets.length,
    layersWithRegisteredDatasets: layers.filter(item => item.descriptors.length > 0).length,
    layersWithQueryableDatasets: layers.filter(item => item.readable === "registered").length,
    layersWithRegisteredOperations: layers.filter(item => item.analyzable === "registered_operations").length,
    lazyGeojsonCandidates: layers.filter(item => item.readable === "metadata_candidate_requires_readback").length,
    layersWithoutDescriptor: layers.filter(item => item.descriptors.length === 0).length,
    layersWithDescriptorsButNotQueryable: layers.filter(item => item.descriptors.length > 0 && item.readable !== "registered").length,
    layersUnknownOrUnavailable: layers.filter(item => item.readable === "unknown_or_unavailable").length,
    sourceKindLayerCounts,
    sourceKindAssignments,
  },
  support,
  byKind,
  datasets,
  layers,
};

function explicitRightsHold(layer) {
  const text = [layer.upstream?.status, layer.upstream?.processing, layer.upstream?.note]
    .filter(Boolean)
    .join(" ");
  return /(?:NON_COMMERCIAL|LICENSE_UNVERIFIED|HOLD_LICENSE|RIGHTS_HOLD|owner-only)/i.test(text);
}

function familyEvidence(layer) {
  const contracts = layer.manifestSourceContract;
  const hasRuntimeOnlySource = contracts.some(item => item.kind === "supabase");
  const assets = contracts.flatMap(item => item.declaredAssets.map(path => ({ kind: item.kind, path })))
    .filter(item => item.path.startsWith("./"))
    .sort((a, b) => `${a.kind}:${a.path}`.localeCompare(`${b.kind}:${b.path}`));
  if (hasRuntimeOnlySource || assets.length === 0) {
    return {
      familyKey: `unresolved:no-declared-artifact:${layer.layerKey}`,
      sourceArtifact: null,
      evidence: hasRuntimeOnlySource
        ? "manifest supplies only a Supabase loader fallback; it names neither the bounded RPC nor an immutable raw/release receipt"
        : "manifest has no concrete asset, RPC name, or immutable release receipt for this layer",
    };
  }
  const sourceIds = contracts.map(item => item.sourceId).filter(Boolean).sort();
  const assetKey = assets.map(item => `${item.kind}:${item.path}`).join("|");
  return {
    familyKey: `manifest-asset:${assetKey}`,
    sourceArtifact: assets,
    evidence: `exact manifest asset declaration${sourceIds.length > 0 ? `; sourceId ${sourceIds.join(", ")}` : ""}; this is display-contract evidence, not a raw-table or release receipt`,
  };
}

function p0Blocker(layer, family) {
  if (layer.readable === "metadata_candidate_requires_readback") return {
    status: "READER_PENDING",
    primaryBlocker: "SOURCE_READBACK_AND_POINT_SEMANTICS_UNVERIFIED",
    nextStep: "Read the declared GeoJSON once; record SHA, publisher/license, observed/obtained time, schema nulls, and geometry before deciding reader eligibility.",
  };
  if (layer.blocker === "QUERY_ACCESS_DISABLED") return {
    status: "READER_PENDING",
    primaryBlocker: "QUERY_ACCESS_DISABLED",
    nextStep: "Locate the owning descriptor contract and its source/release receipt; enable only after bounded access and geometry semantics are verified.",
  };
  if (explicitRightsHold(layer)) return {
    status: "RIGHTS_HOLD",
    primaryBlocker: "RIGHTS_OR_USE_CLEARANCE_UNVERIFIED",
    nextStep: "Obtain publisher license/use clearance and an immutable raw-artifact or release receipt before reader work.",
  };
  if (family.sourceArtifact === null) return {
    status: "SOURCE_MISSING",
    primaryBlocker: "NO_DECLARED_RAW_ARTIFACT_OR_RPC_RECEIPT",
    nextStep: "Find the owning raw artifact/RPC and its version, license, freshness, null policy, and geometry contract; keep this layer ungrouped until then.",
  };
  return {
    status: "READER_PENDING",
    primaryBlocker: "DECLARED_DISPLAY_ASSET_NOT_VERIFIED_AS_COMPLETE_RAW_SOURCE",
    nextStep: "Match this declared display asset to a versioned raw artifact or bounded RPC; verify license, observed/obtained time, nulls, coverage, and geometry before creating a shared reader.",
  };
}

function p0FamilyLedger() {
  const candidates = layers.filter(layer => layer.readable === "unknown_or_unavailable" || layer.readable === "metadata_candidate_requires_readback");
  const entries = candidates.map(layer => {
    const family = familyEvidence(layer);
    const datasetInspections = (layer.upstream?.datasetIds ?? []).map(datasetId => ({ datasetId, ...(INSPECTED_UPSTREAM_DATASETS[datasetId] ?? { status: "NOT_INSPECTED" }) }));
    const datasetFamilyKeys = [...new Set(datasetInspections.map(item => item.familyKey).filter(Boolean))];
    const verifiedRawFamilyKey = VERIFIED_RAW_FAMILY_BY_LAYER[layer.layerKey] ?? (datasetFamilyKeys.length === 1 ? datasetFamilyKeys[0] : null);
    const alignment = DISPLAY_RAW_ALIGNMENT_BY_LAYER[layer.layerKey] ?? null;
    const defaultBlocker = p0Blocker(layer, family);
    const inspectionRightsHold = datasetInspections.some(item => item.status === "RIGHTS_HOLD");
    const blocker = inspectionRightsHold
      ? {
        status: "RIGHTS_HOLD",
        primaryBlocker: "SOURCE_LICENSE_OR_USE_CLEARANCE_HOLD",
        nextStep: "Retain raw lineage but obtain the stated use/license clearance before reader or public-release work.",
      }
      : alignment?.status === "DISPLAY_ARTIFACT_RECEIPT_MISSING"
      ? {
        status: "VERSION_MISMATCH",
        primaryBlocker: "DISPLAY_TO_VERIFIED_RAW_RELEASE_ALIGNMENT_MISSING",
        nextStep: "Record a matching immutable receipt (SHA/version) from the mini display asset to the verified local raw lineage before reader work.",
      }
      : alignment?.status === "LOCAL_RAW_TO_DISPLAY_PROVEN"
        ? {
          status: "READER_PENDING",
          primaryBlocker: "READER_AND_RUNTIME_RELEASE_RECEIPT_MISSING",
          nextStep: "Use the proven local raw/display version to build the bounded line reader, then read the runtime release receipt before calling it spatial-ready.",
        }
        : alignment?.status === "LINEAGE_VERIFIED_LOCAL_RELEASE"
          ? {
            status: "READER_PENDING",
            primaryBlocker: "READER_AND_RUNTIME_RELEASE_RECEIPT_MISSING",
            nextStep: "Use the verified local raw lineage to build the bounded reader; verify the runtime release receipt before calling this spatial-ready.",
          }
          : verifiedRawFamilyKey !== null
            ? {
              status: "VERSION_MISMATCH",
              primaryBlocker: "DISPLAY_TO_VERIFIED_RAW_RELEASE_ALIGNMENT_NOT_INSPECTED",
              nextStep: "Read a matching immutable receipt for this display asset before reader work; verified raw lineage alone does not prove its mini display version.",
            }
      : defaultBlocker;
    return {
      layerKey: layer.layerKey,
      label: layer.label,
      candidateClass: layer.readable === "metadata_candidate_requires_readback" ? "metadata_geojson_candidate" : "unknown_or_unavailable",
      familyKey: family.familyKey,
      sourceArtifact: family.sourceArtifact,
      sourceEvidence: family.evidence,
      verifiedRawFamilyKey,
      displayRawAlignment: alignment,
      upstreamDatasetInspections: datasetInspections,
      upstream: layer.upstream,
      geometry: {
        declared: layer.geometryKinds.length > 0 ? layer.geometryKinds : null,
        role: layer.geometryRoles.length > 0 ? layer.geometryRoles : null,
        verification: "unverified from source payload",
      },
      status: blocker.status,
      primaryBlocker: blocker.primaryBlocker,
      nextStep: blocker.nextStep,
    };
  });
  const familyCounts = new Map();
  for (const entry of entries) familyCounts.set(entry.familyKey, (familyCounts.get(entry.familyKey) ?? 0) + 1);
  const verifiedRawFamilyKeys = [...new Set(entries.map(entry => entry.verifiedRawFamilyKey).filter(Boolean))].sort();
  const inspectedDatasetEntries = Object.entries(INSPECTED_UPSTREAM_DATASETS).sort(([a], [b]) => a.localeCompare(b));
  const csvQueueSampleLayerKeys = [
    "a1AccidentRealtime", "agriCropSuitability", "agriculture", "agriLeisureFarmZones", "agriProduceWholesale",
    "agriRetail", "agriRuralRegen", "agriSoil", "agriSoilFertility", "airports",
  ];
  const csvQueueSamples = csvQueueSampleLayerKeys.map(layerKey => {
    const entry = entries.find(item => item.layerKey === layerKey);
    if (entry === undefined) throw new Error(`P0_CSV_SAMPLE_MISSING:${layerKey}`);
    return {
      layerKey,
      familyKey: entry.familyKey,
      verifiedRawFamilyKey: entry.verifiedRawFamilyKey,
      primaryBlocker: entry.primaryBlocker,
      sourceArtifact: entry.sourceArtifact,
    };
  });
  return {
    schemaVersion: `pulse-research-p0-source-family-ledger/${auditOptions.date}`,
    auditDate: auditOptions.date,
    generatedBy: "scripts/research/capability-audit.mjs",
    evidenceBoundary: "familyKey groups only exact manifest-declared display asset tuples. verifiedRawFamilyKey is separate and appears only for analytics lineage inspected in this P0 slice; it does not prove mini display-asset version alignment, remote release presence, or analysis eligibility.",
    counts: {
      candidateLayers: entries.length,
      unknownOrUnavailable: entries.filter(item => item.candidateClass === "unknown_or_unavailable").length,
      metadataGeojsonCandidates: entries.filter(item => item.candidateClass === "metadata_geojson_candidate").length,
      sourceFamilyKeys: familyCounts.size,
      sharedSourceFamilyKeys: [...familyCounts.values()].filter(count => count > 1).length,
      singletonOrUnresolvedFamilyKeys: [...familyCounts.values()].filter(count => count === 1).length,
      verifiedRawFamilyKeys: verifiedRawFamilyKeys.length,
      entriesWithVerifiedRawFamily: entries.filter(entry => entry.verifiedRawFamilyKey !== null).length,
      entriesWithoutVerifiedRawFamily: entries.filter(entry => entry.verifiedRawFamilyKey === null).length,
      inspectedUpstreamDatasetIds: inspectedDatasetEntries.length,
      inspectedUpstreamDatasetEvidenceGaps: inspectedDatasetEntries.filter(([, item]) => item.status === "EVIDENCE_GAP").length,
    },
    families: [...familyCounts.entries()].map(([familyKey, layerCount]) => ({ familyKey, layerCount })).sort((a, b) => a.familyKey.localeCompare(b.familyKey)),
    verifiedRawFamilies: Object.fromEntries(verifiedRawFamilyKeys.map(key => [key, VERIFIED_RAW_FAMILIES[key]])),
    inspectedUpstreamDatasets: Object.fromEntries(inspectedDatasetEntries),
    csvQueueSamples,
    entries,
  };
}

function markdown() {
  const c = report.counts;
  const lines = [
    `# General analysis capability audit (${auditOptions.date})`,
    "",
    "Generated by scripts/research/capability-audit.mjs from runtime manifest and research dataset registry. No source assets were fetched; this is registration/contract evidence, not payload health or production acceptance.",
    "",
    `- Manifest layers: **${c.manifestLayers}**; registered research datasets: **${c.registeredDatasets}**.`,
    `- Layers with registered dataset descriptors: **${c.layersWithRegisteredDatasets}**; queryable: **${c.layersWithQueryableDatasets}**; with declared operations: **${c.layersWithRegisteredOperations}**.`,
    `- Lazy single GeoJSON candidates: **${c.lazyGeojsonCandidates}**; unknown or unavailable: **${c.layersUnknownOrUnavailable}**; layers with no descriptor: **${c.layersWithoutDescriptor}**; descriptors without query access: **${c.layersWithDescriptorsButNotQueryable}**.`,
    "",
    "此快照為程式預設 registry，不含 DEV runtime 注入的本地人口 preview；配對瀏覽器實測與本地預覽另列驗收證據。",
    "",
    "## Evidence boundaries",
    "",
    "Discoverable means a key exists in `LAYER_MANIFEST`; readable means a registered descriptor declares query access. A single GeoJSON path is only a metadata candidate until source readback verifies bytes, schema and geometry. An adapter may serve multiple layers, and a layer may map to multiple datasets. Analyzable is based only on declared descriptor operations and geometry eligibility; rendered points, lines, polygons, PMTiles, or source counts do not establish runtime support. Metadata registration is not runtime success, payload health, source freshness, coverage, or production acceptance.",
    "",
    "## Manifest source families (per-layer deduplicated)",
    "",
    `- custom: **${c.sourceKindLayerCounts.custom}**; geojson: **${c.sourceKindLayerCounts.geojson}**; pmtiles: **${c.sourceKindLayerCounts.pmtiles}**; supabase: **${c.sourceKindLayerCounts.supabase}**.`,
    `- These are source-family assignments, not independent datasets: **${c.sourceKindAssignments}** assignments across **${c.manifestLayers}** layers because a mixed-source layer is counted once in each applicable family.`,
    "",
    "## Geometry and thematic support",
    "",
  ];
  for (const [kind, item] of Object.entries(support)) lines.push(`- **${kind}** — ${item.status}: ${item.evidence}`);
  lines.push("", "## Registry counts by dataset kind", "", "| kind | manifest layers | registered datasets |", "|---|---:|---:|");
  for (const kind of ["point", "line", "polygon", "grid", "event", "admin_statistic", "unknown"]) {
    const item = report.byKind[kind];
    lines.push(`| ${kind} | ${item.manifestLayerCount} | ${item.registeredDatasetCount} |`);
  }
  lines.push("", "## Registered dataset mappings", "", "| dataset | kind | adapter | layers | geometry | operations |", "|---|---|---|---|---|---|");
  for (const item of datasets) lines.push(`| ${item.datasetId} | ${item.kind} | ${item.adapterId} | ${item.layerRefs.join(", ") || "(independent)"} | ${item.geometry.type}/${item.geometry.role}/${item.geometry.spatialAnalysisEligible ? "eligible" : "ineligible"} | ${item.supportedOperations.join(", ") || "(none)"} |`);
  lines.push("", "## Gaps retained as unknown", "", `- ${support.population.evidence}`, `- ${support.line.evidence}`, "- PMTiles/custom/polygon display registration does not imply complete-source record access.", "- The schools grid is an independent occupied-only research dataset and is not a one-to-one layer mapping; omitted cells are not observed zero.", "- News events have a date/filter adapter and proxy township-cluster points; this does not establish exact event geometry or live freshness for all event layers.", "", "Re-run the legacy snapshot: `npx vite-node --script scripts/research/capability-audit.mjs`.", `Re-run this dated snapshot: \`npx vite-node --script scripts/research/capability-audit.mjs --date ${auditOptions.date} --output-base ${outputBase.replace(`${root}/`, "")}\`.`, "");
  return lines.join("\n");
}

await mkdir(dirname(outputBase), { recursive: true });
await writeFile(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(`${outputBase}.md`, markdown());
const outputs = [`${outputBase}.json`, `${outputBase}.md`];
let ledgerCounts = null;
if (auditOptions.familyLedgerBase !== null) {
  const ledger = p0FamilyLedger();
  await mkdir(dirname(auditOptions.familyLedgerBase), { recursive: true });
  await writeFile(`${auditOptions.familyLedgerBase}.json`, `${JSON.stringify(ledger, null, 2)}\n`);
  outputs.push(`${auditOptions.familyLedgerBase}.json`);
  ledgerCounts = ledger.counts;
}
console.log(JSON.stringify({ output: outputs, counts: report.counts, familyLedgerCounts: ledgerCounts }, null, 2));
