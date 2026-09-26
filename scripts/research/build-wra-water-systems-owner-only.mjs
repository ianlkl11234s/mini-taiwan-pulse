import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const sourceRelative = "data/processed/water_resources/dam_weirs_wra/dam_weirs_wra.geojson";
const SOURCE_SHA256 = "61dc48810045e75de5d1097eb1fca541f20e526949284809131dea2cbae59455";
const SOURCE_COUNT = 98;
const SAFE_FIELDS = ["source_dam_id", "name_en", "dam_elev_m", "dam_height_m", "dam_length_m", "capacity_m3"];

const fail = code => { throw new Error(code); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
function nullableString(value) { if (typeof value !== "string") fail("WRA_DAMS_SOURCE_PROPERTY_TYPE_INVALID"); return value || null; }
function nullableNumber(value) { if (value === null) return null; if (typeof value !== "number" || !Number.isFinite(value)) fail("WRA_DAMS_SOURCE_PROPERTY_TYPE_INVALID"); return value; }
function point(value) { return value?.type === "Point" && Array.isArray(value.coordinates) && value.coordinates.length === 2 && value.coordinates.every(part => typeof part === "number" && Number.isFinite(part)) && value.coordinates[0] >= 118 && value.coordinates[0] <= 122.5 && value.coordinates[1] >= 21.5 && value.coordinates[1] <= 26.5; }
function safeFeature(raw, ordinal) {
  const p = raw?.properties;
  if (raw?.type !== "Feature" || !point(raw.geometry) || !p || typeof p !== "object" || Array.isArray(p)
    || typeof p.id !== "string" || !/^wra:\d+$/.test(p.id) || typeof p.name_en !== "string"
    || !["dam_elev_m", "dam_height_m", "dam_length_m", "capacity_m3"].every(field => p[field] === null || typeof p[field] === "number" && Number.isFinite(p[field]))) fail("WRA_DAMS_SOURCE_FEATURE_INVALID");
  return { type: "Feature", sourceOrdinal: ordinal, geometry: raw.geometry, properties: { source_dam_id: p.id, name_en: nullableString(p.name_en), dam_elev_m: nullableNumber(p.dam_elev_m), dam_height_m: nullableNumber(p.dam_height_m), dam_length_m: nullableNumber(p.dam_length_m), capacity_m3: nullableNumber(p.capacity_m3) } };
}

async function build(root, outputArg) {
  const source = await readFile(resolve(root, sourceRelative)); if (hash(source) !== SOURCE_SHA256) fail("WRA_DAMS_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("WRA_DAMS_SOURCE_COUNT_MISMATCH");
  const nulls = { name_en: 0, dam_elev_m: 0, dam_height_m: 0, dam_length_m: 0, capacity_m3: 0 }; let duplicateSourceId = 0;
  const sourceIds = new Set(); const features = collection.features.map((raw, ordinal) => { const feature = safeFeature(raw, ordinal); if (sourceIds.has(feature.properties.source_dam_id)) duplicateSourceId++; sourceIds.add(feature.properties.source_dam_id); for (const key of Object.keys(nulls)) if (feature.properties[key] === null) nulls[key]++; return feature; });
  if (Object.values(nulls).some(value => value !== 25 && value !== 36)) fail("WRA_DAMS_SOURCE_NULL_SEMANTICS_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/wra-water-systems"); const temporary = `${output}.building`; await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const sidecar = json({ type: "FeatureCollection", features }); const sidecarSha256 = hash(sidecar); const path = "wra-dam-weirs-owner-20260519.geojson"; await writeFile(resolve(temporary, path), sidecar);
  const receipt = { schemaVersion: "pulse-wra-water-systems-owner-only/1", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference: `/research/wra-dam-weirs/source-identity/sha256-${SOURCE_SHA256}` }, snapshot: "2026-05-19", publisher: "經濟部水利署地理資訊中心 WRA GIC", upstream: { fname: "SWRESOIR", license: "OGDL-Taiwan-1.0" }, safeFields: SAFE_FIELDS, nullCounts: nulls, sourceIdDuplicateRows: duplicateSourceId, excludedFields: ["name", "dam_type", "dam_class", "status", "purpose", "county", "basin_name", "river_name", "org", "date_start", "source"], geometry: "Official source WGS84 Point retained. It is a dam/weir feature location, not a verified entrance, access route, water surface, live operating state, safety condition, nearest-service claim, or coverage analysis.", displayRelationship: "This 98-point WRA source differs from the current 111-point water_dams display composite (74 dam points plus 37 separate public.water_reservoirs points). No whole-layer version equivalence is claimed.", sidecar: { path, sha256: sidecarSha256, bytes: sidecar.length, featureCount: SOURCE_COUNT } };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}
const [root = analyticsRoot, output] = process.argv.slice(2); await build(root, output);
