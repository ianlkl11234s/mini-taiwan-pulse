import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ANALYTICS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const INPUTS = [
  { key: "government", relative: "data/processed/waste_management/waste_facilities/waste_facilities.geojson", sha256: "2d642d9986a4d0fc22012262a655b9b024804f2f0e4d9dac3f85394d7ad25ef2", rows: 66, filename: "waste-facilities-government-owner-20260519.geojson", types: { landfill: 12, incinerator: 31, monitoring_well: 17, unknown: 6 } },
  { key: "osm", relative: "data/processed/waste_management/waste_facilities/waste_facilities_osm.geojson", sha256: "66bbb1f6a6fdde0a133c93905842665a5a1b55f776f7156b5f68a24b5c1a7e06", rows: 237, filename: "waste-facilities-osm-owner-20260519.geojson", types: { transfer_station: 38, recycling_plant: 184, scrap_yard: 15 } },
];

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const canonical = value => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
const same = (actual, expected) => JSON.stringify(Object.fromEntries([...actual.entries()].sort())) === JSON.stringify(canonical(expected));

function governmentFeature(feature, ordinal) {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !point(feature.geometry) || !p || typeof p.city !== "string" || typeof p.facility_name !== "string"
    || typeof p.facility_type !== "string" || typeof p.operator !== "string" || typeof p.source_url !== "string"
    || (p.ingested_at !== undefined && typeof p.ingested_at !== "string") || (p.geocoded_via !== undefined && typeof p.geocoded_via !== "string")) fail("WASTE_FACILITIES_GOVERNMENT_FEATURE_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: {
    record_ordinal: ordinal, city: p.city, facility_name: p.facility_name, facility_type: p.facility_type, operator: p.operator,
    source_ref: p.source_url, ingested_at: p.ingested_at ?? null, coordinate_method: p.geocoded_via ?? null,
  } };
}

function osmFeature(feature, ordinal) {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !point(feature.geometry) || !p || typeof p.city !== "string" || typeof p.facility_type !== "string"
    || typeof p.status !== "string" || typeof p.source !== "string" || typeof p.source_url !== "string" || typeof p.osm_type !== "string"
    || !["string", "object"].includes(typeof p.facility_name) || !["string", "object"].includes(typeof p.operator)
    || p.facility_name !== null && typeof p.facility_name !== "string" || p.operator !== null && typeof p.operator !== "string") fail("WASTE_FACILITIES_OSM_FEATURE_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: {
    record_ordinal: ordinal, city: p.city, facility_name: p.facility_name, facility_type: p.facility_type, operator: p.operator,
    status: p.status, source: p.source, source_ref: p.source_url, osm_type: p.osm_type,
  } };
}

const [root = ANALYTICS_ROOT, output = "../runtime/owner-only/waste-facilities"] = process.argv.slice(2);
const outputRoot = resolve(output);
const receipt = { schemaVersion: "pulse-waste-facilities-owner-only/1", snapshotDate: "2026-05-19", inputs: {}, outputs: {}, holds: {
  completeRelease: "The processed government artifact has 66 rows but the catalog records later Supabase imports at hundreds of rows; it is a fixed incomplete reference, not a current complete inventory.",
  coordinateRights: "Government rows include NLSC and Google geocoding; original per-row coordinate provenance and redistribution rights are incomplete. Owner-only only.",
  unmappedLayerTypes: ["wfLandfillCoastal", "wfMedical", "wfOther"],
} };

for (const input of INPUTS) {
  const bytes = await readFile(resolve(root, input.relative));
  if (digest(bytes) !== input.sha256) fail(`WASTE_FACILITIES_${input.key.toUpperCase()}_SHA_MISMATCH`);
  const collection = JSON.parse(bytes.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== input.rows) fail(`WASTE_FACILITIES_${input.key.toUpperCase()}_COUNT_MISMATCH`);
  const features = collection.features.map(input.key === "government" ? governmentFeature : osmFeature);
  const types = new Map();
  for (const feature of features) types.set(feature.properties.facility_type, (types.get(feature.properties.facility_type) ?? 0) + 1);
  if (!same(types, input.types)) fail(`WASTE_FACILITIES_${input.key.toUpperCase()}_TYPE_SEMANTICS_MISMATCH`);
  const serialized = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
  const path = resolve(outputRoot, input.filename);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized);
  receipt.inputs[input.key] = { path: resolve(root, input.relative), sha256: input.sha256, rows: input.rows, facilityTypes: input.types };
  receipt.outputs[input.key] = { path, sha256: digest(serialized), rows: features.length, bytes: serialized.length, facilityTypes: input.types };
}
await writeFile(resolve(outputRoot, "manifest-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
