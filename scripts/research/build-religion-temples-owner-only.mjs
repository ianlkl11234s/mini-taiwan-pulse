import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const SOURCE = "data/processed/religion/temples/temples_20260801.geojson";
const SOURCE_SHA256 = "ee6c5549b35bc76dbf4ac22ee0ce5dd6a4684b5269af416cf43cfc6736f2207e";
const SOURCE_COUNT = 19_201;
const RAW_ARTIFACTS = [
  ["data/raw/religion/moi_religion_system/temple_20260801.xml", "ecee97faf90b740335e58d118edd252c8b4c0a67356084808fddfa312d45382d"],
  ["data/raw/religion/osm_place_of_worship/osm_pow_20260801.json", "6242d9bc1c5f5ec20a613f25cdadcc5b4cefbf3f3e31a3b8e6fe437beb2e1b67"],
  ["data/raw/religion/top100/宗教百景_2021.shp", "4e23c6d4d5b7213088233e3e6b0b9e114be8683f6caf3c3b5a4e4ddadc1abf19"],
  ["data/raw/religion/top100/宗教百景_2021.dbf", "fb801b887995c0447456913fda068a1faba820921db3c18a154b7092c61a509c"],
  ["data/processed/tourism/heritage/heritage_20260524.geojson", "6946a719b30a606250228d97890eed323f58a0cba10238e8290c0099a5b163e4"],
];
const SAFE_FIELDS = ["entity_id", "deity_family", "religion_type", "registration_type", "in_moi_registry", "heritage_flag", "is_top100", "source", "coord_source", "geocode_precision"];
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= -180 && geometry.coordinates[0] <= 180 && geometry.coordinates[1] >= -90 && geometry.coordinates[1] <= 90;
const nullableString = value => value === undefined || value === null || typeof value === "string";

function safeFeature(feature, ordinal) {
  if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) fail("RELIGION_TEMPLES_SOURCE_FEATURE_INVALID");
  const properties = feature.properties;
  if (typeof properties.entity_id !== "string" || !properties.entity_id || !SAFE_FIELDS.filter(field => !["entity_id", "in_moi_registry", "heritage_flag", "is_top100"].includes(field)).every(field => nullableString(properties[field]))
    || !["in_moi_registry", "heritage_flag", "is_top100"].every(field => typeof properties[field] === "boolean")) fail("RELIGION_TEMPLES_SOURCE_PROPERTIES_INVALID");
  const [lng, lat] = feature.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, properties[field] ?? null])) } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("RELIGION_TEMPLES_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const bytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && bytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (bytes > MAX_UNCOMPRESSED_BYTES) fail("RELIGION_TEMPLES_MIN_CELL_LIMIT_EXCEEDED");
    const shards = []; for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox));
    return shards;
  }
  const childDegrees = degrees / 2; const children = new Map();
  for (const feature of features) { const [lng, lat] = feature.geometry.coordinates; const key = cellFor(lng, lat, childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

const [analyticsRootArg, outputArg] = process.argv.slice(2);
if (!analyticsRootArg) fail("Usage: node scripts/research/build-religion-temples-owner-only.mjs <taipei-gis-analytics-root> [output-directory]");
const analyticsRoot = resolve(analyticsRootArg); const output = resolve(outputArg ?? "../runtime/owner-only/religion-temples");
for (const [path, expected] of RAW_ARTIFACTS) { const bytes = await readFile(resolve(analyticsRoot, path)); if (hash(bytes) !== expected) fail("RELIGION_TEMPLES_RAW_ARTIFACT_SHA_MISMATCH"); }
const sourceBytes = await readFile(resolve(analyticsRoot, SOURCE));
if (hash(sourceBytes) !== SOURCE_SHA256) fail("RELIGION_TEMPLES_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(sourceBytes);
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("RELIGION_TEMPLES_SOURCE_COUNT_MISMATCH");
const ids = new Set(); const buckets = new Map();
for (const [ordinal, raw] of collection.features.entries()) { const { cell, feature } = safeFeature(raw, ordinal); if (ids.has(feature.properties.entity_id)) fail("RELIGION_TEMPLES_SOURCE_ID_DUPLICATE"); ids.add(feature.properties.entity_id); const key = cell.join(","); const list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list); }
await rm(output, { recursive: true, force: true }); const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
const shards = [];
for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("RELIGION_TEMPLES_PARTITION_MANIFEST_LIMIT_MISMATCH");
const reference = `/research/religion-temples/source-identity/sha256-${SOURCE_SHA256}`;
const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
const receipt = { schemaVersion: "pulse-religion-temples-owner-only/1", source: manifest.source, rawArtifacts: RAW_ARTIFACTS.map(([path, sha256]) => ({ path, sha256 })), snapshot: "2026-08-01", sourceCounts: { final_entities: 19_201, moi_entities: 12_499, osm_new_entities: 6_702, heritage_flagged: 259, top100_flagged: 49, moi_missing_coordinate: 507, geocode_backfill_resolved: 503, unresolved_source_coordinate: 2 }, license: "RIGHTS_HOLD: MOI/heritage/top100 OGDL-Taiwan-1.0, but OSM ODbL attribution and Google-geocode redistribution rights are unresolved for publication.", safeFields: SAFE_FIELDS, excludedFields: ["name", "aliases", "address", "phone", "principal", "moi_id", "main_deity", "source_url", "source_org", "license", "confidence", "_n_sources", "_provenance", "raw_lat", "raw_lon"], geometry: "Mixed source/reference Point retained only for required bbox queries; original, OSM, offline, TGOS and Google geocode precision remains labeled. No nearest, distance, entrance, boundary, coverage, county or current-registry claim.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
