#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";
import { RESEARCH_QUERY_EXECUTOR, registeredDatasetsForLayer } from "../../src/research/researchDatasets.ts";
import { describeRegisteredLayer } from "../../src/research/registeredLayerReader.ts";
import { COMPARISON_ENABLED_RECIPES } from "../../src/data/comparisonStatisticsRecipes.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const worktreeMarker = `${sep}.worktrees${sep}`;
const originalCheckoutRoot = root.includes(worktreeMarker) ? root.slice(0, root.indexOf(worktreeMarker)) : null;
const analyticsRoot = resolve(originalCheckoutRoot ?? root, "../taipei-gis-analytics");
const comparisonRecipeByLayer = new Map(COMPARISON_ENABLED_RECIPES.map(recipe => [recipe.layer_key, recipe]));

function walkFiles(start) {
  if (!existsSync(start)) return [];
  const files = [];
  const pending = [start];
  while (pending.length > 0) {
    const dir = pending.pop();
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, item.name);
      if (item.isDirectory()) pending.push(path);
      else if (item.isFile()) files.push(path);
    }
  }
  return files;
}

const analyticsProcessedManifests = new Map();
for (const path of walkFiles(resolve(analyticsRoot, "data/processed")).filter(path => basename(path) === "_manifest.json")) {
  try {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (typeof manifest.dataset_id !== "string" || basename(dirname(path)) !== manifest.dataset_id) continue;
    const list = analyticsProcessedManifests.get(manifest.dataset_id) ?? [];
    list.push({ path: path.slice(analyticsRoot.length + 1), fileCount: Array.isArray(manifest.files) ? manifest.files.length : null,
      filesWithSha256: Array.isArray(manifest.files) ? manifest.files.filter(file => typeof file.sha256 === "string").length : null,
      lifecycle: manifest.lifecycle ?? null, lastUpdated: manifest.last_updated ?? null });
    analyticsProcessedManifests.set(manifest.dataset_id, list);
  } catch { /* An invalid local manifest cannot serve as evidence. */ }
}
const analyticsCatalogDocs = new Map();
for (const path of walkFiles(resolve(analyticsRoot, "docs/data-catalog")).filter(path => path.endsWith(".md"))) {
  const id = basename(path, ".md");
  const list = analyticsCatalogDocs.get(id) ?? [];
  list.push(path.slice(analyticsRoot.length + 1));
  analyticsCatalogDocs.set(id, list);
}

function analyticsNavigation(datasetIds) {
  return datasetIds.map(datasetId => ({ datasetId,
    processedManifests: analyticsProcessedManifests.get(datasetId) ?? [],
    catalogDocs: analyticsCatalogDocs.get(datasetId) ?? [],
    evidenceBoundary: "Exact dataset_id manifest and exact-name catalog navigation only; not an immutable raw input, license, source date, or display-version receipt",
  }));
}

function localDisplayAssetEvidence(sourceArtifact) {
  return (sourceArtifact ?? []).map(item => {
    const relative = item.path.startsWith("./") ? item.path.slice(2) : null;
    if (relative === null || relative.split("/").includes("..")) return { ...item, worktree: null, originalCheckout: null };
    const inspect = base => {
      if (base === null) return null;
      try {
        const info = statSync(resolve(base, "public", relative));
        return info.isFile() ? { exists: true, bytes: info.size } : { exists: false, bytes: null };
      } catch { return { exists: false, bytes: null }; }
    };
    return { ...item, worktree: inspect(root), originalCheckout: inspect(originalCheckoutRoot) };
  });
}
const DEFAULT_AUDIT_DATE = "2026-09-23";
const DEFAULT_OUTPUT_BASE = "docs/features/general-analysis/capability-audit-20260923";
const VERIFIED_RAW_FAMILIES = {
  "business_registry:company_stock:202608": {
    sourceArtifact: "taipei-gis-analytics/data/processed/business_registry/company_stock/company_stock_202608.csv",
    sourceArtifactRole: "canonical processed assembly; upstream raw is a 118-file regional CSV matrix, not one company_stock raw CSV",
    evidence: [
      "taipei-gis-analytics/data/processed/business_registry/company_points/company_points_202608_r2_qa.json",
      "taipei-gis-analytics/data/processed/business_registry/company_capital_grid/company_capital_grid_202608_r2_qa.json",
      "taipei-gis-analytics/data/processed/business_registry/company_demographics_grid/company_demographics_grid_202608_metadata.json",
      "mini:scripts/research/build-company-demographics-owner-only.mjs",
      "taipei-gis-analytics/data/processed/business_registry/manufacturing_company_points/manufacturing_company_points_202608_r2_qa.json",
    ],
    sourceVersion: "202608",
    publisher: "經濟部商業發展署 GCIS",
    license: "Processed source records OGDL-Taiwan-1.0; 118-member upstream matrix rights remain RIGHTS_HOLD for public redistribution, owner-only queries",
    observedAt: "2026-08 snapshot",
    acquiredAt: null,
    acquiredAtAvailability: "not recorded in the inspected QA receipts; 2026-08-18 is processed release date, not asserted raw acquisition time",
    coverageAndMissingness: "657,882 source rows; 1,152 dead_or_abnormal and 2,565 invalid-coordinate rows excluded; 654,165 published. capital_total missing 2,435; setup_year missing 16. Manufacturing exact-C: 186,054 source, 1,110 invalid-coordinate, 184,944 published.",
    geometry: "company_points is EPSG:4326 Point; company_capital_grid has bounded occupied-only Polygon readers at 150m/450m/1500m; company_demographics_grid has bounded occupied-only Polygon readers at 450m/1500m for industry and age; manufacturing is an exact-C filter over company_points. Grid cells are not company premises or county areas.",
    sourceSha256: "c3a191b234e718dc7b5ca4a9b5c599c279b1fefc9e2d1d606e5722c3eb4e900c",
    localDisplayReceipt: "Demographics 450m source SHA 9f97d9d0e6747af17493109a43c1c42a64bae55c47b90e519ad8045c0c2918cd; 1500m source SHA cc71991553954c95085476508c3ec64c989f47d195b2bccc25ed084bdd33b429. Owner-only manifests 7fe4ed971dd4a7bcc34ce6954567a260459e5f74b5fe366fc6d2370f5276b071 and b67714c49531774daad010a490fc05e6368cf4ea3af5c5c8e70db06f69d8d4b6. Public same-version release HOLD.",
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
VERIFIED_RAW_FAMILIES["moenv:pollution_sites:EMS_S_07:20260706"] = {
  sourceArtifact: "taipei-gis-analytics/docs/topic-research/water-drinking-source/data-staged/processed/soil_gw_pollution_sites_20260704.geojson",
  evidence: ["taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_sites_20260706.geojsonseq", "taipei-gis-analytics/docs/data-catalog/environment/pollution_source.md"],
  sourceVersion: "EMS_S_07 / frontend 20260706", publisher: "環境部環境資料開放平臺", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "No source observation or acquisition timestamp in inspected receipt; 20260706 is fixed processing snapshot.",
  coverageAndMissingness: "8,253 distinct site IDs and valid Points; 365 active at snapshot, 7,888 deannounced. Staged sitearea decimals restored for 1,568 rows truncated in frontend contract; no area nulls. Status is historical, not current.",
  geometry: "WGS84 Point reference coordinate, not site boundary or pollution extent; all staged records _geocode=wgs84.",
  sourceSha256: "9139e65862c7206fefcb298e94299e9ed5e28b9b6c072edf1fd83a9a628bd394",
  localDisplayReceipt: "Original-mini and analytics 20260706 pollution_sites.pmtiles bytes match at SHA dca3c37cf0a05a85b3c08d96310caa22aca01472b31a55f0a2c22a8992d7f9ba; remote runtime unread. Frontend truncates 1,568 decimal sitearea values, while research query restores staged original numbers.",
};
VERIFIED_RAW_FAMILIES["moenv:pollution_facilities:EMS_S_01:20260706"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_facilities_20260706.geojsonseq",
  evidence: ["taipei-gis-analytics/docs/topic-research/water-drinking-source/data-staged/processed/pollution_potential_20260705.geojson", "taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_frontend_manifest_20260706.json", "taipei-gis-analytics/docs/data-catalog/environment/pollution_source.md"],
  sourceVersion: "EMS_S_01 / frontend 20260706", publisher: "環境部環境資料開放平臺", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Frontend manifest generated 2026-07-07T04:51:39Z; source observation/acquisition timestamp not recorded.",
  coverageAndMissingness: "152,246 unique emsno Point features; 143,743 staged predecessor IDs align, 8,503 frontend-only. sev_* null denotes absent medium flag, not severity zero. Facility registration does not prove pollution or current violation.",
  geometry: "WGS84 reference Point. Per-record geocode precision is not supplied; bounded bbox lookup only, no exact-nearest claim.",
  sourceSha256: "7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9",
  localDisplayReceipt: "Original-mini pollution_facilities.pmtiles and analytics 20260706 output both SHA cec5cda2a0ccff4dcdab829f4719903ffe111728278792bbcd2089282778599b. Remote runtime release not read.",
};
VERIFIED_RAW_FAMILIES["moenv:pollution_penalties:EMS_P_46:20260706"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_penalties_events_20260706.geojsonseq",
  evidence: ["mini:scripts/research/build-pollution-penalty-partitions.py", "mini:../runtime/point-partitions/pollution-penalties/manifest-receipt.json"],
  sourceVersion: "EMS_P_46 / frontend 20260706", publisher: "環境部環境資料開放平臺", license: "OGDL-Taiwan-1.0 source; address_osm coordinate redistribution rights under review; owner-only local query",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Frontend manifest generated 2026-07-07; source observation/acquisition timestamp unavailable.",
  coverageAndMissingness: "414,904 historical event Points (critical 55,281; high/normal 248,556; mobile 111,067). Noise 29,661 overlaps those categories. Four geocode methods include 108,276 address_osm. Reference coordinates are not violation sites.",
  geometry: "WGS84 geocoded reference Point; bbox and attribute query only. No exact nearest or current-violation claim.",
  sourceSha256: "247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937",
  localDisplayReceipt: "Original-mini PMTiles SHA d54284589ab48e4083fb428b3c65f465ba8de4be5fd5892c0787d1e85f4a1483 matches analytics 20260706, but display excludes mobile category; not full-event equivalence. Local sidecar manifest SHA 5d403a5d36a57d1ef6b78976d0ce5072136559641c72993eaceabce86f7cce2b; no public deployment.",
};
VERIFIED_RAW_FAMILIES["ncl:public_libraries:20260717"] = {
  sourceArtifact: "taipei-gis-analytics/data/raw/culture/public_libraries/public_libraries_20260717.csv",
  evidence: ["mini:scripts/research/build-public-libraries-source.mjs", "mini:public/research/public-libraries-source-20260717.geojson"],
  sourceVersion: "2026-07-17 fixed directory snapshot", publisher: "國家圖書館", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "2026-07-17 is the fixed local snapshot date, not a current opening-status observation.",
  coverageAndMissingness: "644 public libraries from 5,254 original directory rows; 634 Point and 10 null geometry. TGOS 570 only is spatial eligible; L1 62 and offline_exact 2 remain attribute-only in this reader.",
  geometry: "Address-level reference Point; not building entrance, walking access or service area.",
  sourceSha256: "09762ba750e9da4a392481507fd20a462cdcd05037ef5e35b7b29ac84a7173b3",
  localDisplayReceipt: "Existing mini 634 points and sidecar geocoded subset align by name/type/county/rounded coordinates. Local query map 9 points ready/readback in Taipei; remote release not read.",
};
VERIFIED_RAW_FAMILIES["coast_guard:stations:20260626"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/coast_guard_stations/coast_guard_stations_20260626.geojson",
  evidence: ["mini:scripts/research/build-coast-guard-stations-source.mjs", "mini:public/research/coast-guard-stations-20260626.geojson"],
  sourceVersion: "2026-06-26 fixed assembly of data.gov.tw 7089/160068/166260", publisher: "海洋委員會海巡署", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Pipeline fetched_at is not current station operation status.",
  coverageAndMissingness: "269 Point records, 252 patrol and 17 ocean piers. One repeated entity_id remains two source rows; patrol confidence/n_sources are null, not zero.",
  geometry: "WGS84 source Point, not entrance or service reachability.", sourceSha256: "8a4624f2d3d821b24052203a28af06808c174d2cee161cb4c199e8bf6fa78183",
  localDisplayReceipt: "Existing coastGuardStation display asset missing; query-side source verified only.",
};
VERIFIED_RAW_FAMILIES["moc:local_cultural_museums:20260716"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/culture/local_cultural_museums_moc/local_cultural_museums_moc_20260716.geojson",
  evidence: ["mini:scripts/research/build-cultural-museums-owner-source.mjs", "mini:../runtime/owner-only/cultural-museums/cultural-museums-owner-20260716.geojson"],
  sourceVersion: "2026-07-16 fixed emap snapshot", publisher: "文化部", license: "OGDL source; 80 Google geocoded coordinate redistribution rights unverified, owner-only local query",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Snapshot date does not establish current museum operation.",
  coverageAndMissingness: "266 raw rows; 252 Point and 14 null geometry. Source raw coordinates blank; processed Points use Google 80 and offline methods 172.",
  geometry: "Mixed geocoded reference Point; bbox only, no exact-nearest claim.", sourceSha256: "33d38a6ea41a4d04882f67a57cb32a537c1cdf1cbf98d84bdc287da7a36a932d",
  localDisplayReceipt: "252 display Points match processed geocoded rows; 14 unlocated remain queryable only in owner-only source reader.",
};
VERIFIED_RAW_FAMILIES["moc:performing_venues:20260716"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/culture/performing_venues_moc/performing_venues_moc_20260716.geojson",
  evidence: ["mini:scripts/research/build-performing-venues-owner-only.mjs", "mini:../runtime/owner-only/performing-venues/performing-venues-source-20260716.geojson"],
  sourceVersion: "2026-07-16 fixed derived venue snapshot", publisher: "文化部藝文活動", license: "OGDL event source; 471 geocoded coordinates include Google, owner-only local query",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Rolling event-window extraction, not complete or current venue inventory.",
  coverageAndMissingness: "861 rows; 857 Point, 4 null geometry. 386 api_mode and 471 geocoded Points; city blank in 56 records.",
  geometry: "Mixed source/geocoded reference Point; bbox only, no exact-nearest claim.", sourceSha256: "546aee41200a5aa76eac3e6cf8f5faa3feba43f5fd2a02c34086a1ea67b403e2",
  localDisplayReceipt: "Owner-only safe-field sidecar row count and geometry align with fixed processed source; public rights remain HOLD.",
};
VERIFIED_RAW_FAMILIES["traffic:speed_cameras:20260824"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/speed_cameras/speed_cameras_20260824.geojson",
  evidence: ["mini:scripts/research/build-speed-cameras-source.mjs", "mini:public/research/speed-cameras-source-20260824.geojson"],
  sourceVersion: "2026-08-24 fixed assembled sources", publisher: "警政署／交通主管機關", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed listing date does not establish current enforcement state.",
  coverageAndMissingness: "2,805 Point listing rows; 62 coord_suspect remain attribute-only, 2,743 pass Taiwan coordinate subset. 25 suspect rows lack fetched_at.",
  geometry: "Source WGS84 Point; no enforcement direction or active-status claim.", sourceSha256: "ce46f68a1ae617a0ae6a14ecaf470613b5a7587cb5b2c5f57709a80c596bb740",
  localDisplayReceipt: "Current display is 20260626 while query source is 20260824; no same-version alignment. Taipei query map 15 Points ready/readback.",
};
VERIFIED_RAW_FAMILIES["fire:stations:20260710"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/fire/fire_stations/fire_stations_20260710.geojson",
  evidence: ["mini:scripts/research/build-fire-stations-owner-only.mjs", "mini:../runtime/owner-only/fire-stations/fire-stations-source-20260710.geojson"],
  sourceVersion: "2026-07-10 mixed official/Google fixed snapshot", publisher: "各縣市消防局與消防署", license: "Public directory sources claim OGDL; 413 Google coordinates RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed processing date is not current staffing or service status.",
  coverageAndMissingness: "717 Point rows in 22 counties: official 304, Google 413. Existing display has 716 and 38 Pingtung coordinate mismatches.",
  geometry: "Mixed reference Point, proxy bbox/attribute only; no nearest or rescue-time claim.", sourceSha256: "b57b4b725b92b71e8b5244c953f06244ffec0cf641594ecaab97d91a6bdf18ec",
  localDisplayReceipt: "Owner-only reader tested in Taichung 6 and Hualien Google-filtered 4; display version differs.",
};
VERIFIED_RAW_FAMILIES["moe:schools:113-academic-year"] = {
  ...VERIFIED_RAW_FAMILIES["moe:schools:113-academic-year"],
  sourceSha256: "bfc1b452507c0df9a5d3051a53b3687b7cbb19b96f0a5f65ffcc6c74a3970cbf",
  coverageAndMissingness: "Raw XLSX 4,315 rows; processed 4,315 Point. Five school-level categories sum to 4,315; remote 1,152 is an overlapping subset. system_type null 9, region_type null 3,163 retained.",
  geometry: "Source numeric WGS84 Point, but public coordinate redistribution rights unverified; owner-only bbox/attribute reference, no nearest/accessibility claim.",
  localDisplayReceipt: "Six owner-only filtered readers share one 4,315-Point safe sidecar SHA 9e44e6c92cd2335bec90e9e5946139422343f3ca7505b3ac07c9d61bb1194667; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["welfare:child_services:20260812"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/welfare/child_services/child_services_20260812.geojson",
  evidence: ["taipei-gis-analytics/data/processed/welfare/child_services/_manifest.json", "mini:scripts/research/build-welfare-child-services-owner-only.mjs"],
  sourceVersion: "2026-08-12 fixed mixed-source assembly", publisher: "衛福部社家署與逐列登記來源", license: "Raw directory OGDL; Google/offline coordinate redistribution RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Snapshot is not current operation, capacity or service area.",
  coverageAndMissingness: "1,425 records, 1,396 Point and 29 structural null geometry; 11 blank city. Source IDs 130229/160907/161606/165355/161604 are mixed, not a single 165355 table.",
  geometry: "Mixed geocoded reference Point; 29 nulls remain attribute-queryable and cannot enter bbox. No nearest or service-accessibility claim.", sourceSha256: "ac0c94e29487b56589d25bd301ff4369f931dc166a27b446591ac405fe1d7e2a",
  localDisplayReceipt: "Owner-only safe sidecar SHA 55926bb2c37bfe6143201f19d9b303b423cc8ab3a3ec6b9f8ea6e7b3280332f9; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["moc:arts_events:20260716"] = {
  sourceArtifact: "taipei-gis-analytics/data/raw/culture/arts_events_moc/arts_events_20260716.json",
  evidence: ["taipei-gis-analytics/data/processed/culture/arts_events_moc/_manifest.json", "mini:scripts/research/build-arts-events-owner-only.mjs"],
  sourceVersion: "2026-07-16 doFindTypeJ rolling window", publisher: "文化部", license: "OGDL-Taiwan-1.0 raw directory; owner-only local reader until display release aligned",
  observedAt: null, acquiredAt: "2026-07-16", acquiredAtAvailability: "Capture date is not current event availability; response contains then-unended shows only.",
  coverageAndMissingness: "Raw 2,836 activities expand to 7,482 showInfo records, 6,121 Point and 1,361 structural null geometry. Same UID may repeat across shows; category is untranslated raw code.",
  geometry: "Source show-location WGS84 Point when present; no entrance/precision receipt, so proxy bbox and attribute only.", sourceSha256: "7a9c2e98244c0f8e3350be575c686a16d3a49c1cfec1236e14e4ee7bc4dce2f9",
  localDisplayReceipt: "Owner-only safe sidecar SHA 58519dc08d834f9b7b8a8463ddb826dd4456d6346853b105a5eb13dd5e1b5836; current display version not aligned.",
};
VERIFIED_RAW_FAMILIES["rail:stations:20260529-local"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/rail_stations/rail_stations_20260529.geojson",
  evidence: ["mini:scripts/research/build-rail-stations-owner-only.mjs", "taipei-gis-analytics/data/processed/transportation/rail_stations/_manifest.json"],
  sourceVersion: "2026-05-29 unmanifested local assembly", publisher: "TDX／各軌道營運單位 via analytics", license: "503-row 20260527 catalog claims OGDL; 535-row 20260529 source receipts and public redistribution HOLD",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed date does not establish current service or station operation.",
  coverageAndMissingness: "535 Point: THSR 12, TRA 244, metro/light rail 279. Formal 20260527 manifest covers 503; newer file adds 32 TRA and changes TRA:7120. Existing display 503.",
  geometry: "WGS84 station Points; not entrance, walking path or real-time service.", sourceSha256: "2e334441261600b2b5541982705f9cdf11182f94df5a507f45572441b8a33637",
  localDisplayReceipt: "Owner-only 535 safe sidecar SHA 6192eb7b1f5e570a298f438f5bec09a316d39e321cde688805c587fd777b0bf8; existing station_points asset has 503 and is not same-version.",
};
const justiceFamilies = [
  ["anti_corruption_offices", "antiCorruptionOffice", "367a849aa628a16d8c9c7a63f0447209e222026671c6faa8df34dea5e4e8de4c", "66 Google-geocoded Point from two distinct 43+23 raw directories"],
  ["correctional_facilities", "correctionalFacility", "de96d699fd75452aa144ec326d320245b7dcf1e4ed1c7b2cd85625e88ea94478", "51 Google-geocoded Point"],
  ["courts", "court", "b0024292a0346f8fb15fb9f87152e0faa59680e949f458da722fabea42640a24", "35 Google-geocoded Point; court-level offices only"],
  ["immigration_offices", "immigrationOffice", "4dc884eda6ab1039e7f84cf3d9d3c21d3df266d4c561b9f8cea4a07458dc9f74", "25 native TgosWGS Point; excludes unlocated overseas offices"],
  ["investigation_bureau", "investigationBureau", "bf8c9cebf887abf93d2e39d0207992dd0eed245e8e1db5c8fc5c552cdb200769", "29 Google-geocoded Point"],
  ["prosecutors_offices", "prosecutorsOffice", "84426ec9ebd8008d48a778e3233c48abe83f4106aab31f0a9479e58b338a2063", "29 Google-geocoded Point"],
];
for (const [folder, , sha, coverage] of justiceFamilies) VERIFIED_RAW_FAMILIES[`police_justice:${folder}:20260626`] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/police_justice/${folder}/${folder}_20260626.geojson`,
  evidence: [`taipei-gis-analytics/data/processed/police_justice/${folder}/_manifest.json`, "mini:scripts/research/build-justice-facilities-owner-only.mjs"],
  sourceVersion: "2026-06-26 fixed processed snapshot", publisher: "Separate official justice or immigration source directory", license: "RIGHTS_HOLD: processed manifest lacks independently checked coordinate redistribution receipt; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Pipeline date is not current office or service status.",
  coverageAndMissingness: `${coverage}; no null or non-Point geometry in inspected processed source.`,
  geometry: "Reference Point; bbox and attribute count only. No nearest, entrance, jurisdiction or accessibility claim.", sourceSha256: sha,
  localDisplayReceipt: "Safe owner-only sidecar and bounded reader verified; current display release and runtime same-version alignment not proven.",
};
const busStationFamilies = [
  ["tdx:bus_stations_city:2025-11-to-2026-02-28", "busStationsCity", "bus_stations_city", "a585bab7d2fc98cb63e48eff461c43e5f16cf35b1fae9acd7845a5d4d7e7ac8b", "d936b193c72bb2456e85535aa7569893e448aef3265075f7f949e72b72ee7471", "49,830 Point; mixed city snapshots 2025-11 to 2026-02-28"],
  ["tdx:bus_stations_intercity:2026-02-28", "busStationsIntercity", "bus_stations_intercity", "9012db171215104773a758c0a8c3d9ddba72f2e979f2195647721510ca7d558f", "471b7bc5a1cdab3d1d7f99d5917dfa9e216a10b9b0d9c8855fe1e7481d46c1dc", "15,383 Point; 2026-02-28 InterCity product"],
];
for (const [key, , folder, sha, manifestSha, coverage] of busStationFamilies) VERIFIED_RAW_FAMILIES[key] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/transportation/bus/${folder}.geojson`,
  evidence: ["mini:scripts/research/build-bus-stations-owner-only.mjs", `mini:../runtime/owner-only/bus-stations/${folder === "bus_stations_city" ? "city" : "intercity"}/manifest.json`],
  sourceVersion: "TDX fixed source product", publisher: "TDX /v2/Bus/Station", license: "OGDL-Taiwan-1.0; owner-only local sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed source snapshots do not establish current stops, routes, vehicles or ETA.",
  coverageAndMissingness: `${coverage}; no null or non-Point geometry. City and InterCity are distinct products and dates.`,
  geometry: "Actual StationPosition Point, not roadside Stop, entrance, walking access or live service.", sourceSha256: sha,
  localDisplayReceipt: `Immutable gzip spatial partitions manifest SHA ${manifestSha}; current display release and runtime same-version alignment not proven.`,
};
VERIFIED_RAW_FAMILIES["transport:taxi_stands:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/taxi_stand/taxi_stand_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/taxi_stand/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/taxi_stand.md", "mini:public/geo/taxi_stand.geojson"],
  sourceVersion: "2026-05-24 fixed two-city assembly", publisher: "臺北市交通局／嘉義市交通處", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processing date does not establish present stand operation or free taxi capacity.",
  coverageAndMissingness: "224 Point only in Taipei and Chiayi. Raw Taipei SHA 6216d6b19ac63e03d18b54d029f26ef1d9b0e2634230c2dbde3ced16b12defe0 and Chiayi SHA 3cd82370a2aefa589016d9cbfbd12772e09f85e850b570b1a96ecb6e2fcbc879; other raw city files not included. Chiayi District/Slots/Schedule null means not provided.",
  geometry: "Source WGS84 stand Point; not pickup boundary or travel-network access.", sourceSha256: "ac4b83e60768754276e142d3c0b41626ed50ec41a58581edf7d64bd340c5c532",
  localDisplayReceipt: "Mini static GeoJSON and analytics processed bytes have identical SHA; remote release not read. Chiayi bbox 21 normal MCP and scene ready/readback.",
};
VERIFIED_RAW_FAMILIES["transport:etc_gantry:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/etc_gantry/etc_gantry_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/etc_gantry/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/etc_gantry.md", "mini:public/geo/etc_gantry.geojson"],
  sourceVersion: "2026-05-24 fixed snapshot", publisher: "交通部高速公路局", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processing date does not establish current gantry inventory or fare rules.",
  coverageAndMissingness: "341 Point; source CSV SHA a4f678236be3307a078c5308d65d226a542ec9eb00b663b02f616bf83ffe38b7.",
  geometry: "Source WGS84 gantry Point; not freeway LineString, interchange area or driving distance.", sourceSha256: "f3e1b2433fec26b506482846a56027f8bc986c1ecbaec21f731ebc635d3ed5f1",
  localDisplayReceipt: "Mini static GeoJSON and analytics processed bytes have identical SHA; remote release not read. Kaohsiung bbox 8, northbound 3 normal MCP.",
};
VERIFIED_RAW_FAMILIES["business_registry:factory_locations:202606"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/business_registry/factory_locations/factory_locations_202606.geojson",
  evidence: ["taipei-gis-analytics/data/processed/business_registry/factory_locations/_manifest.json", "taipei-gis-analytics/docs/data-catalog/business_registry/factory_locations.md", "mini:scripts/research/build-factory-locations-owner-only.mjs"],
  sourceVersion: "202606 official active-factory source; processed 2026-08-16", publisher: "經濟部產業發展署 data.gov.tw 6569", license: "OGDL-Taiwan-1.0 raw directory; owner-only geocoded reference Point reader",
  observedAt: null, acquiredAt: "2026-08-16", acquiredAtAvailability: "Raw vintage and pipeline time do not establish current production activity.",
  coverageAndMissingness: "Raw 100,634 rows -> exact dedupe 100,633 -> active 100,624 -> 90,652 Point, 9,972 geocode miss. Misses are not zero factories. Other status rows excluded from published source.",
  geometry: "Independent offline address geocode Point, not factory entrance, parcel or building extent; proxy bbox/attribute only.", sourceSha256: "efea0882b55273f0ae8eb3a965a206a4e01a07d8ca9f219e78af1954794e6acc",
  localDisplayReceipt: "Owner-only 228-shard manifest SHA 77e3399bd1368671837e32c99c304c36dc1985b88409eb46fcb73515e8fd69fd; current display release not proven same-version.",
};
const educationChildcareFamilies = [
  ["kindergartens", "eduKindergarten", "bc9749db2f80411ca176ca1873a0e9a2d8e06e01b5268e23d6d429fa803cbfce", "6,747 raw; 6,689 Point; 58 geocode miss retained with null geometry"],
  ["afterschool_care", "eduAfterschoolCare", "85004118188dc7496af8202931254f44106e51151a81b299fc2a4c429bcfd99d", "787 raw; 782 Point; 5 geocode miss retained with null geometry"],
  ["mutual_care", "eduMutualCare", "3bc18d4d426a6e6e1bfa575d2e29f4e316ecfa581dd2efadcabf80138fcfc932", "148 raw; 148 Point; 0 geocode miss"],
];
for (const [folder, , sha, coverage] of educationChildcareFamilies) VERIFIED_RAW_FAMILIES[`moe:${folder}:20260807`] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/education/${folder}/${folder}_20260807.geojson`,
  evidence: [`taipei-gis-analytics/data/processed/education/${folder}/_manifest.json`, "mini:scripts/research/build-education-childcare-owner-only.mjs"],
  sourceVersion: "2026-08-07 fixed education directory", publisher: "教育部來源名冊", license: "OGDL raw directory; geocoded coordinate redistribution RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Academic year or processed date does not establish current registration or intake.",
  coverageAndMissingness: coverage, geometry: "Mixed offline/TGOS/interpolated reference Point; null geometry preserved; bbox/attribute only, no nearest.", sourceSha256: sha,
  localDisplayReceipt: "Safe owner-only full-raw sidecar includes miss rows; current display release not proven same-version.",
};
const tourismHospitalityFamilies = [
  ["hotel", "tourHotels", "hotel_20260722.geojson", "6eb9e3dd6ccc9ea9a6b7746231001e70e7d753ecc5794c7e1fb31fe56e82d9e0", "8b70d194e402e1026a6789a2fb56d3ebd2dc46572cf7f873439485037fde30d3", "15,656 raw; 15,654 Point; 2 invalid geometry"],
  ["restaurant", "tourRestaurants", "restaurant_20260723.geojson", "f78dcd2d99aacdc3607c2230d8280945ab67e17948b6e237e3a01b1abffd19f9", "1b855a0198ffe0a53cc339972dec2a037dd1f313814ae76fd1f8ccfb0d25eeb9", "3,690 raw; 3,688 Point; 2 invalid geometry"],
];
for (const [folder, , file, sha, manifestSha, coverage] of tourismHospitalityFamilies) VERIFIED_RAW_FAMILIES[`mota:${folder}:202607`] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/tourism/${folder}/${file}`,
  evidence: [`taipei-gis-analytics/data/processed/tourism/${folder}/_manifest.json`, `taipei-gis-analytics/docs/data-catalog/tourism/${folder}.md`, "mini:scripts/research/build-tourism-hospitality-owner-only.mjs"],
  sourceVersion: `2026-07 fixed V2.1 ${folder} ZIP`, publisher: "交通部觀光署", license: "OGDL-Taiwan-1.0; owner-only safe-field reader",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed source snapshot does not establish current operation, price or booking availability.",
  coverageAndMissingness: coverage, geometry: "Source WGS84 Point for bounded straight-line reference distance; no entrance, walking or transit claim.", sourceSha256: sha,
  localDisplayReceipt: `Safe owner-only partition manifest SHA ${manifestSha}; current display release not proven same-version.`,
};
VERIFIED_RAW_FAMILIES["police_justice:civil_defense_shelters:20260824"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/civil_defense_shelters/civil_defense_shelters_20260824.geojson",
  evidence: ["taipei-gis-analytics/data/processed/police_justice/civil_defense_shelters/_manifest.json", "mini:scripts/research/build-civil-defense-shelters-owner-only.mjs"],
  sourceVersion: "2026-08-24 fixed 15-source rebuild", publisher: "警政署／data.gov.tw／TGOS", license: "OGDL raw rosters; TGOS coordinate redistribution RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: "2026-08-24", acquiredAtAvailability: "Snapshot does not establish current opening, capacity or safety.",
  coverageAndMissingness: "110,291 Point; exact 102,577, street_block 1,843, approximate 5,871; coord_suspect 1,753. Supersedes old 62,695 six-city snapshot.",
  geometry: "Mixed exact and approximate reference Point; bbox/attribute only, no nearest or accessibility.", sourceSha256: "a3abf5e8a19737ffd3cd226bddb24f0413c89b2979b812d2e223eb8fb2ca2aae",
  localDisplayReceipt: "Owner-only 282-shard manifest SHA 0cb6cf2ae37fb514c4f2f01200a240277d301296a17668ba4e940da0ac3dcd6c; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["moi:tourism_factory:20260723"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/tourism/tourism_factory/tourism_factory_20260723.geojson",
  evidence: ["taipei-gis-analytics/data/processed/tourism/tourism_factory/_manifest.json", "mini:scripts/research/build-tourism-factories-owner-only.mjs"],
  sourceVersion: "2026-07-23 fixed official roster", publisher: "經濟部產業發展署", license: "OGDL raw; 34 Google-geocoded coordinates RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Roster snapshot does not establish current operating or visit eligibility.",
  coverageAndMissingness: "158 raw rows, 158 Point; Google 34, offline L1 52, L1.5 17, L2 55.",
  geometry: "Fallback geocoded proxy Point; bbox/attribute only, no nearest/accessibility.", sourceSha256: "a47d7ba0ff6e1221a4f94cac1aeeff75308d2779aed57d26a2f65895d7ee4014",
  localDisplayReceipt: "Safe owner-only sidecar SHA d61535fc102dbcea8b6fa813fd36d25c4ba5099239dabe845669315276691196; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["tdx:bike_stations:20260301-fixed"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/bike/bike_stations_all.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/bike/_manifest.json", "mini:public/geo/bike_stations.geojson"],
  sourceVersion: "TDX fixed local 2026-03-01 raw filename; processed manifest 2026-05-19", publisher: "TDX／各縣市公共自行車業者", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Neither filename nor manifest update proves current station or bike availability.",
  coverageAndMissingness: "9,408 source WGS84 Point; no real-time available-bike or empty-slot values.",
  geometry: "StationPosition Point, not station footprint or road access.", sourceSha256: "dbbd70b3912b8739c98c75d14a41bd0aa668bbca82f16d3012c20c48fff34b24",
  localDisplayReceipt: "Mini static GeoJSON SHA equals processed source; remote release not read.",
};
VERIFIED_RAW_FAMILIES["cwa:weather_stations:20251129-fixed"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/weather/main/stations.geojson",
  evidence: ["taipei-gis-analytics/data/processed/weather/main/_manifest.json", "mini:public/geo/weather_stations.geojson"],
  sourceVersion: "2025-11-29 operating station CSV; processed manifest 2026-07-07", publisher: "中央氣象署", license: "OGDL-Taiwan-1.0 and CWA terms",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed manifest date is not a live observation or current station operating receipt.",
  coverageAndMissingness: "838 selected active-at-snapshot Point; 351 closed stations are only in stations_all and excluded from this reader.",
  geometry: "Station Point, not observation representativeness or weather surface.", sourceSha256: "08088afb391e63970fe979895b8f76cc9b7c9a427dc09a90dd38939a784e8222",
  localDisplayReceipt: "Mini static GeoJSON SHA equals processed source; remote release not read.",
};
VERIFIED_RAW_FAMILIES["moea:agri_wholesale_market_companies:20260522"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/agri_wholesale_market_companies/agri_wholesale_market_companies.geojson",
  evidence: ["taipei-gis-analytics/data/processed/agriculture/agri_wholesale_market_companies/_manifest.json", "taipei-gis-analytics/data/processed/agriculture/agri_wholesale_market_companies/_verification.json", "mini:scripts/research/build-agri-wholesale-market-owner-only.mjs"],
  sourceVersion: "2026-05-22 raw, 2026-05-25 processed", publisher: "經濟部商業發展署", license: "OGDL-Taiwan-1.0 raw; TGOS coordinates owner-only until public rights checked",
  observedAt: null, acquiredAt: "2026-05-22", acquiredAtAvailability: "Fixed company registration subset does not establish current operation or a physical wholesale-market facility.",
  coverageAndMissingness: "115 raw company rows; 53 approved subset all geocoded Point; 37 dissolved, 24 revoked, 1 rescinded excluded.",
  geometry: "TGOS geocoded registration-address proxy Point; bbox/attribute only.", sourceSha256: "cb53e333f57dfe1cefa8d17b606da37ff8315c6ccc85b5150b9eb8adf3764e4f",
  localDisplayReceipt: "Mini static SHA equals analytics processed; safe owner-only sidecar SHA 4f86b5385bbc6fe755dd5e277f53d40bda5fb95b21044d0a2b4ad0535990ba4e; remote release not read.",
};
VERIFIED_RAW_FAMILIES["npa:women_child_warning:20260626"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/women_child_warning/women_child_warning_20260626.geojson",
  evidence: ["taipei-gis-analytics/data/processed/police_justice/women_child_warning/_manifest.json", "mini:scripts/research/build-justice-event-points-owner-only.mjs"],
  sourceVersion: "2026-06-26 fixed two-roster assembly", publisher: "警政署／桃園市警察局鏡像", license: "OGDL raw; Google geocoded coordinates RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: "2026-06-26", acquiredAtAvailability: "Fixed warning roster does not establish current safety, event occurrence or police deployment.",
  coverageAndMissingness: "188 valid raw warning rows; 185 reference Point and 3 upstream geocode failure rows absent from Point sidecar.",
  geometry: "Google geocoded reference Point; bbox/attribute only, no nearest or safety inference.", sourceSha256: "29a48e8e229802f0f78e1c57c550aca3f5e02e3ac67e682cad8dbdf016f58e89",
  localDisplayReceipt: "Safe owner-only sidecar SHA bbd5a338f632783cdb338ad8f086002fc91ca1e2bde6d5044e88f13b14fc75c4; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["tdx:road_cctv:20260524-fixed"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/cctv/cctv_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/cctv/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/cctv.md", "mini:public/geo/cctv.geojson"],
  sourceVersion: "2026-05-24 fixed TDX snapshot", publisher: "TDX／高公局／公路局／縣市道路機關", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "2026-07-07 manifest update does not establish current camera operation or stream availability.",
  coverageAndMissingness: "6,129 unique CCTVID Point across Freeway, Highway and City products; distinct from Taoyuan police CCTV 4,840 Point source.",
  geometry: "TDX camera location Point, not field of view, traffic volume or road safety.", sourceSha256: "aaa461000f16837a03d81fb67133f6503a7f0bc04cf5c8604f5021e725c145aa",
  localDisplayReceipt: "Mini static and analytics processed bytes have identical SHA; remote release and live video URL not read.",
};
const funeralFamilies = [
  ["funeral_facilities_moi", "funeralFacilities", "f358f04697fa477cdf99a033f4488be476c12948162d974010cc57fdbb899223", "fa8f04689e549dec2b1ec412b5c42ebf4aec4664e306be36a5a5b3f6a8220f49", "3,707 Point; 438 source records unlocated; 574 Google-derived coordinates"],
  ["funeral_operators_biz", "funeralOperators", "aa16c2de7b159068f276ef81d8a3dac1fd88d3334b0d20f521fd7a3f821b6c20", "8f15496515e649b16784ba12db0cbe0bb9b835fb1510f3654acfcb77393f6d77", "6,233 Point; 1,664 inactive registrations retained; 48 Google-derived coordinates"],
];
for (const [folder, , sha, manifestSha, coverage] of funeralFamilies) VERIFIED_RAW_FAMILIES[`moi:${folder}:20260805`] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/funeral/${folder}/${folder}_20260805.geojson`,
  evidence: [`taipei-gis-analytics/data/processed/funeral/${folder}/_manifest.json`, "mini:scripts/research/build-funeral-points-owner-only.mjs"],
  sourceVersion: "2026-08-05 fixed official roster", publisher: folder === "funeral_facilities_moi" ? "內政部宗教及禮制司" : "經濟部商業發展署", license: "OGDL raw; Google-derived coordinate redistribution RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: "2026-08-05", acquiredAtAvailability: "Snapshot does not establish current opening, capacity, activity or service area.",
  coverageAndMissingness: coverage, geometry: "Mixed reference Point incl parcel centroids/geocoding; bbox/attribute only, no nearest/accessibility.", sourceSha256: sha,
  localDisplayReceipt: `Safe owner-only partition manifest SHA ${manifestSha}; current display release not proven same-version.`,
};
const religionFamilies = [
  ["ancestral_halls", "religionAncestralHalls", "20260801", "70852726d331315f674d963f1199c9527916d7dde0acf8136a094e094aceb21d", "173 Point; 16 geocoded fallback"],
  ["churches", "religionChurches", "20260801", "9aabe70fc2215069c35e9e16bd30d75588b0883f3652a592623e0719bd79c127", "2,116 Point; mixed OGDL/ODbL, 1,066 OSM-only"],
  ["other_worship", "religionOtherWorship", "20260801", "22cc3273a6b6bbf1cc3bea344eacfa95fe1914072b55d51dec7ca8c3a0d18fe3", "1,319 OSM-only Point, 859 unnamed"],
  ["foundations", "religionFoundations", "20260801", "3e1e531bbf9b29c671661571f5e34cf4901a64fd772d10db1e88abcd3e4c8430", "165 source rows; 124 original Point, 40 (0,0) and 1 blank restored to null"],
  ["top100", "religionTop100", "20260122", "fc5056083e7b263fdc3c1b56f89cd7e5c33c121d5dd50fdc9e478b19e4c98347", "100 selected religious landscapes from 2021 source, not census"],
];
for (const [folder, , date, sha, coverage] of religionFamilies) VERIFIED_RAW_FAMILIES[`moi:religion:${folder}:${date}`] = {
  sourceArtifact: `taipei-gis-analytics/data/processed/religion/${folder}/${folder}_${date}.geojson`,
  evidence: [`taipei-gis-analytics/data/processed/religion/${folder}/_manifest.json`, "mini:scripts/research/build-religion-points-owner-only.mjs"],
  sourceVersion: `${date} fixed processed snapshot`, publisher: folder === "other_worship" ? "OpenStreetMap contributors" : "內政部／文化部／OpenStreetMap contributors", license: folder === "other_worship" ? "ODbL 1.0; © OpenStreetMap contributors; owner-only" : "OGDL/ODbL per-record mixed or source-specific; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed source or processing date does not establish current registration, opening or representativeness.",
  coverageAndMissingness: coverage, geometry: "Safe owner-only reference Point/attribute reader; foundations original null restored, no nearest/accessibility.", sourceSha256: sha,
  localDisplayReceipt: "Source-verified owner-only safe sidecar; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["mountain:huts:20260801"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/forestry/mountain_huts/mountain_huts_20260801.geojson",
  evidence: ["taipei-gis-analytics/data/processed/forestry/mountain_huts/_manifest.json", "mini:scripts/research/build-mountain-points-owner-only.mjs"],
  sourceVersion: "2026-08-01 fixed official/OSM assembly", publisher: "玉山國家公園／OpenStreetMap contributors", license: "OGDL/ODbL mixed; © OpenStreetMap contributors; owner-only",
  observedAt: null, acquiredAt: "2026-08-01", acquiredAtAvailability: "Snapshot does not establish current hut availability or trail access.",
  coverageAndMissingness: "136 Point: 30 Yushan official and 106 OSM-only; 12 unnamed OSM shelters; other park official coverage incomplete.",
  geometry: "Reference Point, not entrance, route, shelter capacity or current access.", sourceSha256: "5e9f4a1017089dd02540720f1da34b191048e1638dcacf0e29f5aec77f6212e4",
  localDisplayReceipt: "Safe owner-only sidecar SHA ae47329221a44a2931fbe53c73d1cb79af8e72eee1c530e3bbbc47e4dcecd77b; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["nfa:mountain_rescue:2019-2024"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/hazards/mountain_rescue_incidents/mountain_rescue_incidents_20260801.geojson",
  evidence: ["taipei-gis-analytics/data/processed/hazards/mountain_rescue_incidents/_manifest.json", "mini:scripts/research/build-mountain-points-owner-only.mjs"],
  sourceVersion: "2019–2024 historical incidents; processed 2026-08-01", publisher: "內政部消防署", license: "OGDL-Taiwan-1.0; de-identified safe fields owner-only",
  observedAt: "2019–2024", acquiredAt: null, acquiredAtAvailability: "Historical cases do not establish current incident or future risk.",
  coverageAndMissingness: "2,465 Point after duplicate source rows and 5 invalid/out-of-Taiwan coordinates excluded; precise times and case IDs withheld.",
  geometry: "Historical incident reference Point, not risk surface or emergency access.", sourceSha256: "b1301673d2575e18acc59e9204dfffbf2810fc13c2a755dc2003ef02c4dba2dd",
  localDisplayReceipt: "Safe owner-only sidecar SHA da0d3a1ab4e08a67bb819e795ebefabd355aa0ba78b776d72d937d7b9163c058; current display release not proven same-version.",
};
VERIFIED_RAW_FAMILIES["mohw:nursing_homes:20260812"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/welfare/nursing_homes/nursing_homes_20260812.geojson",
  evidence: ["taipei-gis-analytics/data/processed/welfare/nursing_homes/_manifest.json", "mini:scripts/research/build-nursing-homes-owner-only.mjs"],
  sourceVersion: "2026-08-12 fixed two-roster assembly", publisher: "衛生福利部護理及健康照護司", license: "OGDL raw; Google-derived coordinates RIGHTS_HOLD, owner-only",
  observedAt: null, acquiredAt: "2026-08-12", acquiredAtAvailability: "Fixed roster does not establish current operation, permission, capacity or available beds.",
  coverageAndMissingness: "1,611 reference Point from raw 115950 and 165355; no address, phone, beds or license details in query sidecar.",
  geometry: "Mixed WGS84/TGOS/Google/offline reference Point; bbox/attribute only, no nearest or accessibility.", sourceSha256: "d0f9ee7f7314d4fd0d69fbcd7a8ce257bcfd8ada643f58f656b68875de766914",
  localDisplayReceipt: "Safe owner-only sidecar SHA 782e951370c44890578147d864562c0a55c125297eedd290e0f84f47267eeeec; Mini display SHA 775bc1a88a5e8675e48ed7930645a5e7df505968c0821ed080843e7e75bef3d9 mismatches processed source, so same-version display HOLD.",
};
VERIFIED_RAW_FAMILIES["moea:common_registration_addresses:202608-r2"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/business_registry/common_registration_addresses/common_registration_addresses_202608_r2.geojson",
  evidence: ["taipei-gis-analytics/data/processed/business_registry/common_registration_addresses/_manifest.json", "taipei-gis-analytics/docs/data-catalog/business_registry/common_registration_addresses.md", "mini:public/business_registry/common_registration_addresses_202608_r2.geojson"],
  sourceVersion: "202608 r2 fixed derived address grouping", publisher: "經濟部商業發展署 GCIS", license: "OGDL-Taiwan-1.0; owner-only research query",
  observedAt: null, acquiredAt: "2026-08-18", acquiredAtAvailability: "Monthly company-stock source does not establish current registration or actual place of operation.",
  coverageAndMissingness: "657,882 company-stock rows -> 654,165 eligible geocoded members -> 11,121 address groups with at least 5 companies; membership sum 198,606; all groups have Point and four published attributes.",
  geometry: "Member-coordinate mode proxy for normalized registration address; bbox/attribute only, not entrance, company site or precise nearest.", sourceSha256: "bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1",
  localDisplayReceipt: "Analytics processed, Mini static and owner-only sidecar are byte-identical SHA bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1; remote release not read.",
};
VERIFIED_RAW_FAMILIES["meta_wri:canopy_height:20260724"] = {
  sourceArtifact: "mini-taiwan-pulse/public/forestry/canopy_giants_taiwan.geojson",
  evidence: ["taipei-gis-analytics/docs/systems/forestry_tic.md", "mini:public/forestry/canopy_giants_taiwan.geojson"],
  sourceVersion: "Meta/WRI Canopy Height Map v2, 2026-07-24 fixed Taiwan-main-island derivation", publisher: "Meta AI (Data for Good) × World Resources Institute", license: "CC BY 4.0 with Meta/WRI attribution",
  observedAt: null, acquiredAt: "2026-07-24", acquiredAtAvailability: "Derivation date is not current tree height or trail availability.",
  coverageAndMissingness: "7,823 Point representing supported 45–85m 10m raster cells on Taiwan main island; height_m, dist_access_m, elev_m have no null.",
  geometry: "EPSG:3857 10m raster cell centers converted to WGS84, rounded to 5 decimal places; proxy Point, not individual tree or entrance.", sourceSha256: "2b050b7c7d1ccb0391dd867a9c3398f7d4bafbe2a8f863f5f4d4df03bcc01e4d",
  localDisplayReceipt: "Reader and Mini display use same fixed GeoJSON SHA; remote release not read.",
};
VERIFIED_RAW_FAMILIES["highway_bureau:service_area:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/service_area/service_area_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/service_area/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/service_area.md", "mini:public/geo/service_area.geojson"],
  sourceVersion: "2026-05-24 fixed Highway Bureau CSV", publisher: "交通部高速公路局", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed snapshot does not establish current service area operation or road access.",
  coverageAndMissingness: "22 original CSV rows and 22 WGS84 Point; no null among eight published attributes.", geometry: "Source service area Point, not service area extent or roadway entrance.", sourceSha256: "68fc87e6859530aa0ccf8ecaf61a23a3a95307c23d3a7a0f5461b1448d241b65",
  localDisplayReceipt: "Mini static and analytics processed byte-identical SHA; remote release not read.",
};
VERIFIED_RAW_FAMILIES["city:parks:20260705"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/parks/parks_20260705.geojson",
  evidence: ["taipei-gis-analytics/data/processed/urban_open_space/parks/_manifest.json", "taipei-gis-analytics/docs/data-catalog/urban_open_space/parks.md", "mini:public/urban/parks_taipei.geojson"],
  sourceVersion: "2026-07-05 fixed four-roster three-city assembly", publisher: "臺北市／臺中市／臺南市政府", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processing date does not establish current park opening or facility status.",
  coverageAndMissingness: "2,917 Point: Taipei 1,350, Taichung 1,081, Tainan 486. district 1,316 null; has_playground 1,240 null; area_sqm 521 null; address 520 null.",
  geometry: "Park/facility reference Point, not park polygon or entrance; Taipei source records can represent duplicate real parks.", sourceSha256: "2f015b8f1f5cccc33db3abb1dae6d8bc9918c937288dbfb0a5c2aa43e9acf38a",
  localDisplayReceipt: "Mini static and analytics processed byte-identical SHA; remote release not read.",
};
VERIFIED_RAW_FAMILIES["boch:heritage:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/tourism/heritage/heritage_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/tourism/heritage/_manifest.json", "taipei-gis-analytics/docs/data-catalog/tourism/heritage.md", "mini:public/tourism/heritage_national.geojson"],
  sourceVersion: "2026-05-24 fixed three-endpoint BOCH assembly", publisher: "文化部文化資產局", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Yearly snapshot does not establish current registration, opening or preservation state.",
  coverageAndMissingness: "2,894 Point: monuments 1,056, historical buildings 1,759, cultural landscapes 79. Historical building grade is 1,759 empty strings in source, not numeric zero.",
  geometry: "Source representative Point, not protected building, parcel or landscape extent.", sourceSha256: "6946a719b30a606250228d97890eed323f58a0cba10238e8290c0099a5b163e4",
  localDisplayReceipt: "Mini SHA 7bc0ccae1aea7367ceab79cc95d778a9884cfb5069a0ec902e97bf9edaa2f7b7 differs by removing duplicated longitude/latitude properties; ordered feature geometry and remaining properties canonically match processed source. Original API JSON unavailable locally; remote release not read.",
};
VERIFIED_RAW_FAMILIES["mota:activity:20260722"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/tourism/activity/activity_20260722.geojson",
  evidence: ["taipei-gis-analytics/data/raw/tourism/activity/Event-json_v2.1.zip", "taipei-gis-analytics/data/processed/tourism/activity/_manifest.json", "taipei-gis-analytics/docs/data-catalog/tourism/activity.md", "mini:public/tourism/activities_national.geojson"],
  sourceVersion: "2026-07-22 fixed Tourism Administration Event V2.1 snapshot", publisher: "交通部觀光署", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: "2026-07-22", acquiredAtAvailability: "Raw UpdateTime and processing date do not establish current event schedule or cancellation.",
  coverageAndMissingness: "830 raw Events -> 828 Taiwan-scope Point, 2 out-of-bounds excluded; 827 EventScheduled, 1 EventCancelled. start/end present; organizer empty string 685 is missing.",
  geometry: "Source event PositionLon/Lat Point, not venue extent or entrance.", sourceSha256: "a30dab62f49891cc31caa9d1eeb01653f677c1e4b06cbcb88f8ecf5f0d028ac4",
  localDisplayReceipt: "Raw ZIP SHA 99791d95f089757dec509aa2a029cededc0625480567e55bb6a206aa82ec2bf6; Mini SHA 0e51aea0298b1eb60c60990f2ff326efa30e0367925e2405271ba94e7de1ea3c differs from processed only by removal of duplicated lat/lon properties. Remote release not read.",
};
VERIFIED_RAW_FAMILIES["cities:protected_trees:20260714"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/protected_trees_national/protected_trees_national_20260714.geojson",
  evidence: ["taipei-gis-analytics/data/processed/urban_open_space/protected_trees_national/_manifest.json", "taipei-gis-analytics/docs/data-catalog/urban_open_space/protected_trees_national.md", "mini:public/urban/protected_trees_national.geojson"],
  sourceVersion: "2026-07-14 fixed eight-city merge", publisher: "八縣市政府來源", license: "HOLD_LICENSE: eight raw source URLs/licenses not individually verified; owner-only local",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processing date does not establish current tree registration, survival or condition.",
  coverageAndMissingness: "6,670 source rows -> 6,544 Point; 126 invalid coordinates excluded. Eight cities only; many age, height and status values null.",
  geometry: "Mixed WGS84/TWD97 normalized reference Point; original precision per-city not proven; bbox/attribute only.", sourceSha256: "197651e6bc1db78ae1fc6e87d8e3ce698fb5f25bfbccbb516b2e47ff2c340549",
  localDisplayReceipt: "Mini static byte-identical with analytics processed; safe owner-only sidecar SHA 27ee4336fac481b1bba5ff95db5e1699db11de97d40bc597a06e7643bcd88597 removes address and duplicated lat/lon. Remote release not read.",
};
VERIFIED_RAW_FAMILIES["taipei:riverside_trees:20260714"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/riverside_trees_taipei/riverside_trees_taipei_20260714.geojson",
  evidence: ["taipei-gis-analytics/data/processed/urban_open_space/riverside_trees_taipei/_manifest.json", "mini:scripts/research/build-riverside-trees-owner-only.mjs", "mini:public/urban/riverside_trees_taipei.geojson"],
  sourceVersion: "2026-07-14 fixed historical survey processing", publisher: "臺北市政府工務局水利工程處（本機來源註記）", license: "RIGHTS_HOLD: raw download URL and license receipt missing; owner-only local",
  observedAt: "2016-11 to 2017-06 for most survey rows", acquiredAt: null, acquiredAtAvailability: "Processing date is not current inventory, survival, maintenance or access.",
  coverageAndMissingness: "10,921 raw rows -> 10,917 Point; four missing/out-of-range coordinates excluded. notes null 4,538; survey_date 1230 in two rows is incomplete and not a time filter.",
  geometry: "Source WGS84 Point, not crown extent or field-verified current position; historical straight-line reference only.", sourceSha256: "5c7f87775bb978a80fa07411480919e3af38055cdc54b6b14f92b2ab7495fa94",
  localDisplayReceipt: "Mini static byte-identical with analytics processed; safe owner-only sidecar SHA 2bc603414206c8b302754ac1d958916f505f2f3752ae08c640892c86e3ea4dbe. Remote release not read.",
};
VERIFIED_RAW_FAMILIES["moa:forest_treatment_works:20260802"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/forestry/forestry_treatment_works/forestry_treatment_works.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/forestry/forestry_treatment_works.md", "mini:scripts/research/build-forest-treatment-works-owner-only.mjs", "mini:public/forestry/forestry_treatment_works.geojson"],
  sourceVersion: "2026-08-02 coordinate-repair processed snapshot", publisher: "農業部林業及自然保育署 data.gov.tw 47601", license: "OGDL-Taiwan-1.0; RAW_VERSION_MISMATCH_HOLD owner-only",
  observedAt: "ROC plan years 92–113", acquiredAt: "2026-06-07 catalog ingest", acquiredAtAvailability: "Plan year and processing date do not establish construction or maintenance status.",
  coverageAndMissingness: "Processed 6,213 Point from documented 6,275 source rows minus 62 unlocated; current local raw.json has 9,999 rows and does not match that predecessor. city/country blank string 77 each.",
  geometry: "Coordinate repair via tm2/tm2_swapped/wgs84/wgs84_swapped; proxy reference Point, bbox/attribute only.", sourceSha256: "266a981d42ec5c601b1fdf6b79097cadb96724a13eb815dc7b3680960efe8e2b",
  localDisplayReceipt: "Mini static and analytics processed byte-identical; safe owner-only sidecar SHA 9b0288a63d668541fce810a42af1f157cd5ecb176fca4da5859e41097f0b48db. Raw lineage HOLD.",
};
VERIFIED_RAW_FAMILIES["moa:forest_wildlife_grid:20260607"] = {
  sourceArtifact: "mini-taiwan-pulse/public/forestry/wildlife_distribution_3rd.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/forestry/wildlife_distribution_3rd.md", "mini:public/forestry/wildlife_distribution_3rd.geojson"],
  sourceVersion: "2026-06-07 fixed local processed snapshot; raw immutable revision unavailable", publisher: "農業部林業及自然保育署 data.gov.tw 38126", license: "OGDL-Taiwan-1.0; SOURCE_LINEAGE_HOLD owner-only reference",
  observedAt: null, acquiredAt: "2026-06-07 catalog ingest", acquiredAtAvailability: "Ingest date is not animal observation time or current distribution.",
  coverageAndMissingness: "1,241 Point; no null in published columns; 176 repeated TM2 coordinate pairs. WILDLIFE_ is an opaque source field, not species/count; PERIMETER all zero with undefined semantics.",
  geometry: "TWD97 TM2 grid/representative positions rendered as WGS84 proxy Points; no immutable raw transform or grid-boundary receipt; bbox/attribute only.", sourceSha256: "57f6cc342ab104804899af83b5c023e5b5555babd12c281479fd99b8ef01af48",
  localDisplayReceipt: "Reader and Mini static use same fixed asset SHA; source raw lineage and remote release HOLD.",
};
VERIFIED_RAW_FAMILIES["moe:university_students:114"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/education/university_students/university_students_20260807.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/education/university_students.md", "mini:scripts/research/build-university-students-owner-only.mjs", "mini:public/education/university_students.geojson"],
  sourceVersion: "114 academic-year student statistics joined to 113 academic-year school points", publisher: "教育部統計處 data.gov.tw 6231／113 學年度學校名錄", license: "Statistic OGDL-Taiwan-1.0; school-coordinate COORDINATE_RIGHTS_HOLD owner-only",
  observedAt: "ROC academic year 114", acquiredAt: null, acquiredAtAvailability: "2026-08-07 processed date does not establish current enrollment or school status.",
  coverageAndMissingness: "139 statistical schools / 1,056,844 students; 159 mapped school Point, 21 null student values; one statistical school 1,054 students lacks a 113-year school point. Mapped point sum 1,055,790.",
  geometry: "113 academic-year school reference Point, bbox/attribute only; school entrance and coordinate redistribution rights not verified.", sourceSha256: "1e32c1b7bec888108b40697a1b07f88da00cd45ee42d00b2761f91989e9e4b64",
  localDisplayReceipt: "Mini and analytics processed assets byte-identical; owner-only address-free sidecar SHA a3f5d6e49294aa2ae01da43aad7dde3200c41eeb5dda05a6c228c9ed1bc57e1f. Remote release not read.",
};
VERIFIED_RAW_FAMILIES["moa:livestock_feed:20260704"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/feed_factory_points.geojson",
  evidence: ["mini:scripts/research/build-livestock-aux-owner-only.mjs", "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/feed_factory_points.geojson"],
  sourceVersion: "2026-07-04 fixed processed snapshot", publisher: "農業部 data.gov.tw 47859", license: "RIGHTS_HOLD: raw receipt and Google-derived coordinate rights unavailable; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed date is not current registration or operation status.",
  coverageAndMissingness: "258 Point deduplicated by BAN from 3,968 source product rows; source raw revision and row-level geocoding receipt unavailable.",
  geometry: "Google address geocoded proxy Point, bbox/attribute only.", sourceSha256: "b56ce8e43fa840ec7056bfe0634b810cf3415751a061bc5983af33b62e2c11ca",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA cc3c6ce7f53697586f944418f7fa75a5642f8ed5a99d682a4d08d28a1bb7483f; remote release not read.",
};
VERIFIED_RAW_FAMILIES["aphia:livestock_market:20260704"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/market_points.geojson",
  evidence: ["mini:scripts/research/build-livestock-aux-owner-only.mjs", "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/market_points.geojson"],
  sourceVersion: "2026-07-04 fixed processed snapshot", publisher: "農業部動植物防疫檢疫署", license: "RIGHTS_HOLD: raw receipt and Google-derived coordinate rights unavailable; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed date is not current market operation status.",
  coverageAndMissingness: "21 Point extracted as slaughter/auction markets; not all trading or retail facilities. Raw roster receipt unavailable.",
  geometry: "Google address geocoded proxy Point, bbox/attribute only.", sourceSha256: "ab7c4271e71aae3013750ed87109b86ceaef085f463f0667e9d36ad1e3fceb43",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA a02fba74aea449f691a6fc376f7544636c0a26db9e926918774dd60b7791bcee; remote release not read.",
};
VERIFIED_RAW_FAMILIES["aphia:livestock_slaughter:20260704"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/slaughterhouse_points.geojson",
  evidence: ["mini:scripts/research/build-livestock-aux-owner-only.mjs", "taipei-gis-analytics/data/processed/agriculture/livestock_ranch/slaughterhouse_points.geojson"],
  sourceVersion: "2026-07-04 fixed processed snapshot", publisher: "農業部動植物防疫檢疫署及縣市來源", license: "RIGHTS_HOLD: raw receipt and Google-derived coordinate rights unavailable; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed date is not current slaughterhouse operation status.",
  coverageAndMissingness: "185 Point from animal/poultry rosters plus county additions; exact raw revision and dedup receipt unavailable.",
  geometry: "Google address geocoded proxy Point, bbox/attribute only.", sourceSha256: "68dcbf1aff4323f8122e81cfe235aff4511f75dd7712eca9ca69eb2ff7dadb72",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 16dbc25b21ea640ee4aa0dca9c43416755fdfedd227430afdc441284fe06aadd; remote release not read.",
};
VERIFIED_RAW_FAMILIES["local:waste_stops:static"] = {
  sourceArtifact: "mini-taiwan-pulse/public/geo/waste_stops_static.geojson",
  evidence: ["mini:scripts/research/build-waste-stops-owner-only.mjs", "mini:public/geo/waste_stops_static.geojson"],
  sourceVersion: "fixed local static asset SHA-256", publisher: "混合縣市政府開放資料、TGOS、POI fallback 與 legacy 來源", license: "RIGHTS_HOLD: coordinate redistribution and per-source lineage not individually verified; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Static asset does not establish current collection schedule or vehicle location.",
  coverageAndMissingness: "73,060 Point; government 38,312, TGOS 30,938, POI fallback 1,135, legacy 2,675; 21 counties, merged/deduped from analytics 77,125 processed rows.",
  geometry: "Mixed-source proxy Point, bbox/attribute only; no nearest or real-time claims.", sourceSha256: "88951e69b0f6a146c88fdee8392940fce515e36b3cbaeff6a5ce8527dc47a26f",
  localDisplayReceipt: "315 owner-only gzip shards plus manifest SHA 6f1cff79722edfc4ec9a3d6c84bd01e727ed53972e3e4a6d13654e2e25cf2d16; remote release not read.",
};
VERIFIED_RAW_FAMILIES["energy:lpg_canonical:20260620"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/energy/lpg_facilities_canonical/lpg_facilities_canonical_20260620.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/energy/lpg_facilities_canonical.md", "taipei-gis-analytics/data/processed/energy/lpg_facilities_canonical/_manifest.json", "mini:scripts/research/build-lpg-owner-only.mjs"],
  sourceVersion: "2026-06-20 fixed 13-source processed snapshot", publisher: "經濟部能源署、中油與縣市政府", license: "RIGHTS_HOLD: catalog says mixed OGDL/CC BY but every processed row says OGDL; owner-only",
  observedAt: null, acquiredAt: "2026-06-20 processing date", acquiredAtAvailability: "Processing date does not establish current licensing, registration or operation.",
  coverageAndMissingness: "1,743 source rows -> 1,292 processed Point rows; only 1,201 distinct entity_id. Subpackaging 107; retailer/cstation/dealer union 567; facility_mixed-only 624 excluded from these categories.",
  geometry: "150m fuzzy-deduplicated reference Point, bbox/attribute only; no entrance or nearest claim.", sourceSha256: "a22841339ec56843b14effec9564461228c42e9c58a2df48659fa34c83a26afa",
  localDisplayReceipt: "Safe owner-only sidecars subpackaging SHA f7a4af144803aa787a47f9df9b66cdef413f4a7e4638e86338ccb8062620f7ba and retailer SHA dd13ad470858c06d6d449b683ac2ac4d596c9c105434e4ed7106be50308235ee; live Supabase display/release not read.",
};
VERIFIED_RAW_FAMILIES["waste:facilities_government:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/waste_management/waste_facilities/waste_facilities.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/waste_management/waste_facilities.md", "taipei-gis-analytics/data/processed/waste_management/waste_facilities/_manifest.json", "mini:scripts/research/build-waste-facilities-owner-only.mjs"],
  sourceVersion: "2026-05-19 fixed processed subset", publisher: "桃園、高雄、臺北等縣市及環境部政府資料", license: "RIGHTS_HOLD: mixed original/NLSC/Google coordinates and raw versions not individually verified; owner-only",
  observedAt: null, acquiredAt: "2026-05-19 processed date", acquiredAtAvailability: "Processed 66 rows may differ from later hundreds-row Supabase state; no current-operation claim.",
  coverageAndMissingness: "66 Point: incinerator 31, landfill 12, monitoring_well 17, unknown 6. Three defined categories mapped; unknown 6 not treated as wfOther. Missing later rows remain HOLD.",
  geometry: "Mixed coordinate-method proxy Point; bbox/attribute only.", sourceSha256: "2d642d9986a4d0fc22012262a655b9b024804f2f0e4d9dac3f85394d7ad25ef2",
  localDisplayReceipt: "Address-free owner-only sidecar SHA d15cba86ef1fc58c8a58553c24a22bf07327c96a481036c71d92a4ad83a7d3f9; Supabase/current display not read.",
};
VERIFIED_RAW_FAMILIES["waste:facilities_osm:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/waste_management/waste_facilities/waste_facilities_osm.geojson",
  evidence: ["taipei-gis-analytics/docs/data-catalog/waste_management/waste_facilities.md", "mini:scripts/research/build-waste-facilities-owner-only.mjs"],
  sourceVersion: "2026-05-19 fixed OSM comparison snapshot", publisher: "OpenStreetMap contributors", license: "ODbL 1.0; owner-only historical reference",
  observedAt: null, acquiredAt: "2026-05-19 processed date", acquiredAtAvailability: "Historical OSM extraction does not establish current status, capacity or completeness.",
  coverageAndMissingness: "237 Point: transfer_station 38, recycling_plant 184, scrap_yard 15; OSM comparison set, not all facilities.",
  geometry: "Crowd-edited reference Point; bbox/attribute only.", sourceSha256: "66bbb1f6a6fdde0a133c93905842665a5a1b55f776f7156b5f68a24b5c1a7e06",
  localDisplayReceipt: "Address-free owner-only sidecar SHA add89d5a1f0f1cdd1791c29e527726a6173ea3f77e887177cb006208e792edc3; no live OSM or Supabase read.",
};
VERIFIED_RAW_FAMILIES["tdx:ev_charging:20260615"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/energy/ev_charging_stations/ev_charging_stations_20260615.geojson",
  evidence: ["taipei-gis-analytics/data/processed/energy/ev_charging_stations/_manifest.json", "taipei-gis-analytics/docs/data-catalog/energy/ev_charging_stations.md", "mini:scripts/research/build-ev-charging-owner-only.mjs"],
  sourceVersion: "2026-06-15 fixed TDX EV/Station processed snapshot", publisher: "交通部 TDX", license: "TDX_RIGHTS_HOLD: coordinate redistribution receipt not verified; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed file date and catalog update are not live charging status or availability.",
  coverageAndMissingness: "3,099 TDX raw -> 3,088 normalized -> 3,060 deduplicated Point, unique station_id; city 2,947/rail 44/tourism 40/freeway 23/ship 4/airport 2. Lienchiang H400 skipped; data.gov/CPC final contribution 0.",
  geometry: "TDX published WGS84 reference Point with precision receipt missing; bbox/attribute only.", sourceSha256: "fa5ee9640717cc0cac3ed60f00b2a244c41afa2523b27d1d0ebe9fb3f826c218",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 151204d74b32e0e1a1dfa2c095fe1e806b86cae7eff7718d92964a9208a8f87f, 814,273 bytes; live Supabase release not read.",
};
VERIFIED_RAW_FAMILIES["cpc:geothermal_wells:20260615"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/energy/geothermal_wells/geothermal_wells_20260615.geojson",
  evidence: ["taipei-gis-analytics/data/raw/energy/geothermal_wells/86147.csv", "mini:scripts/research/build-geothermal-wells-owner-only.mjs"],
  sourceVersion: "2026-06-15 fixed CPC 86147 snapshot", publisher: "台灣中油股份有限公司", license: "OGDL-Taiwan-1.0; owner-only until public display version checked",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Historical fixed list; does not describe current drilling or operation.",
  coverageAndMissingness: "36 original DMS rows -> 36 WGS84 Point; 3 blank figure URLs excluded from safe sidecar.",
  geometry: "Source DMS converted to WGS84 Point and independently checked; historical well reference, not bore path or reservoir.", sourceSha256: "c5f1d58c04ba14250053aab0de7f5a30cb19bc3963db6fdf1a14bf6ba23abe15",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 39f0330f0e0971ba81d42e9014d50a0df05c866f287d4fe37d2139dc7aca1a7e, 10,888 bytes; public display version not checked.",
};
VERIFIED_RAW_FAMILIES["taipei:accident_a1_a2:2019-20260626"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/accident_taipei_dots/accident_taipei_dots_20260626.geojson",
  evidence: ["taipei-gis-analytics/data/processed/police_justice/accident_taipei_dots/_manifest.json", "taipei-gis-analytics/docs/data-catalog/police_justice/accident_taipei_dots.md", "mini:scripts/research/build-accident-taipei-owner-only.mjs"],
  sourceVersion: "2019 occurrence, 2026-06-26 fixed processed snapshot", publisher: "臺北市政府資料開放平台", license: "OGDL-Taiwan-1.0; sensitive coordinates owner-only",
  observedAt: "2019-01-01..2019-12-31", acquiredAt: null, acquiredAtAvailability: "Historic A1/A2 reported event subset, not present safety or crash rate.",
  coverageAndMissingness: "22,918 Point; A1 83, A2 22,835; raw source completeness not established.",
  geometry: "Historical reported crash reference Point; bbox/attribute only, no nearest or risk claim.", sourceSha256: "0640e94d1f16d857e502946e67eae2c7c40636ab160b7f8c9f433600cd206507",
  localDisplayReceipt: "Owner-only safe-field 20 gzip shards, manifest SHA 3e934509ba2ef24a07162955f580c9cf7502677fdad0a10f3af8e6cce4f94f3f; public display version not checked.",
};
VERIFIED_RAW_FAMILIES["moenv:regulated_facilities:20260818"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/business_registry/regulated_facilities/regulated_facilities_20260818.geojson",
  evidence: ["taipei-gis-analytics/data/processed/business_registry/regulated_facilities/_manifest.json", "taipei-gis-analytics/docs/data-catalog/business_registry/regulated_facilities.md", "mini:scripts/research/build-regulated-facilities-owner-only.mjs"],
  sourceVersion: "2026-08-18 active EMS_S_01 fixed snapshot", publisher: "環境部環境資料開放平臺", license: "OGDL-Taiwan-1.0; owner-only local sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Active at source processing time, not current regulation status.",
  coverageAndMissingness: "451,434 raw -> 127,795 active -> 80,732 located Point (63.17%); 47,063 coordinate miss. Company join coverage 50.01% is a different denominator.",
  geometry: "EMS source reference Point; bbox/attribute only, no nearest or pollution claim.", sourceSha256: "2cfa4bd59e050f7784d0dfcd1f571ca5d62c5cad78dd5073029363f31d45178f",
  localDisplayReceipt: "Owner-only safe-field 325 gzip shards, manifest SHA 82dda3a0e592e9a7ac087b9153ceaa2a7a61b651246e53f8564b289f460bd811; public display version not checked.",
};
VERIFIED_RAW_FAMILIES["taipei:street_trees_diff:2024-20260712"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/street_trees_taipei_diff/street_trees_taipei_diff_20260712.geojson",
  evidence: ["taipei-gis-analytics/data/processed/urban_open_space/street_trees_taipei_diff/_manifest.json", "taipei-gis-analytics/docs/data-catalog/urban_open_space/street_trees_taipei_diff.md", "mini:scripts/research/build-street-trees-diff-owner-only.mjs"],
  sourceVersion: "2024-11-21 Wayback baseline versus 2026-07-12 list", publisher: "臺北市政府工務局公園路燈工程管理處", license: "OGDL-Taiwan-1.0; Wayback baseline and owner-only derivation",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Wayback baseline is not official versioned history; disappeared is ID absence, not tree removal.",
  coverageAndMissingness: "99,527 Point: persisted 88,004, disappeared 7,494, appeared 4,029; 447 renumber_suspect retained.",
  geometry: "Inventory reference Point, bbox/attribute only; no current survival or tree removal inference.", sourceSha256: "95dd7c6e1cabfac3662cd3ada3a5880bd2e122208fd55224c1aaecd6ccf7d3ce",
  localDisplayReceipt: "Owner-only safe-field 32 gzip shards, manifest SHA 4d0cb1c23c040bb7b2cae3f3601d9d64e1a2f94a7cc85d431b39d6bcac792288; public display version not checked.",
};
VERIFIED_RAW_FAMILIES["mohw:aed:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/emergency_response/aed/aed_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/processed/emergency_response/aed/_manifest.json", "taipei-gis-analytics/docs/data-catalog/emergency_response/aed.md", "mini:scripts/research/build-med-aed-owner-only.mjs"],
  sourceVersion: "2026-05-24 fixed AED roster", publisher: "衛生福利部醫事司 AED 急救資訊網", license: "OGDL-Taiwan-1.0; owner-only local sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed snapshot does not establish current function, hours, or emergency access.",
  coverageAndMissingness: "15,494 raw CSV rows -> 15,490 Taiwan-range Point; 0 missing coordinates, 4 outside existing Taiwan bbox.",
  geometry: "Official WGS84 AED reference Point, bbox/attribute only until precision and operational access verified.", sourceSha256: "b4de010d5620cb52110b520d9a9980532ea9be00c755f1254e4a5a16a84bb9e6",
  localDisplayReceipt: "Owner-only safe-field 338 gzip shards, manifest SHA 325a6c959dcf4e5f00dab13aa87a646579acdefcb55f425e70cdd368c39f178c; PMTiles equivalence not checked.",
};
VERIFIED_RAW_FAMILIES["moa-tdx:ports:20260527"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/ports/ports_20260527.geojson",
  evidence: ["taipei-gis-analytics/data/processed/transportation/ports/_manifest.json", "taipei-gis-analytics/docs/data-catalog/transportation/ports.md", "mini:scripts/research/build-ports-owner-only.mjs"],
  sourceVersion: "2026-05-27 fixed port point list", publisher: "農業部漁業署與交通部 TDX", license: "Catalog OGDL-Taiwan-1.0; TDX redistribution and polygon display equivalence HOLD; owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed point list does not establish current berth, route or operational status.",
  coverageAndMissingness: "277 Point: 239 fishing, 18 ferry/tourism, 7 international, 7 domestic, 6 cross-strait without Taiwan county_id or four-bucket category.",
  geometry: "Representative port Point; separate from 277 Polygon display asset, bbox/attribute only.", sourceSha256: "80c46fd597679cbe717e2b24ac011b44b42a3514420ff4d6508fccab2c65479c",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 2c64fa271b2c48b741a268ce21f4e9a96f0a79ad7882e0a34d730cac079b864c; polygon display SHA b6163441f470f392ca94b0ee29f422fe0529eeb8c473e22c1934bf5d62a10518 is not the same source.",
};
VERIFIED_RAW_FAMILIES["nhi:medical_geocoded:20260602"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/poi/medical/nhi_institutions_geocoded.geojson",
  evidence: ["mini:scripts/research/build-nhi-medical-owner-only.mjs"],
  sourceVersion: "2026-06-02 fixed processed NHI snapshot", publisher: "中央健康保險署", license: "RIGHTS_HOLD: NHI raw license/download receipt and geocoder redistribution not verified; localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed date is not current contract or operation status.",
  coverageAndMissingness: "31,603 Point: hospital 451, clinic and other 23,472, pharmacy 7,680; TGOS 29,621, Google 1,603, Google retry 379.",
  geometry: "Address-geocoded proxy Point; bounded bbox/attribute only, no nearest or accessibility claim.", sourceSha256: "d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d",
  localDisplayReceipt: "Owner-only 248-shard manifest SHA 35f59c0e4d6fc125a5b31e60ed5894c481494b4a54b853b294842b15283a8576; legacy hospital dataset/display version not equated.",
};
VERIFIED_RAW_FAMILIES["ourairports-tdx:airports:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/transportation/airport/airports_merged_latest.geojson",
  evidence: ["mini:scripts/research/build-airports-owner-only.mjs"],
  sourceVersion: "2026-05-19 fixed merged Point snapshot", publisher: "OurAirports and TDX", license: "RIGHTS_HOLD: raw download/merge receipt and 16-polygon display equivalence unverified; localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed merge does not establish current airport operations.",
  coverageAndMissingness: "125 Point; elevation null 56, TDX airport ID null 108.",
  geometry: "Airport reference proxy Point, distinct from 16 Polygon/MultiPolygon display asset; bbox/attribute only.", sourceSha256: "d82e9fff2cd6f7eb6417f22a2155cd9958815961731c1be073b4232f5629d6c2",
  localDisplayReceipt: "Owner-only point sidecar SHA 44e9cec00cbf0ed86272409ac5a15bc24e63745936153bf47d69a9f9a18dd40f; display polygon SHA 3b68ec72035281856ece48f4e564a75c591e0275d3627fbbc7890485ab931524 is not equivalent.",
};
VERIFIED_RAW_FAMILIES["kh-education:cram_schools:20260807"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/education/cram_schools/cram_schools_20260807.geojson",
  evidence: ["taipei-gis-analytics/data/raw/education/cram_schools/city_02.json", "mini:scripts/research/build-cram-schools-owner-only.mjs"],
  sourceVersion: "2026-08-07 fixed processed roster", publisher: "高雄市教育局代管全國短期補習班系統", license: "Catalog OGDL-Taiwan-1.0; geocoded-coordinate redistribution RIGHTS_HOLD, localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Daily source cadence does not establish current registration or operation.",
  coverageAndMissingness: "17,772 raw -> 17,137 Point; 635 unlocated. Precision exact 10,100, cached 2,831, TGOS 4,129, interpolated 77.",
  geometry: "Address-geocoded proxy Point; bbox/category only, no nearest or accessibility.", sourceSha256: "adf0dddc81dc6ba30ff71c72242b4263b5a3896b7faffd40cead7ee24711af4e",
  localDisplayReceipt: "Owner-only safe-field 165 gzip shards manifest SHA 0a419219ce202574d43048eb6cb5ca7acd802e4eac0aa399fc7c4c0b46bb53fa; public display PMTiles same-version not checked.",
};
VERIFIED_RAW_FAMILIES["tainan-taoyuan:detention_basins:20260511"] = {
  sourceArtifact: "mini-taiwan-pulse/public/geo/water_detention_basins.geojson",
  evidence: ["taipei-gis-analytics/data/raw/water_resources/flood_minor/108523_tainan_detention.csv", "taipei-gis-analytics/data/raw/water_resources/flood_minor/152950_taoyuan_detention.csv", "mini:scripts/research/build-water-detention-basins-owner-only.mjs"],
  sourceVersion: "2026-05-11 fixed two-county point display snapshot", publisher: "臺南市政府水利局、桃園市政府水務局", license: "Catalog OGDL-Taiwan-1.0; localhost owner-only until public release receipt checked",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed display snapshot is not current storage or flood condition.",
  coverageAndMissingness: "56 Point: Tainan 45, Taoyuan 11; Taoyuan area_m2 null 11, township/status/capacity/depth missing 56; other counties not in this point source.",
  geometry: "Tainan TM97 transformed to WGS84, Taoyuan supplied WGS84; reference Point, not basin boundary or entrance; bbox/attribute only.", sourceSha256: "6dd46deca47a13b479ad8dede339eb1c4e14c0540b08b5b3472e1d6fc250686a",
  localDisplayReceipt: "Fixed display SHA 6dd46deca47a13b479ad8dede339eb1c4e14c0540b08b5b3472e1d6fc250686a; safe owner-only sidecar SHA c2e6713f17b24cc3c792704b486508a6c34ba2c826da8fa50bcc686fd3dad01c; raw Tainan SHA df2521430f8a76f204361e9c5300cfa83d1f5c0efa010c4f9ef7ff41333f2aab and Taoyuan SHA 7644ebf0dcec99ffcfb9621c612540874ae43237eceb4a72db5d8188a721a132.",
};
VERIFIED_RAW_FAMILIES["osm-wra:water_facilities:20260519"] = {
  sourceArtifact: "mini-taiwan-pulse/public/geo/water_facilities.geojson",
  evidence: ["taipei-gis-analytics/data/processed/water_resources/water_facilities_osm/water_facilities_osm.geojson", "taipei-gis-analytics/data/processed/water_resources/pump_stations_wra/pump_stations_wra.geojson", "mini:scripts/research/build-water-facilities-owner-only.mjs"],
  sourceVersion: "2026-05-19 fixed Mini display union", publisher: "OpenStreetMap contributors and WRA GIC", license: "OSM ODbL 1.0; WRA raw redistribution receipt unverified; localhost owner-only RIGHTS_HOLD",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "OSM fetch date and WRA raw acquisition are not in the inspected immutable receipts.",
  coverageAndMissingness: "609 Point: OSM 526 + WRA GIC 83; name empty 172, county empty 490, operator empty 458 and null 83.",
  geometry: "OSM node or way center; WRA GIC station Point transformed from EPSG:3826, mixed reference precision; bbox/attribute only.", sourceSha256: "e8174fcc90650280842c8f8b550cfd59b5ed95c63db40fb7db3a8382e034fa97",
  localDisplayReceipt: "Mini display SHA e8174fcc90650280842c8f8b550cfd59b5ed95c63db40fb7db3a8382e034fa97 matches union ID/type/source/geometry at display precision from OSM processed SHA a37739bb35a422f99169ba8fb3361508c782e9824d8128046e49b75d4527b742 (526) and WRA processed SHA edb65b22c115c303a4a4597faaa55212a77f7a4e8aedb97faada98a4c68bd99a (83). Owner sidecar SHA f00e4e3288cac3bd55d921699083a0cabf61000a2070932602f7147d06768ca3.",
};
VERIFIED_RAW_FAMILIES["wra:water_monitor_stations:20260519"] = {
  sourceArtifact: "mini-taiwan-pulse/public/geo/water_monitor_stations.geojson",
  evidence: ["taipei-gis-analytics/data/processed/water_resources/rain_gauge_stations/rain_gauge_stations.geojson", "taipei-gis-analytics/data/processed/water_resources/river_level_stations_wra/river_level_stations_wra.geojson", "taipei-gis-analytics/data/processed/water_resources/groundwater_wells/groundwater_wells.geojson", "mini:scripts/research/build-water-monitor-stations-owner-only.mjs"],
  sourceVersion: "2026-05-19 fixed Mini display union", publisher: "WRA", license: "Catalog says OGDL-Taiwan-1.0; immutable raw API and download/license receipts unverified; localhost owner-only RIGHTS_HOLD",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Three processed manifests date 2026-05-19; immutable raw payload acquisition unavailable.",
  coverageAndMissingness: "2032 Point: rain 242, river 831, groundwater 959; is_active is historical snapshot. County QA versus fixed county-reference-2025: match 1647, mismatch 360, unknown 15, outside 10.",
  geometry: "WRA EPSG:3826 transformed to EPSG:4326 reference Point; bbox/type/active only; reported_county excluded from filters and aggregate because it often conflicts with point location.", sourceSha256: "4f6ab8edb69b68e17ea15be500b117581869d1af71a0196b4ee72870326a2baf",
  localDisplayReceipt: "Mini display SHA 4f6ab8edb69b68e17ea15be500b117581869d1af71a0196b4ee72870326a2baf matches union id/type/rounded Point from rain SHA 5a4203f5914c1d325b5f5ccd89f2b953be279b88a40d50a397d3d3a4063eb34b (242), river SHA 9698f7dbb4ef3d4b4831de5f23765c6f17d9102c0f25d334a644d9cdd1ac48bb (831), groundwater SHA f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2 (959); owner-only sidecar SHA 73a653674aeddeffd0f3ad697930ff65351fea861ce545f895547a4896a341b3.",
};
VERIFIED_RAW_FAMILIES["npa:traffic_a1:20260626"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/traffic_accident_yearly/traffic_accident_yearly_20260626.geojson",
  evidence: ["taipei-gis-analytics/data/raw/police_justice/traffic_accident_yearly/npa_114_injury_177136.zip", "mini:scripts/research/build-police-justice-historical-owner-only.mjs"],
  sourceVersion: "2026-06-26 processed 2025 A1 history", publisher: "內政部警政署", license: "OGDL-Taiwan-1.0 source claim; historical precise incident locations localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Raw ZIP and processed fixed SHA; source download timestamp not separately verified.",
  coverageAndMissingness: "1600 A1 Point; selected safe fields omit location/address and people; not current accident or complete A2 history.",
  geometry: "Native source coordinates but downgraded to historical sensitive proxy Point; bbox/attribute only, no nearest/map.", sourceSha256: "732c01d31864741b482cec34fca8952d41fca56a0ceb8c9f2eff4854516f0fb4",
  localDisplayReceipt: "Mini declared display GeoJSON missing; DISPLAY_HOLD. Raw ZIP SHA bb589b97b9473b639be262183b6f2e6b256b0f52c6c28ae1770214c62bdea99e; owner-only sidecar SHA 7381ad9f678d19accc9d02b7f1cb67d4b63bc47b402ab980402b12e91e1a7dc4.",
};
VERIFIED_RAW_FAMILIES["taoyuan:theft_points:20260626"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/theft_points_taoyuan/theft_points_taoyuan_20260626.geojson",
  evidence: ["taipei-gis-analytics/data/raw/police_justice/theft_points_taoyuan/theft_167673.csv", "mini:scripts/research/build-police-justice-historical-owner-only.mjs"],
  sourceVersion: "2026-06-26 processed historical theft points", publisher: "桃園市政府", license: "OGDL-Taiwan-1.0 source claim; historical precise crime locations localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Raw CSV and processed fixed SHA; source download timestamp not separately verified.",
  coverageAndMissingness: "1423 Point; district_raw empty in all rows; year_raw mixes ROC, Gregorian, anomalous 970; source year/date excluded from filters/comparisons.",
  geometry: "Native source coordinates downgraded to historical sensitive proxy Point; bbox/attribute only, no nearest/map.", sourceSha256: "3e60392a46a65efd06bbc4b9803713908bab44b98b3930e5ac4709d461e69572",
  localDisplayReceipt: "Mini declared display GeoJSON missing; DISPLAY_HOLD. Raw CSV SHA 20ff5ed3f07afd711ef2b0586c3127b17503c36403959163626b05ac527ba657; owner-only sidecar SHA fc30d85d930c2c4e93bbbebb0ef94dbcd8d2afdbfe268ae98341482601e9c6e3.",
};
VERIFIED_RAW_FAMILIES["local-ae:fire_hydrants:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/fire/hydrants/hydrants.csv",
  evidence: ["taipei-gis-analytics/data/processed/fire/hydrants/_manifest.json", "mini:scripts/research/build-fire-hydrants-owner-only.mjs"],
  sourceVersion: "2026-05-19 A/E processed CSV snapshot", publisher: "data.gov.tw 128639 and five Kaohsiung sources", license: "Catalog OGDL-Taiwan-1.0; localhost owner-only fixed snapshot, remote/public release not verified",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed manifest fixed 2026-05-19; original acquisition timestamp and remote release not independently verified.",
  coverageAndMissingness: "69839 unique Point: A 30444 plus E 39395; source address empty 52173 and district empty 69839, both excluded from safe sidecar. Taipei XML 21852 is alternative source, not additive; DB 69815 is different deduplicated version.",
  geometry: "Processed CSV WGS84 reference Point, proxy; bbox/attribute only; no nearest or fire service coverage.", sourceSha256: "ca71db6e0c927368d1480ce11dca9919a4c46f3b7e252548adfe05850fa941ea",
  localDisplayReceipt: "Local dist fire_hydrants.geojson 69839 rows SHA d683c309…7b53 byte-for-byte regenerates from fixed CSV; PMTiles/remote source-SHA receipt unverified. Immutable owner-only manifest SHA 668101cade6c8f0f86e76089855df0af43e9de9a232a4428ee87090199b65bdf.",
};
VERIFIED_RAW_FAMILIES["wra:groundwater_wells_static:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/water_resources/groundwater/groundwater_wells.geojson",
  evidence: ["mini:scripts/research/build-groundwater-wells-owner-only.mjs", "mini:src/research/groundwaterWellsOwnerDataset.ts"],
  sourceVersion: "2026-05-19 processed static station snapshot", publisher: "WRA OpenData", license: "Catalog OGDL-Taiwan-1.0; localhost owner-only, no public release claim",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed snapshot fixed SHA; immutable raw API payload and acquisition receipt unavailable.",
  coverageAndMissingness: "959 Point stations, elevation_m null 959 and is_active false 959; dynamic water-level observations are outside this source.",
  geometry: "WRA processed reference Point, proxy; bbox/attribute only. reported_county not eligible for geographic filtering or county comparison.", sourceSha256: "f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2",
  localDisplayReceipt: "Source 959 Point ID/name/geometry matches the groundwater subset of fixed Mini water_monitor_stations display; owner-only partition manifest SHA 2cd44a610c1c284d9de2fee054c95bb26a8eeba5bac3757af0754f6f3a0b3967. groundwaterWells dynamic display or readings not independently verified.",
};
VERIFIED_RAW_FAMILIES["moea:agri_retail_companies:20260525"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/agri_retail_companies/agri_retail_companies.geojson",
  evidence: ["mini:scripts/research/build-agri-retail-owner-only.mjs", "mini:src/research/agriRetailOwnerDataset.ts"],
  sourceVersion: "2026-05-25 processed fixed snapshot", publisher: "經濟部商業發展署 data.gov.tw:45618", license: "OGDL-Taiwan-1.0 catalog; TGOS derived coordinate redistribution not verified, localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Raw and processed checksums fixed; original acquisition timestamp and remote release not independently verified.",
  coverageAndMissingness: "58,613 raw; 37,789 approved; 359 TGOS misses; 37,430 Point. Missing geocodes are absent from the spatial sidecar.",
  geometry: "TGOS address-geocoded reference Point, proxy; bbox/attribute only, no nearest or current-business claims.", sourceSha256: "9e1e02a0678b66b30a69496325c4afb74624c28dced16aa1990d4b79c1b5ec37",
  localDisplayReceipt: "Owner-only partition manifest SHA b5c9d4cc5f480bd616f3c9788c5a9c89b90b8f444b3fcc4927e833c9dfe45a60; displayed layer equivalence and map readback unverified.",
};
VERIFIED_RAW_FAMILIES["moea:produce_wholesale_companies:20260525"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/produce_wholesale_companies/produce_wholesale_companies.geojson",
  evidence: ["mini:scripts/research/build-agri-produce-wholesale-owner-only.mjs", "mini:src/research/agriProduceWholesaleOwnerDataset.ts"],
  sourceVersion: "2026-05-25 processed fixed snapshot", publisher: "經濟部商業發展署 data.gov.tw:45655", license: "OGDL-Taiwan-1.0 catalog; TGOS derived coordinate redistribution not verified, localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Raw/processed SHA fixed; original acquisition timestamp and public release not independently verified.",
  coverageAndMissingness: "35,218 raw; 23,046 approved; 203 TGOS misses; 22,843 Point. Missing geocodes absent from spatial sidecar.",
  geometry: "TGOS address-geocoded reference Point, proxy; bbox/attribute only, no nearest or current-business claim.", sourceSha256: "95891f3dfef06431bdb49b04e72503c1de865ffb5704da50179bad6564e25008",
  localDisplayReceipt: "Mini local GeoJSON symlink points to original checkout same processed SHA; PMTiles and remote release not independently checked. Owner partition manifest SHA 357a881d906ea0c8f734677117e1fc007d1bb4b98cccd1039fa73948f577cb89.",
};
VERIFIED_RAW_FAMILIES["moi:religion_temples:20260801-trust-chain"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/religion/temples/temples_20260801.geojson",
  evidence: ["taipei-gis-analytics/data/processed/religion/temples/_manifest.json", "mini:scripts/research/build-religion-temples-owner-only.mjs", "mini:src/research/religionTemplesOwnerDataset.ts"],
  sourceVersion: "2026-08-01 mixed-source trust-chain snapshot", publisher: "MOI religion registry, BOCH, MOI Top 100, OSM contributors", license: "OGDL official inputs; OSM ODbL attribution and Google geocode redistribution HOLD, localhost owner-only",
  observedAt: null, acquiredAt: "2026-08-01", acquiredAtAvailability: "MOI/OSM raw snapshots fixed SHA; BOCH/Top100 fixed local inputs, present operation not verified.",
  coverageAndMissingness: "19,201 Point merged entities: MOI-family 12,499 plus OSM-only 6,702. MOI original 507 missing coordinates, 503 backfilled; 2 unresolved absent. Source/bbox absence is not no temple.",
  geometry: "Mixed original/OSM/geocoded reference Point, proxy; no nearest, entrance, current registration or national-completeness claim.", sourceSha256: "ee6c5549b35bc76dbf4ac22ee0ce5dd6a4684b5269af416cf43cfc6736f2207e",
  localDisplayReceipt: "Owner-only partition manifest SHA c6eece8825ee30e241762dea9db2a662860e97f5e6201e98ed1791bf210451ac. PMTiles source equivalence and research map readback unverified.",
};
VERIFIED_RAW_FAMILIES["taipei-taichung:street_trees:20260714"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/street_trees_national/street_trees_national_20260714.geojson",
  evidence: ["taipei-gis-analytics/data/processed/urban_open_space/street_trees_national/_manifest.json", "mini:scripts/research/build-street-trees-national-owner-only.mjs", "mini:src/research/streetTreesNationalOwnerDataset.ts"],
  sourceVersion: "2026-07-14 mixed Taipei/Taichung merged snapshot", publisher: "Taipei and Taichung open data", license: "Upstream catalogs OGDL-Taiwan-1.0; localhost owner-only fixed sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Taipei 2026-07-12 source snapshot; Taichung 2016-2019 survey and 2020 map. Not a simultaneous nationwide release.",
  coverageAndMissingness: "210,436 Point: Taipei 92,033, Taichung 118,403 only. Taichung 61,321 park/plaza records; empty location_type 13,121, empty survey_date 1; absence elsewhere is no coverage, not zero trees.",
  geometry: "Merged municipal tree-register reference Point, proxy; bbox/attribute only, no nearest, service area or national comparison.", sourceSha256: "a9b2e18ec60e2444bc263bb0bf1c9ee804b66a7a62064a38affb6a7890f6de99",
  localDisplayReceipt: "Owner-only partition manifest SHA b1fc01a0908d8b18169b5cd774da4d1f3824d7f7c81671f09615108f3c1b99e3; PMTiles and research map readback unverified.",
};
VERIFIED_RAW_FAMILIES["mohw:ltc_contract_units:20260811"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/poi/long_term_care/long_term_care_20260811.geojson",
  evidence: ["mini:scripts/research/build-med-ltc-owner-only.mjs", "mini:src/research/medLtcOwnerDataset.ts"],
  sourceVersion: "2026-08-11 fixed contract-unit snapshot", publisher: "衛生福利部 data.gov.tw:88270", license: "OGDL-Taiwan-1.0 catalog; localhost owner-only fixed sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "2026-08 source release; current contracts and capacity not independently verified.",
  coverageAndMissingness: "24,409 raw rows: 332 no coordinates, 183 outside Taiwan; 23,894 Point. Processed A 824, B 22,510, C 559, empty ABCType 1. Distinct from 3,117 welfareLtcInstitutions.",
  geometry: "Official WGS84 reference Point, proxy; bbox/attribute only. No nearest, current service, capacity or county comparison.", sourceSha256: "950efd652c8d504ff593e48fc5119835349150cca8d58a7546447e637acd37ac",
  localDisplayReceipt: "Owner-only partition manifest SHA 93cbd6a1986e8cfa2711e1fce86a3950e06d57122520fc9c2e26db4431434c42; displayed-layer equivalence and research map readback unverified.",
};
VERIFIED_RAW_FAMILIES["gsmma:active_fault_sensitive_zones:local-fixed"] = {
  sourceArtifact: "mini-taiwan-pulse/public/geo/active_faults.geojson",
  evidence: ["taipei-gis-analytics/data/raw/environment/earthquake/active_faults_sensitive_zones.geojson", "mini:src/research/activeFaultsDataset.ts"],
  sourceVersion: "Byte-identical local raw and display snapshot imported 2026-03-06; source observation date unknown", publisher: "經濟部地質調查及礦業管理中心 data.gov.tw:27744", license: "OGDL-Taiwan-1.0; official announced documents prevail over reference boundaries",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Local import date is not observation or official revision date.",
  coverageAndMissingness: "22 fixed Polygon/MultiPolygon features; official catalog 23 includes superseded F0011. Absence does not prove no hazard or legal restriction.",
  geometry: "Full horizontal Polygon/MultiPolygon rings retained as MultiPolygon; zero third ordinate removed. Actual surface intersection, not distance or risk analysis.", sourceSha256: "a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e",
  localDisplayReceipt: "Mini static GeoJSON and analytics raw are byte-identical 2,632,866 bytes, SHA a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e; browser readback separately required.",
};
VERIFIED_RAW_FAMILIES["taipei:tree_pits:20260714"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/urban_open_space/tree_pits_taipei/tree_pits_taipei_20260714.geojson",
  evidence: ["mini:scripts/research/build-tree-pits-taipei-owner-only.mjs", "mini:src/research/treePitsTaipeiOwnerDataset.ts"],
  sourceVersion: "2026-07-14 fixed processed snapshot; live official raw resource byte-identical on 2026-09-26", publisher: "臺北市政府工務局公園路燈工程管理處", license: "OGDL-Taiwan-1.0; localhost owner-only reader",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "2026-07-14 is processed snapshot date, not confirmed source observation time.",
  coverageAndMissingness: "56,720 MultiPolygon features: 50,904 tree pits, 5,816 flower beds, one zero-area record. Absence is not zero trees.",
  geometry: "Full WGS84 MultiPolygon, including multipart and holes; actual surface intersection, not centroid or single-tree locations.", sourceSha256: "72197a37c4446a456effa722eb1e6a96e4c200e1c71343322857f7455c13000e",
  localDisplayReceipt: "Official raw SHA 9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03; owner-only manifest SHA 84abb47a9ee0a05b1a5d76aa6540e50044502e9ab8c2666d0545b1396fa6351c. Browser map readback pending.",
};
VERIFIED_RAW_FAMILIES["tdx:cycling_shapes:20260301"] = {
  sourceArtifact: "taipei-gis-analytics/data/raw/transportation/cycling_shapes/cycling_shapes_raw_20260301.json",
  evidence: ["taipei-gis-analytics/data/processed/transportation/bike/cycling_shapes_all.geojson", "mini:public/geo/cycling_routes.geojson", "mini:src/research/cyclingRoutesDataset.ts"],
  sourceVersion: "TDX Cycling Shape fixed local raw 2026-03-01", publisher: "交通部 TDX and city contributors", license: "TDX catalog OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Raw file date is local snapshot naming, not every route's observation or completion date.",
  coverageAndMissingness: "1,749 MultiLineString in 20 cities; Town blank 536 and literal NULL 1; CyclingType literal NULL in all 1,749; AuthorityName literal NULL in 1,748; FinishedTime processing has known ROC conversion errors and is withheld.",
  geometry: "Complete WGS84 MultiLineString with 97,275 numeric 2D vertices; bbox intersects actual line, not centroid or road-network accessibility.", sourceSha256: "d190b049ef2c9f46134c230d043b090edb84e64bf56cc393d2fa282edf896d19",
  localDisplayReceipt: "Mini cycling_routes.geojson is byte-identical to analytics cycling_shapes_all.geojson: 4,384,551 bytes, SHA 690190820456105ac3aa92133c4fc7e222703e365a36c726fec20c5b2060bcba. Paired browser Taipei line result revision 11 ready/readback 4 and visible.",
};
VERIFIED_RAW_FAMILIES["moa:forest_recreation_areas:1151"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/forestry/forest_recreation_areas/forest_recreation_areas.geojson",
  evidence: ["mini:scripts/research/build-forest-recreation-owner-only.mjs", "mini:src/research/forestRecreationOwnerDataset.ts"],
  sourceVersion: "1151 fixed local processed snapshot, 2026-05-19", publisher: "農業部林業及自然保育署 data.gov.tw:9931", license: "OGDL-Taiwan-1.0; localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Edition and processing date do not establish current park opening or access.",
  coverageAndMissingness: "23 designated area features, 19 Polygon and 4 MultiPolygon; park and district_code source nulls retained. No result does not prove no forest or recreation.",
  geometry: "Full WGS84 polygon surfaces normalized to MultiPolygon; true bbox intersection, not entrance, trail or accessibility.", sourceSha256: "bb7e1604918d3329e554c44788f9c376985f4c4707ae37d19cb0aedb0dd49c05",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 815448720c3c12d2ae41898a445f6f4c42fb86e9f1f4a9c9cc0dea8d9580cacc; browser Hehuanshan ready/readback 1 actual surface, source display-layer version not independently matched.",
};
VERIFIED_RAW_FAMILIES["moa:aquaculture_production_zone:20260519"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/agriculture/aquaculture_production_zone/aquaculture_production_zone.geojson",
  evidence: ["mini:scripts/research/build-aquaculture-zone-owner-only.mjs", "mini:src/research/aquacultureZoneOwnerDataset.ts"],
  sourceVersion: "2026-05-19 fixed local processed snapshot", publisher: "農業部漁業署", license: "OGDL-Taiwan-1.0; localhost owner-only",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processed snapshot date is not zone legal effective date or current operation.",
  coverageAndMissingness: "62 designated production-zone features across 11 counties, source area 18,676.7 ha; absent geometry is not zero aquaculture.",
  geometry: "Full WGS84 Polygon/MultiPolygon normalized to MultiPolygon for true bbox intersection; not a production, operation or access measure.", sourceSha256: "3096bf94ac94a98b642bd011e846ab7b886807b0bfe8c01fd8cb4aae05fcdb8e",
  localDisplayReceipt: "Owner-only safe-field sidecar SHA 6290797c86b1403334e6a3bcc8ae01dce7337e5706135178636cbd01eae9a42a; paired browser Mailiao result revision 14 ready/readback 1 and visible. Existing source display-layer version remains unverified.",
};
VERIFIED_RAW_FAMILIES["osm:service_area_surfaces:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/raw/transportation/service_area/osm_services_raw.json",
  evidence: ["taipei-gis-analytics/data/processed/transportation/service_area_polygon/service_area_polygon_20260524.geojson", "mini:public/geo/service_area_polygon.geojson", "mini:src/research/serviceAreaPolygonDataset.ts"],
  sourceVersion: "2026-05-24 fixed OSM Overpass and Highway Bureau join", publisher: "© OpenStreetMap contributors; 交通部高速公路局", license: "OSM ODbL 1.0 geometry plus OGDL-Taiwan-1.0 attributes; attribution required",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Processing date is not each OSM edit date or current service status.",
  coverageAndMissingness: "19 OSM service-area surfaces (18 Polygon, 1 MultiPolygon), not identical to 22 official Point records; no match is not zero service areas.",
  geometry: "Full OSM-drawn WGS84 Polygon/MultiPolygon normalized to MultiPolygon; true bbox intersection, not entrance or road-network reachability.", sourceSha256: "9047b532d2ac1425735d278a7ed91dff573264a488be8c0f8c869882f29df863",
  localDisplayReceipt: "Mini public GeoJSON byte-identical to analytics processed 24,463 bytes SHA c9f2a462c30ecbfd99fec7f15cd55371112add6ece074a76a881db4186fd84a8; paired browser Dongshan revision 15 ready/readback 1 and visible.",
};
VERIFIED_RAW_FAMILIES["tgos:campus_polygon:20260807"] = {
  sourceArtifact: "taipei-gis-analytics/data/raw/education/campus_polygon/campus_121.zip",
  evidence: ["taipei-gis-analytics/data/processed/education/campus_polygon/campus_polygon_20260807.geojson", "mini:public/education/campus_polygon.pmtiles", "mini:scripts/research/build-campus-polygon-owner-only.mjs", "mini:src/research/campusPolygonOwnerDataset.ts"],
  sourceVersion: "2026-08-07 fixed TGOS campus polygon pipeline snapshot", publisher: "內政部國土測繪中心 TGOS", license: "Source catalog OGDL-Taiwan-1.0; localhost owner-only research sidecar",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Source YYYYMM varies per record and is distinct from pipeline date; not current school operation.",
  coverageAndMissingness: "4,336 source Polygon: 12 non_school remain queryable but display excludes them; school_level_zh null 12 experimental. 20 counties; Penghu and Kinmen source gaps.",
  geometry: "Full WGS84 TGOS school campus reference Polygon, true bbox intersection; not entrance, catchment or walking route.", sourceSha256: "14fdbec063543c260059f662c380be80ae6f1285c6967e5d35896b11c514eb48",
  localDisplayReceipt: "Processed GeoJSON SHA 950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff; Mini PMTiles SHA 3735e97933bef4f93d163a607d902607c1c008f1481ad3f674ca4120d74e3f15 byte-identical to analytics tile artifact, but tile is not analytical source. Owner-only manifest SHA 3e7158e6013dd72e33a3dd6f0b51d5f0078054c46b604c4c12b8f5ed07af4232; paired browser Taipei Tatung surface revision 16 ready/readback 1 and visible.",
};
VERIFIED_RAW_FAMILIES["tycg_kcg:aviation_noise_legal_villages:20260827"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/environment/aviation_noise_zones/aviation_noise_zones.geojson",
  evidence: ["taipei-gis-analytics/data/raw/environment/aviation_noise_zones/taoyuan_26115.csv", "taipei-gis-analytics/data/raw/environment/aviation_noise_zones/kaohsiung_107165.json", "taipei-gis-analytics/data/processed/demographics/village_boundary/village_boundary_20260626.geojson", "mini:public/environment/aviation_noise_zones.geojson", "mini:src/research/aviationNoiseZonesDataset.ts"],
  sourceVersion: "Taoyuan source metadata 2026-05-07, Kaohsiung 2025-09-24, NLSC village boundary 2026-06-26; processed fixed snapshot 2026-08-27", publisher: "桃園市政府環境保護局、高雄市政府民政局；geometry from NLSC", license: "OGDL-Taiwan-1.0; static local read",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Source metadata updates and build date do not establish legal effective date; all 76 effective_date values are null.",
  coverageAndMissingness: "103 legal village-level memberships collapsed to 76 unique village features: Taoyuan 31 (58 memberships), Kaohsiung 45 (45); 4 explicit aliases, 0 unmatched. Outside these two city lists is unverified, not no aircraft noise.",
  geometry: "NLSC WGS84 village Polygon boundary joined to legal village membership: admin_join proxy, not a measured DNL contour or point exposure; spatial analysis ineligible.", sourceSha256: "d17515936bc357ce3602473c2768ebd2e1647d39f8660c8e32133dbbb661bb51",
  localDisplayReceipt: "Raw SHA Taoyuan 28dbe5367c5fc456aa03bc033ad4fc8c83e0defdbee6ce47b597b623711d17fe; Kaohsiung fcadf3fbadcfac912ba96223a4140c085e134fd38fd66bd4bd6e3b3c7affb1ee; NLSC boundary 4b5832c1fdf066945fa121c9a31c20e858d8deb4198dae2afab4db9889231d99. Mini and analytics processed GeoJSON byte-identical 1,072,567 bytes SHA d17515936bc357ce3602473c2768ebd2e1647d39f8660c8e32133dbbb661bb51; paired browser readback pending.",
};
VERIFIED_RAW_FAMILIES["mota:national_scenic_areas:20260524"] = {
  sourceArtifact: "taipei-gis-analytics/data/processed/tourism/scenic_area/scenic_area_20260524.geojson",
  evidence: ["taipei-gis-analytics/data/raw/tourism/scenic_area/nsa_gist_00.zip", "taipei-gis-analytics/data/processed/tourism/scenic_area/_manifest.json", "mini:public/tourism/national_scenic_areas_national.geojson", "mini:src/research/scenicAreasDataset.ts"],
  sourceVersion: "2026-05-24 fixed pipeline snapshot; 12 national scenic-area surfaces selected from 34 processed records", publisher: "交通部觀光署; Gist backup of official SHP", license: "OGDL-Taiwan-1.0",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Pipeline date is not individual boundary observation or current legal designation date.",
  coverageAndMissingness: "12 national scenic areas and 22 forest recreation areas in processed source; Mini national display selects the 12 by category and independently matches names, geometry and source attributes. 雲嘉南濱海國家風景區 is absent from upstream backup. Display-only visitors/yoy fields lack a source receipt and are withheld.",
  geometry: "Full WGS84 Polygon/MultiPolygon source surface normalized to 2D MultiPolygon; only zero Z values removed. True bbox intersection, not entrance or walking accessibility.", sourceSha256: "d1fbd0b12f7e5cbea4f5c3e059f8c0638c9d1a936bb6036d89896c6fe54cc544",
  localDisplayReceipt: "Mini national_scenic_areas_national.geojson 12 rows, 200,445 bytes SHA 9910b7329a361247989b91f50ebda63762e557411eae13dda6f1ead997384e38; browser readback pending.",
};
const welfareFamilies = [
  ["welfare:ltc:20260812", "welfareLtcInstitutions", "ltc_institutions", "ltc_institutions_national.geojson", "876b771afdb69676a342750f215fbfdaffd4cdfeaf4b73704d4297a2591c72cb", "3,117 Point; TGOS subset 3,053, Google 29, offline 35"],
  ["welfare:elderly:20260812", "welfareElderlyHomes", "elderly_care_homes", "elderly_care_homes_national.geojson", "0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f", "1,160 Point; TGOS subset 1,043, Google 33, offline 84"],
  ["welfare:childcare:20260812", "welfareChildcare", "childcare_centers", "childcare_centers_national.geojson", "34511cde4fd56b742623c54df7e807c135289c72efd90db1578d18c407423786", "1,578 Point; TGOS 1,354, Google 221, offline 3"],
  ["welfare:disability:20260812", "welfareDisability", "disability_facilities", "disability_facilities_national.geojson", "1317b144b57c19f8a580ee617b23f1e88adaee81ff271c0e3c9d405e21b001f6", "334 Point; TGOS 306, Google 7, offline 21; mixed raw source IDs 12061/130229/161606/165355"],
  ["welfare:social_work:20260812", "welfareSocialWorkOrgs", "social_work_orgs", "social_work_orgs_national.geojson", "697c1eced0ae73e04768606cc2b326b08bd1d76050d8aa4320c539e5c97a1e19", "587 Point; TGOS 551, Google 26, offline 10; organization addresses are not service sites"],
];
for (const [key, , folder, file, sha, coverage] of welfareFamilies) VERIFIED_RAW_FAMILIES[key] = {
  sourceArtifact: `mini-taiwan-pulse/public/welfare/${file}`,
  evidence: [`taipei-gis-analytics/data/processed/welfare/${folder}/_manifest.json`, "mini:scripts/research/build-welfare-geocoded-owner-only.mjs", "mini:scripts/research/build-welfare-care-points-sidecars.mjs"],
  sourceVersion: "2026-08-12 fixed mixed-coordinate assembly", publisher: "衛福部與逐列登記來源", license: "Raw source license varies by src_datasets; Google/offline coordinate redistribution RIGHTS_HOLD, owner-only full reader",
  observedAt: null, acquiredAt: null, acquiredAtAvailability: "Fixed assembly is not current licensing, operation, capacity or availability.",
  coverageAndMissingness: coverage, geometry: "Mixed TGOS/Google/offline reference Point; full owner-only reader bbox/attribute only. TGOS-only public subset is distinct.",
  sourceSha256: sha, localDisplayReceipt: "Research reader query receipt exists; current display is not proven same-version.",
};
const VERIFIED_RAW_FAMILY_BY_LAYER = {
  pollutionSite: "moenv:pollution_sites:EMS_S_07:20260706",
  pollutionFacility: "moenv:pollution_facilities:EMS_S_01:20260706",
  pollutionPenaltyCritical: "moenv:pollution_penalties:EMS_P_46:20260706",
  pollutionPenaltyGeneral: "moenv:pollution_penalties:EMS_P_46:20260706",
  pollutionPenaltyMobile: "moenv:pollution_penalties:EMS_P_46:20260706",
  noiseEnforcementEvents: "moenv:pollution_penalties:EMS_P_46:20260706",
  publicLibraries: "ncl:public_libraries:20260717",
  coastGuardStation: "coast_guard:stations:20260626",
  culturalMuseums: "moc:local_cultural_museums:20260716",
  performingVenues: "moc:performing_venues:20260716",
  speedCamera: "traffic:speed_cameras:20260824",
  fireStations: "fire:stations:20260710",
  ...Object.fromEntries(welfareFamilies.map(([key, layer]) => [layer, key])),
  welfareChildServices: "welfare:child_services:20260812",
  artsEvents: "moc:arts_events:20260716",
  stationsTHSR: "rail:stations:20260529-local",
  stationsTRA: "rail:stations:20260529-local",
  stationsMetro: "rail:stations:20260529-local",
  ...Object.fromEntries(justiceFamilies.map(([folder, layer]) => [layer, `police_justice:${folder}:20260626`])),
  ...Object.fromEntries(busStationFamilies.map(([key, layer]) => [layer, key])),
  taxiStand: "transport:taxi_stands:20260524",
  etcGantry: "transport:etc_gantry:20260524",
  factoryLocations: "business_registry:factory_locations:202606",
  ...Object.fromEntries(educationChildcareFamilies.map(([folder, layer]) => [layer, `moe:${folder}:20260807`])),
  ...Object.fromEntries(tourismHospitalityFamilies.map(([folder, layer]) => [layer, `mota:${folder}:202607`])),
  civilDefenseShelter: "police_justice:civil_defense_shelters:20260824",
  tourFactories: "moi:tourism_factory:20260723",
  bikeStations: "tdx:bike_stations:20260301-fixed",
  weatherStations: "cwa:weather_stations:20251129-fixed",
  agriWholesaleMarket: "moea:agri_wholesale_market_companies:20260522",
  womenChildWarning: "npa:women_child_warning:20260626",
  cctv: "tdx:road_cctv:20260524-fixed",
  ...Object.fromEntries(funeralFamilies.map(([folder, layer]) => [layer, `moi:${folder}:20260805`])),
  ...Object.fromEntries(religionFamilies.map(([folder, layer, date]) => [layer, `moi:religion:${folder}:${date}`])),
  mountainHuts: "mountain:huts:20260801",
  mountainRescueIncidents: "nfa:mountain_rescue:2019-2024",
  welfareNursingHomes: "mohw:nursing_homes:20260812",
  commonRegistrationAddresses: "moea:common_registration_addresses:202608-r2",
  canopyGiants: "meta_wri:canopy_height:20260724",
  serviceArea: "highway_bureau:service_area:20260524",
  parksTaipei: "city:parks:20260705",
  tourHeritage: "boch:heritage:20260524",
  tourEvents: "mota:activity:20260722",
  protectedTreesNational: "cities:protected_trees:20260714",
  riversideTreesTaipei: "taipei:riverside_trees:20260714",
  treePitsTaipei: "taipei:tree_pits:20260714",
  cyclingRoutes: "tdx:cycling_shapes:20260301",
  forestRecreation: "moa:forest_recreation_areas:1151",
  aquacultureZone: "moa:aquaculture_production_zone:20260519",
  serviceAreaPolygon: "osm:service_area_surfaces:20260524",
  eduCampusPolygon: "tgos:campus_polygon:20260807",
  eduCampusArea: "tgos:campus_polygon:20260807",
  aviationNoiseZones: "tycg_kcg:aviation_noise_legal_villages:20260827",
  tourScenicAreas: "mota:national_scenic_areas:20260524",
  forestTreatmentWorks: "moa:forest_treatment_works:20260802",
  forestWildlife: "moa:forest_wildlife_grid:20260607",
  eduUniversityStudents: "moe:university_students:114",
  livestockFeed: "moa:livestock_feed:20260704",
  livestockMarket: "aphia:livestock_market:20260704",
  livestockSlaughter: "aphia:livestock_slaughter:20260704",
  livestockFarmCattle: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmChicken: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmDuck: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmGoose: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmOther: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmPig: "moa:livestock_farms:20260705-enriched-v3",
  livestockFarmSheep: "moa:livestock_farms:20260705-enriched-v3",
  wasteStopsStatic: "local:waste_stops:static",
  lpgSubpackaging: "energy:lpg_canonical:20260620",
  lpgRetailers: "energy:lpg_canonical:20260620",
  wfIncinerator: "waste:facilities_government:20260519",
  wfLandfill: "waste:facilities_government:20260519",
  wfMonitoring: "waste:facilities_government:20260519",
  wfTransfer: "waste:facilities_osm:20260519",
  wfRecycling: "waste:facilities_osm:20260519",
  wfScrapYard: "waste:facilities_osm:20260519",
  evChargingStations: "tdx:ev_charging:20260615",
  geothermalWells: "cpc:geothermal_wells:20260615",
  accidentTaipei: "taipei:accident_a1_a2:2019-20260626",
  regulatedFacilities: "moenv:regulated_facilities:20260818",
  streetTreesTaipeiDiff: "taipei:street_trees_diff:2024-20260712",
  medAED: "mohw:aed:20260524",
  ports: "moa-tdx:ports:20260527",
  medHospital: "nhi:medical_geocoded:20260602",
  medClinic: "nhi:medical_geocoded:20260602",
  medPharmacy: "nhi:medical_geocoded:20260602",
  airports: "ourairports-tdx:airports:20260519",
  eduCramSchool: "kh-education:cram_schools:20260807",
  waterDetentionBasins: "tainan-taoyuan:detention_basins:20260511",
  waterFacilities: "osm-wra:water_facilities:20260519",
  waterMonitorStations: "wra:water_monitor_stations:20260519",
  trafficAccidentYearly: "npa:traffic_a1:20260626",
  theftTaoyuan: "taoyuan:theft_points:20260626",
  fireHydrants: "local-ae:fire_hydrants:20260519",
  groundwaterWells: "wra:groundwater_wells_static:20260519",
  agriRetail: "moea:agri_retail_companies:20260525",
  agriProduceWholesale: "moea:produce_wholesale_companies:20260525",
  religionTemples: "moi:religion_temples:20260801-trust-chain",
  streetTreesNational: "taipei-taichung:street_trees:20260714",
  medLTC: "mohw:ltc_contract_units:20260811",
  activeFaults: "gsmma:active_fault_sensitive_zones:local-fixed",
  eduSchoolElementary: "moe:schools:113-academic-year",
  eduSchoolJunior: "moe:schools:113-academic-year",
  eduSchoolSenior: "moe:schools:113-academic-year",
  eduSchoolUniversity: "moe:schools:113-academic-year",
  eduSchoolSpecial: "moe:schools:113-academic-year",
  eduRemoteSchools: "moe:schools:113-academic-year",
  gasStationCanonical: "energy:gas_stations_canonical:20260620",
  gasStationCpc: "energy:gas_stations_canonical:20260620",
  gasStationFpcc: "energy:gas_stations_canonical:20260620",
  gasStationOther: "energy:gas_stations_canonical:20260620",
  gasStationTaisugar: "energy:gas_stations_canonical:20260620",
  policeStation: "police_justice:police_stations:20260626",
  companyPoints: "business_registry:company_stock:202608",
  manufacturingCompanyPoints: "business_registry:company_stock:202608",
  companyCapitalGrid: "business_registry:company_stock:202608",
  companyAgeStructure: "business_registry:company_stock:202608",
  companyIndustryDistribution: "business_registry:company_stock:202608",
  countyBoundary: "nlsc:county_boundary:COUNTY_MOI_1140318",
  forestRoads: "moa:forest_roads:datagov-38213",
};
const DISPLAY_RAW_ALIGNMENT_BY_LAYER = {
  pollutionSite: {
    status: "LOCAL_DISPLAY_RELEASE_MATCH_WITH_ATTRIBUTE_CONFLICT",
    evidence: "Original-mini pollution_sites.pmtiles and analytics pollution_sites_20260706.pmtiles both SHA dca3c37cf0a05a85b3c08d96310caa22aca01472b31a55f0a2c22a8992d7f9ba. 8,253 site IDs and Points match staged original and frontend GeoJSONSeq; research sidecar restores 1,568 decimal sitearea values truncated in frontend/display contract. Remote runtime release was not read.",
  },
  pollutionFacility: {
    status: "LOCAL_RAW_TO_DISPLAY_PROVEN",
    evidence: "Original-mini pollution_facilities.pmtiles and analytics pollution_facilities_20260706.pmtiles both SHA cec5cda2a0ccff4dcdab829f4719903ffe111728278792bbcd2089282778599b. Fixed frontend GeoJSONSeq SHA 7aa3c25b…985f9; remote runtime release unread and per-record geocode precision unavailable.",
  },
  gasStationCanonical: {
    status: "POINT_IDENTITY_MATCH_ATTRIBUTE_CONFLICT",
    evidence: "Original-checkout static RPC SHA c3f6c231…53ca has 3,053 canonical rows matching processed 20260620 names, brand membership and Point coordinates to 6 decimals; 443 ODbL source rows are mislabeled OGDL in static RPC. The fixed research sidecar retains correct per-row mixed license; display attributes need repair before claiming full alignment.",
  },
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
for (const key of ["gasStationCpc", "gasStationFpcc", "gasStationOther", "gasStationTaisugar"]) {
  DISPLAY_RAW_ALIGNMENT_BY_LAYER[key] = DISPLAY_RAW_ALIGNMENT_BY_LAYER.gasStationCanonical;
}
const VERIFIED_RAW_FAMILY_BY_DATASET = {
  dgbas_county_transport_supply_10935: "dgbas:county_transport_supply:2023-2024",
  jp_water_ksj: "mlit:ksj_water:inspected-20260918",
  network_performance_grid: "ookla:network_performance:2026q1",
  all_venues: "sports:all_venues:20260704",
  segis_taipei_bicycle_usage_township_110: "segis:3792EA_1D2:2021",
  schools: "moe:schools:113-academic-year",
};
Object.assign(VERIFIED_RAW_FAMILIES, {
  "police_justice:police_stations:20260626": {
    sourceArtifact: "taipei-gis-analytics/data/processed/police_justice/police_stations/police_stations_20260626.geojson",
    sourceArtifactRole: "canonical processed trust-chain assembly from data.gov.tw 5958, 24419 and 168315; three raw ZIP/CSV files, not one original raw table",
    evidence: ["taipei-gis-analytics/data/processed/police_justice/police_stations/_manifest.json", "taipei-gis-analytics/docs/data-catalog/police_justice/police_stations.md"],
    sourceVersion: "20260626", publisher: "內政部警政署與嘉義市政府", license: "OGDL-Taiwan-1.0",
    observedAt: null, acquiredAt: null, acquiredAtAvailability: "fetched_at=2026-06-26 in all processed rows is pipeline retrieval, not today's facility status",
    coverageAndMissingness: "2,065 Point rows, 1,860 distinct entity_id values; 205 repeated ID rows retained. Six inferred facility subtypes; name, subtype, source and geometry have no nulls in inspected processed artifact.",
    geometry: "EPSG:4326 Point from transformed TWD97 TM2 and WGS84 source; coordinates are facility reference points, not service areas or access entrances.",
    sourceSha256: "63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7",
  },
  "energy:gas_stations_canonical:20260620": {
    sourceArtifact: "taipei-gis-analytics/data/processed/energy/gas_stations_canonical/gas_stations_canonical_20260620.geojson",
    sourceArtifactRole: "canonical derived assembly serving five station map layers; six upstream processed inputs, not one raw original",
    evidence: ["taipei-gis-analytics/docs/data-catalog/energy/gas_stations_canonical.md", "mini-taiwan-pulse/public/static-rpc/get_fossil_fuel_layers.json"],
    sourceVersion: "20260620", publisher: "中油、台糖、經濟部商業司與 OSM 貢獻者的 trust-chain 合併",
    license: "mixed OGDL-Taiwan-1.0 / ODbL 1.0; attribution and ODbL obligations apply",
    observedAt: null, acquiredAt: null, acquiredAtAvailability: "2026-06-20 is the assembly/fetched_at snapshot, not an independently verified observation time",
    coverageAndMissingness: "3,053 canonical Point entities from 6,342 upstream records after 80m spatial deduplication; 2,610 highest-tier records OGDL, 443 ODbL; brand guesses can overlap and unknown is not absence.",
    geometry: "EPSG:4326 Point, 3,053/3,053 present; highest-tier contributing coordinate, not an entrance or surveyed facility boundary.",
    sourceSha256: "00ee5b007a680788c25d1c4e1abf2da2628b776aec1a4644904f49a7dff15c80",
  },
  "taiwan:gas_stations:20260615": {
    sourceArtifact: "taipei-gis-analytics/data/raw/energy/gas_stations/", evidence: ["taipei-gis-analytics/data/processed/energy/gas_stations/_manifest.json", "taipei-gis-analytics/docs/data-catalog/energy/gas_stations.md"],
    sourceVersion: "20260615", publisher: "台灣中油與臺中市政府 data.gov.tw sources", license: "OGDL-Taiwan-1.0",
    observedAt: null, acquiredAt: null, acquiredAtAvailability: "not recorded in inspected manifest/catalog",
    coverageAndMissingness: "660 government source records deduplicated to 573 coordinate-valid Point features; not a full national all-brand census.", geometry: "Point, EPSG:4326; records lacking coordinates are omitted.", sourceSha256: null,
  },
  "moa:livestock_farms:20260705-enriched-v3": {
    sourceArtifact: "mini-taiwan-pulse/public/agriculture/livestock_farms.geojson",
    sourceArtifactRole: "local enriched fallback; current display route is an owner-only get_livestock_farms RPC whose release has not been read",
    evidence: ["mini-taiwan-pulse/docs/features/livestock/handoff.md", "mini-taiwan-pulse/docs/features/owner-gated-layers/README.md", "mini:scripts/research/build-livestock-farms-owner-only.mjs", "mini:src/research/livestockFarmsOwnerDatasets.ts", "taipei-gis-analytics/docs/data-catalog/agriculture/livestock_farms.md"],
    sourceVersion: "enriched v3 / 2026-07-05 batch01+02+03", publisher: "農業部 ARIS with NLSC/twland and EMS/Google coordinate enrichment",
    license: "catalog claims OGDL-Taiwan-1.0; EMS/Google-derived coordinate public-use clearance still needs per-record verification; product route owner-only",
    observedAt: null, acquiredAt: "2026-07-05", acquiredAtAvailability: "catalog records acquisition date, not current farm operation",
    coverageAndMissingness: "13,087 local Point rows; 12,271 high, 47 medium, 769 low-precision coordinates. ARIS batch coverage is partial; missing farms are not zero. Seven livestock species filters share this source.",
    geometry: "EPSG:4326 Point; low precision may be village/section centroid rather than a farm location.",
    sourceSha256: "41c3244b7eff050697fd746282d79b5c75c688960fa38c3c644b80e241819e13",
    localDisplayReceipt: "13,087 Point Mini fallback is source SHA identical; owner-only partition manifest SHA ce3d6fb33205cfc47da8fb8f0de30e2d48c650054b52fd96a6712d0dffab8b0a. Current get_livestock_farms RPC release and map readback unverified.",
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
  waste_facilities: { status: "EVIDENCE_GAP", reason: "2026-05-19 processed files contain 66 government Points plus 237 OSM comparison Points, while catalog says Supabase later held hundreds more; some coordinates came from Google geocoding. No complete same-version table receipt, public coordinate-use clearance, or nine-filter reconciliation was found." },
  gas_stations: { status: "EVIDENCE_GAP", reason: "legacy manifest datasetId conflates 573 curated points (20260615) with 3,053 canonical entities (20260620) and four road-distance coverage surfaces; exact layer-level lineage overrides this navigation ID" },
  livestock_farms: { status: "RIGHTS_HOLD", familyKey: "moa:livestock_farms:20260705-enriched-v3", reason: "local SHA-identified enriched fallback exists, but current route is owner-only RPC with unread release; EMS/Google coordinate rights and partial ARIS coverage prevent public research reader" },
  feed_factories: { status: "RIGHTS_HOLD", reason: "258 processed Points from MOA 47859 (2026-07-04); all coordinates use Google address geocoding, with no inspected public coordinate-use clearance or preserved source CSV in this checkout. Attribute-only public fields may be considered after source receipt audit." },
  livestock_markets: { status: "RIGHTS_HOLD", reason: "21 processed Points from APHIA slaughter list (2026-07-04); coordinates use Google address geocoding, with no inspected public coordinate-use clearance or original list receipt in this checkout." },
  slaughterhouses: { status: "RIGHTS_HOLD", reason: "185 processed Points from APHIA plus county lists (2026-07-04); coordinates use Google address geocoding, with no inspected public coordinate-use clearance or original list receipts in this checkout. Current UI route is owner-only." },
  dgbas_county_transport_supply_10935: { status: "VERIFIED_RAW_LINEAGE", familyKey: "dgbas:county_transport_supply:2023-2024" },
  jp_medical_reports: { status: "EVIDENCE_GAP", reason: "no analytics catalog/processed manifest found in this pass" },
  jp_water_ksj: { status: "RIGHTS_HOLD", familyKey: "mlit:ksj_water:inspected-20260918", reason: "only W09 is a commercial/public candidate; other source shards retain non-commercial/re-distribution holds" },
  osm_power: { status: "EVIDENCE_GAP", reason: "catalog found but no inspected immutable raw/release receipt in this pass" },
  pollution_source: { status: "MIXED_UPSTREAM_FAMILIES", reason: "This navigation ID combines EMS_S_07 contaminated sites, EMS_S_01 regulated facilities, and EMS_P_46 penalty events. All three have separate verified 20260706 local readers; penalty events are owner-only local bbox/attribute queries because address_osm coordinate redistribution rights remain under review. Proxy coordinates do not support exact-nearest claims." },
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
  const singleDatasetCounts = new Map();
  for (const layer of candidates) {
    const ids = layer.upstream?.datasetIds ?? [];
    if (ids.length === 1) singleDatasetCounts.set(ids[0], (singleDatasetCounts.get(ids[0]) ?? 0) + 1);
  }
  const entries = layers.map(layer => {
    const family = familyEvidence(layer);
    const comparisonRecipe = comparisonRecipeByLayer.get(layer.layerKey);
    const singleDatasetId = layer.upstream?.datasetIds?.length === 1 ? layer.upstream.datasetIds[0] : null;
    const declaredContract = comparisonRecipe !== undefined
      ? {
        kind: "derived_statistics_recipe", key: "derived:comparison_statistics", evidence: "Exact layer_key in comparisonStatisticsRecipes.json; common runtime recipe contract, not a common raw source or verified release",
        datasetId: comparisonRecipe.dataset_id, indicatorId: comparisonRecipe.indicator_id, level: comparisonRecipe.level,
        boundaryVersion: comparisonRecipe.boundary_version, releaseIds: comparisonRecipe.release_options.map(option => option.release_id),
      }
      : singleDatasetId !== null && (singleDatasetCounts.get(singleDatasetId) ?? 0) > 1
        ? { kind: "declared_upstream_dataset", key: `declared-upstream:${singleDatasetId}`, evidence: "Same manifest upstream datasetId across candidate layers; raw bytes/RPC schema and release identity are not implied", datasetId: singleDatasetId }
        : null;
    const datasetInspections = (layer.upstream?.datasetIds ?? []).map(datasetId => ({ datasetId, ...(INSPECTED_UPSTREAM_DATASETS[datasetId] ?? { status: "NOT_INSPECTED" }) }));
    const datasetFamilyKeys = [...new Set(datasetInspections.map(item => item.familyKey).filter(Boolean))];
    // Gas coverage surfaces use station points as an input plus a road-distance build.
    // Sharing that input does not make their output the station-point raw family.
    const derivedGasCoverage = layer.layerKey.startsWith("gasCoverage");
    const verifiedRawFamilyKey = derivedGasCoverage ? null
      : VERIFIED_RAW_FAMILY_BY_LAYER[layer.layerKey] ?? (datasetFamilyKeys.length === 1 ? datasetFamilyKeys[0] : null);
    const alignment = DISPLAY_RAW_ALIGNMENT_BY_LAYER[layer.layerKey] ?? null;
    const defaultBlocker = p0Blocker(layer, family);
    const inspectionRightsHold = datasetInspections.some(item => item.status === "RIGHTS_HOLD");
    const blocker = layer.readable === "registered"
      ? {
        status: "QUERYABLE_REGISTERED",
        primaryBlocker: "FULL_SOURCE_TO_DISPLAY_RUNTIME_EVIDENCE_NOT_AUDITED",
        nextStep: "Retain the registered query contract, then audit source/version, coverage, nulls, geometry and displayed runtime receipt before calling this layer spatial-ready.",
      }
      : comparisonRecipe !== undefined
      ? {
        status: "READER_PENDING", primaryBlocker: "DERIVED_RELEASE_SOURCE_AUDIT_AND_READER_PENDING",
        nextStep: "Inspect each exact releaseId artifact's numerator/denominator source receipts, units, null rules, period, and boundary version; reconcile publication status and register a bounded query reader. The common comparison runtime is not one raw source.",
      }
      : derivedGasCoverage
      ? {
        status: "READER_PENDING", primaryBlocker: "DERIVED_ROAD_DISTANCE_RELEASE_UNVERIFIED",
        nextStep: "Verify the exact station input, OSRM road-network/version, distance-grid build receipt and cell values for this derived coverage surface; station-point queryability cannot substitute for grid sampling.",
      }
      : singleDatasetId === "waste_facilities"
      ? {
        status: "SOURCE_MISSING", primaryBlocker: "WASTE_FACILITIES_COMPLETE_RELEASE_AND_COORDINATE_RIGHTS_MISSING",
        nextStep: "Reconcile the nine layer filters against a fixed complete Supabase/raw release, 66 government plus 237 OSM processed rows, and later geocoded records; isolate Google-derived coordinates until public-use rights are verified.",
      }
      : singleDatasetId === "livestock_farms"
      ? {
        status: "RIGHTS_HOLD", primaryBlocker: "OWNER_ONLY_RPC_AND_MIXED_COORDINATE_USE_HOLD",
        nextStep: "Keep seven farm filters owner-only. Reconcile the fixed local 13,087 Point fallback with the actual get_livestock_farms RPC release, verify EMS/Google coordinate-use rights per record, and retain partial ARIS coverage and low-precision centroid labels before any public research reader.",
      }
      : inspectionRightsHold
      ? {
        status: "RIGHTS_HOLD",
        primaryBlocker: "SOURCE_LICENSE_OR_USE_CLEARANCE_HOLD",
        nextStep: `Obtain source and coordinate-use clearance before public spatial reader work; inspect missing original/raw receipts. ${datasetInspections.filter(item => item.status === "RIGHTS_HOLD").map(item => item.reason ?? "").join(" ")}`,
      }
      : alignment?.status === "POINT_IDENTITY_MATCH_ATTRIBUTE_CONFLICT"
      ? {
        status: "VERSION_MISMATCH",
        primaryBlocker: "DISPLAY_SOURCE_LICENSE_ATTRIBUTE_CONFLICT",
        nextStep: "Retain the verified research source but repair and verify the five-layer display/static RPC license attributes and ODbL attribution before claiming source-to-display alignment or public-release acceptance.",
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
    const localAsset = {
      status: family.sourceArtifact === null ? "NO_DECLARED_LOCAL_ASSET" : "DECLARED_LOCAL_ASSET_CHECKED",
      evidence: family.sourceArtifact === null
        ? "No declared local display artifact was available for an existence check."
        : "Declared local display assets were checked only for worktree/original-checkout presence and bytes; this does not establish raw lineage or display success.",
      assets: localDisplayAssetEvidence(family.sourceArtifact),
    };
    const remoteVersion = {
      status: "REMOTE_VERSION_NOT_READ",
      evidence: "No remote release/version receipt was read by this local-only audit.",
      localAlignment: alignment,
    };
    const query = {
      status: layer.readable === "registered"
        ? "QUERYABLE_REGISTERED"
        : layer.blocker === "QUERY_ACCESS_DISABLED"
          ? "QUERY_DISABLED"
          : layer.readable === "metadata_candidate_requires_readback"
            ? "NO_REGISTERED_QUERY_METADATA_READBACK_CANDIDATE"
            : "NO_REGISTERED_QUERY",
      evidence: layer.evidenceBasis,
      datasetIds: layer.datasetIds,
      descriptors: layer.descriptors,
    };
    const displayed = {
      status: family.sourceArtifact === null ? "NO_DECLARED_DISPLAY_ASSET" : "DISPLAY_CONTRACT_DECLARED_NOT_OBSERVED",
      evidence: family.sourceArtifact === null
        ? "The manifest declares no concrete display asset for this layer."
        : "Manifest display asset declaration and local file presence are not browser/runtime display readback.",
      manifestSourceContract: layer.manifestSourceContract,
    };
    return {
      layerKey: layer.layerKey,
      label: layer.label,
      candidateClass: layer.readable === "metadata_candidate_requires_readback"
        ? "metadata_geojson_candidate"
        : layer.readable === "unknown_or_unavailable"
          ? "unknown_or_unavailable"
          : layer.readable === "registered"
            ? "registered_queryable"
            : "registered_query_disabled",
      familyKey: family.familyKey,
      sourceArtifact: family.sourceArtifact,
      localDisplayAssetEvidence: localAsset.assets,
      sourceEvidence: family.evidence,
      declaredContract,
      verifiedRawFamilyKey,
      displayRawAlignment: alignment,
      evidence: { localAsset, remoteVersion, query, displayed },
      upstreamDatasetInspections: datasetInspections,
      analyticsNavigation: analyticsNavigation(layer.upstream?.datasetIds ?? []),
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
  const candidateEntries = entries.filter(entry => entry.candidateClass === "unknown_or_unavailable" || entry.candidateClass === "metadata_geojson_candidate");
  const familyCounts = new Map();
  const allLayerFamilyCounts = new Map();
  for (const entry of candidateEntries) familyCounts.set(entry.familyKey, (familyCounts.get(entry.familyKey) ?? 0) + 1);
  for (const entry of entries) allLayerFamilyCounts.set(entry.familyKey, (allLayerFamilyCounts.get(entry.familyKey) ?? 0) + 1);
  const verifiedRawFamilyKeys = [...new Set(candidateEntries.map(entry => entry.verifiedRawFamilyKey).filter(Boolean))].sort();
  const allLayerVerifiedRawFamilyKeys = [...new Set(entries.map(entry => entry.verifiedRawFamilyKey).filter(Boolean))].sort();
  const contractKeys = [...new Set(candidateEntries.map(entry => entry.declaredContract?.key).filter(Boolean))];
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
    evidenceBoundary: "familyKey groups only exact manifest-declared display asset tuples and remains navigation evidence. verifiedRawFamilyKey is separate and appears only for analytics lineage inspected in this P0 slice; it does not prove mini display-asset version alignment, remote release presence, query success, displayed runtime, or analysis eligibility. Per-entry evidence keeps local asset, remote version, query, and displayed claims distinct.",
    counts: {
      allLayers: entries.length,
      candidateLayers: candidateEntries.length,
      unknownOrUnavailable: candidateEntries.filter(item => item.candidateClass === "unknown_or_unavailable").length,
      metadataGeojsonCandidates: candidateEntries.filter(item => item.candidateClass === "metadata_geojson_candidate").length,
      queryableLayers: entries.filter(item => item.candidateClass === "registered_queryable").length,
      queryDisabledLayers: entries.filter(item => item.primaryBlocker === "QUERY_ACCESS_DISABLED").length,
      sourceFamilyKeys: familyCounts.size,
      sharedSourceFamilyKeys: [...familyCounts.values()].filter(count => count > 1).length,
      singletonOrUnresolvedFamilyKeys: [...familyCounts.values()].filter(count => count === 1).length,
      verifiedRawFamilyKeys: verifiedRawFamilyKeys.length,
      allLayerVerifiedRawFamilyKeys: allLayerVerifiedRawFamilyKeys.length,
      entriesWithVerifiedRawFamily: candidateEntries.filter(entry => entry.verifiedRawFamilyKey !== null).length,
      entriesWithoutVerifiedRawFamily: candidateEntries.filter(entry => entry.verifiedRawFamilyKey === null).length,
      declaredContractFamilyKeys: contractKeys.length,
      entriesWithDeclaredContractFamily: candidateEntries.filter(entry => entry.declaredContract !== null).length,
      derivedComparisonLayers: candidateEntries.filter(entry => entry.declaredContract?.kind === "derived_statistics_recipe").length,
      repeatedUpstreamDatasetLayers: candidateEntries.filter(entry => entry.declaredContract?.kind === "declared_upstream_dataset").length,
      entriesWithDeclaredDisplayAsset: candidateEntries.filter(entry => entry.localDisplayAssetEvidence.length > 0).length,
      displayAssetEntriesPresentInWorktree: candidateEntries.filter(entry => entry.localDisplayAssetEvidence.length > 0 && entry.localDisplayAssetEvidence.every(item => item.worktree?.exists)).length,
      displayAssetEntriesPresentInOriginalCheckout: candidateEntries.filter(entry => entry.localDisplayAssetEvidence.length > 0 && entry.localDisplayAssetEvidence.every(item => item.originalCheckout?.exists)).length,
      inspectedUpstreamDatasetIds: inspectedDatasetEntries.length,
      inspectedUpstreamDatasetEvidenceGaps: inspectedDatasetEntries.filter(([, item]) => item.status === "EVIDENCE_GAP").length,
      sourceMissingWithProcessedManifest: candidateEntries.filter(entry => entry.status === "SOURCE_MISSING" && entry.analyticsNavigation.some(item => item.processedManifests.length > 0)).length,
      sourceMissingWithCatalog: candidateEntries.filter(entry => entry.status === "SOURCE_MISSING" && entry.analyticsNavigation.some(item => item.catalogDocs.length > 0)).length,
    },
    families: [...familyCounts.entries()].map(([familyKey, layerCount]) => ({ familyKey, layerCount })).sort((a, b) => a.familyKey.localeCompare(b.familyKey)),
    allLayerFamilies: [...allLayerFamilyCounts.entries()].map(([familyKey, layerCount]) => ({ familyKey, layerCount })).sort((a, b) => a.familyKey.localeCompare(b.familyKey)),
    verifiedRawFamilies: Object.fromEntries(allLayerVerifiedRawFamilyKeys.map(key => [key, VERIFIED_RAW_FAMILIES[key]])),
    declaredContractFamilies: contractKeys.map(key => ({ key, layerCount: candidateEntries.filter(entry => entry.declaredContract?.key === key).length })).sort((a, b) => b.layerCount - a.layerCount || a.key.localeCompare(b.key)),
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

function classifiedUnknownCsv(ledger) {
  const unknown = ledger.entries.filter(entry => entry.candidateClass === "unknown_or_unavailable");
  if (unknown.length !== report.counts.layersUnknownOrUnavailable || new Set(unknown.map(entry => entry.layerKey)).size !== unknown.length) {
    throw new Error("P0_UNKNOWN_LAYER_RECONCILIATION_FAILED");
  }
  const columns = ["layerKey", "label", "status", "primaryBlocker", "declaredContractFamilyKey", "verifiedRawFamilyKey", "upstreamDatasetIds", "analyticsProcessedManifests", "analyticsCatalogDocs", "displayAssets", "displayAssetWorktreePresence", "displayAssetOriginalCheckoutPresence", "rawSourceArtifact", "geometryVerification", "nextStep"];
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = unknown.map(entry => [
    entry.layerKey, entry.label, entry.status, entry.primaryBlocker,
    entry.declaredContract?.key, entry.verifiedRawFamilyKey,
    (entry.upstream?.datasetIds ?? []).join(";"),
    entry.analyticsNavigation.flatMap(item => item.processedManifests.map(manifest => manifest.path)).join(";"),
    entry.analyticsNavigation.flatMap(item => item.catalogDocs).join(";"),
    (entry.sourceArtifact ?? []).map(item => `${item.kind}:${item.path}`).join(";"),
    entry.localDisplayAssetEvidence.map(item => item.worktree?.exists ? "present" : "absent").join(";"),
    entry.localDisplayAssetEvidence.map(item => item.originalCheckout?.exists ? "present" : "absent_or_unchecked").join(";"),
    entry.verifiedRawFamilyKey ? JSON.stringify(ledger.verifiedRawFamilies[entry.verifiedRawFamilyKey]?.sourceArtifact ?? null) : null,
    entry.geometry.verification, entry.nextStep,
  ]);
  return `${[columns, ...rows].map(row => row.map(quote).join(",")).join("\n")}\n`;
}

function familyLedgerMarkdown(ledger) {
  const unknown = ledger.entries.filter(entry => entry.candidateClass === "unknown_or_unavailable");
  const statuses = new Map();
  const blockers = new Map();
  for (const entry of unknown) {
    statuses.set(entry.status, (statuses.get(entry.status) ?? 0) + 1);
    blockers.set(entry.primaryBlocker, (blockers.get(entry.primaryBlocker) ?? 0) + 1);
  }
  const missing = unknown.filter(entry => entry.status === "SOURCE_MISSING");
  const hasProcessed = entry => entry.analyticsNavigation.some(item => item.processedManifests.length > 0);
  const hasCatalog = entry => entry.analyticsNavigation.some(item => item.catalogDocs.length > 0);
  const lines = [
    `# ${unknown.length} 個尚無可用查詢映射的圖層：逐層處置（${auditOptions.date}）`, "",
    "由 runtime manifest、research registry 與已檢查的來源收據產生。JSON 保留全部 manifest layer 的完整欄位；`.unknown.csv` 只列本次 594 個 unknown/unavailable，一層一列。狀態是目前證據下的處置，不是線上來源健康或發布驗收。", "",
    `全部 ${ledger.counts.allLayers} 層中，${ledger.counts.candidateLayers} 層維持候選處置、${ledger.counts.queryableLayers} 層為已註冊 queryable、${ledger.counts.queryDisabledLayers} 層有 descriptor 但 query disabled。每層的 local asset、remote version、query、displayed 證據分列；其中 QUERYABLE_REGISTERED 不等於 SPATIAL_READY。`, "",
    `778 個 manifest layer 中，${report.counts.layersWithQueryableDatasets} 個有查詢映射、${report.counts.lazyGeojsonCandidates} 個是待讀回的 GeoJSON metadata candidates、${unknown.length} 個尚無可用映射；三者合計 ${report.counts.manifestLayers}。`, "",
    "## 主要狀態", "", "| 狀態 | 層數 |", "|---|---:|",
    ...[...statuses].sort((a, b) => b[1] - a[1]).map(([status, count]) => `| ${status} | ${count} |`), "",
    "## 具體阻擋", "", "| 阻擋 | 層數 |", "|---|---:|",
    ...[...blockers].sort((a, b) => b[1] - a[1]).map(([blocker, count]) => `| ${blocker} | ${count} |`), "",
    "`comparisonStatisticsRecipes.json` 明列 188 個比較統計圖層、indicator 與 releaseId；共同的是派生 runtime 契約，並非一份原始資料。逐 release 的分子／分母來源尚未全量稽核，也未註冊有界 research reader，逐層維持 `READER_PENDING`。同一 `upstream.datasetId` 的圖層另列 declared contract family；這只證明 manifest 宣告相同，不證明同一 raw SHA、RPC schema 或 release。", "",
    `${missing.length} 個 SOURCE_MISSING 中，${missing.filter(entry => hasProcessed(entry) && hasCatalog(entry)).length} 個可找到 analytics processed manifest 與 catalog、${missing.filter(entry => !hasProcessed(entry) && hasCatalog(entry)).length} 個只有 catalog、${missing.filter(entry => !hasProcessed(entry) && !hasCatalog(entry) && entry.upstream?.datasetIds?.length).length} 個有上游 ID 卻未找到同名本機證據、${missing.filter(entry => !hasProcessed(entry) && !hasCatalog(entry) && !entry.upstream?.datasetIds?.length).length} 個連上游 ID 也未宣告。這些是**導航線索**，沒有一項自動證明 raw input、授權或 release 同版。`, "",
    "## 宣告的共用契約（前 25 個）", "", "| 契約 | 層數 | 證據等級 |", "|---|---:|---|",
    ...ledger.declaredContractFamilies.slice(0, 25).map(item => `| ${item.key} | ${item.layerCount} | manifest/recipe only |`), "",
    "真正已核對的 raw family 另見 JSON `verifiedRawFamilies`，且仍需逐層檢查 display 同版、權限、時間、缺值與 geometry。不得把宣告 family 或 PMTiles 視為完整可分析原表。",
    "", "本機資產欄位只查工作樹與原 checkout 的檔案存在及大小；缺少本機檔不等於遠端缺檔，存在亦不證明 raw→display 同版或查詢可用。",
  ];
  return `${lines.join("\n")}\n`;
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
  await writeFile(`${auditOptions.familyLedgerBase}.unknown.csv`, classifiedUnknownCsv(ledger));
  await writeFile(`${auditOptions.familyLedgerBase}.md`, familyLedgerMarkdown(ledger));
  outputs.push(`${auditOptions.familyLedgerBase}.json`, `${auditOptions.familyLedgerBase}.unknown.csv`, `${auditOptions.familyLedgerBase}.md`);
  ledgerCounts = ledger.counts;
}
console.log(JSON.stringify({ output: outputs, counts: report.counts, familyLedgerCounts: ledgerCounts }, null, 2));
