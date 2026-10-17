import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const sourceRelative = "data/processed/poi/medical/nhi_institutions_geocoded.geojson";
const SOURCE_SHA256 = "d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d";
const SOURCE_COUNT = 31_603;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SAFE_FIELDS = ["category", "geocode_source"];
const SOURCE_FIELDS = ["facility_id", "name", "category", "contract_type", "facility_kind", "form_type", "county", "district_code", "address", "phone", "specialties", "services", "open_hours", "contract_start", "contract_end", "source_did", "geocode_source", "address_matched"];
const CATEGORY_COUNTS = { hospital_district: 337, hospital_medical_center: 29, hospital_regional: 85, clinic: 21_765, health_center: 407, home_nursing: 714, lab: 208, medical_radiology: 9, midwifery: 15, occupational_therapy: 9, other_nhi: 1, pharmacy: 7_680, physical_therapy: 22, rehab_home: 299, speech_therapy: 23 };
const GEOCODE_SOURCE_COUNTS = { tgos: 29_621, google: 1_603, google_retry: 379 };

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const count = values => Object.fromEntries([...values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
const equal = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => actual[key] === value);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2 && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && Math.abs(geometry.coordinates[0]) <= 180 && Math.abs(geometry.coordinates[1]) <= 90;

function safeFeature(raw, ordinal) {
  const properties = raw?.properties;
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !properties || typeof properties !== "object" || Array.isArray(properties)
    || Object.keys(properties).length !== SOURCE_FIELDS.length || SOURCE_FIELDS.some(field => !(field in properties))
    || typeof properties.category !== "string" || !(properties.category in CATEGORY_COUNTS)
    || typeof properties.geocode_source !== "string" || !(properties.geocode_source in GEOCODE_SOURCE_COUNTS)) fail("NHI_MEDICAL_SOURCE_FEATURE_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: { category: properties.category, geocode_source: properties.geocode_source } } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("NHI_MEDICAL_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("NHI_MEDICAL_MIN_CELL_LIMIT_EXCEEDED");
    const shards = []; for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox));
    return shards;
  }
  const childDegrees = degrees / 2; const children = new Map();
  for (const feature of features) { const key = cellFor(feature.geometry.coordinates[0], feature.geometry.coordinates[1], childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

async function build(root, outputArg) {
  const source = await readFile(resolve(root, sourceRelative)); if (hash(source) !== SOURCE_SHA256) fail("NHI_MEDICAL_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("NHI_MEDICAL_SOURCE_COUNT_MISMATCH");
  const buckets = new Map(); const categories = []; const geocodeSources = [];
  for (const [ordinal, raw] of collection.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal); categories.push(feature.properties.category); geocodeSources.push(feature.properties.geocode_source);
    const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  if (!equal(count(categories), CATEGORY_COUNTS) || !equal(count(geocodeSources), GEOCODE_SOURCE_COUNTS)) fail("NHI_MEDICAL_SOURCE_SEMANTICS_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/nhi-medical"); const temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("NHI_MEDICAL_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/nhi-medical/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-nhi-medical-owner-only/1", source: manifest.source, retainedFields: SAFE_FIELDS, excludedFields: SOURCE_FIELDS.filter(field => !SAFE_FIELDS.includes(field)), nullCounts: { category: 0, geocode_source: 0 }, categoryCounts: CATEGORY_COUNTS, geocodeSourceCounts: GEOCODE_SOURCE_COUNTS, geometry: { point: SOURCE_COUNT, role: "proxy", note: "Geocoded TGOS/Google/Google retry coordinates support only bounded owner-only reference lookup." }, rights: "HOLD: original NHI public license and download receipt were not verified; this safe-field partition family is owner-only.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = analyticsRoot, output] = process.argv.slice(2);
await build(root, output);
