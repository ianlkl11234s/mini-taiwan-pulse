import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_SHA256 = "88951e69b0f6a146c88fdee8392940fce515e36b3cbaeff6a5ce8527dc47a26f";
const SOURCE_COUNT = 73_060;
const CELL_DEGREES = 0.1;
const MAX_FEATURES_PER_SHARD = 8_000;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const MIN_CELL_DEGREES = 0.0125;
const SAFE_FIELDS = ["city", "district", "vehicle_type", "via", "routes_count"];
const EXPECTED_VIA = { legacy: 2_675, poi_foursquare: 193, poi_nominatim: 483, poi_school: 459, tgos_batch_v2: 29_535, tgos_batch_v2_round4: 1_403, waste_open_data: 38_312 };
const EXPECTED_VEHICLE_TYPE = { garbage: 73_059, kitchen: 1 };

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];

function sameCounts(actual, expected) { return JSON.stringify(Object.fromEntries([...actual.entries()].sort())) === JSON.stringify(expected); }
function safeFeature(raw, ordinal) {
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !raw.properties || typeof raw.properties !== "object") fail("WASTE_STOP_SOURCE_FEATURE_INVALID");
  const p = raw.properties;
  if ((p.id != null && (!Number.isSafeInteger(p.id) || p.id <= 0)) || ["city", "district", "vehicle_type", "via"].some(field => typeof p[field] !== "string")
    || !Number.isSafeInteger(p.routes_count) || p.routes_count < 0) fail("WASTE_STOP_SOURCE_PROPERTIES_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, p[field]])) } };
}
async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > 6 * 1024 * 1024) fail("WASTE_STOP_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}
async function splitAndWrite(output, features, bbox, degrees) {
  if (features.length <= MAX_FEATURES_PER_SHARD && json({ type: "FeatureCollection", features }).length <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    const shards = []; for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox)); return shards;
  }
  const children = new Map(); const childDegrees = degrees / 2;
  for (const feature of features) { const [lng, lat] = feature.geometry.coordinates; const key = cellFor(lng, lat, childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const shards = []; for (const [key, child] of [...children.entries()].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees)); return shards;
}

const [input = "public/geo/waste_stops_static.geojson", outputArg = "../runtime/owner-only/waste-stops"] = process.argv.slice(2);
const inputPath = resolve(input), output = resolve(outputArg);
const sourceBytes = await readFile(inputPath); if (hash(sourceBytes) !== SOURCE_SHA256) fail("WASTE_STOP_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(sourceBytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("WASTE_STOP_SOURCE_COUNT_MISMATCH");
const buckets = new Map(), via = new Map(), vehicleType = new Map();
for (const [ordinal, raw] of collection.features.entries()) {
  const { cell, feature } = safeFeature(raw, ordinal); const key = cell.join(","); const list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  via.set(feature.properties.via, (via.get(feature.properties.via) ?? 0) + 1); vehicleType.set(feature.properties.vehicle_type, (vehicleType.get(feature.properties.vehicle_type) ?? 0) + 1);
}
if (!sameCounts(via, EXPECTED_VIA) || !sameCounts(vehicleType, EXPECTED_VEHICLE_TYPE)) fail("WASTE_STOP_SOURCE_SEMANTICS_MISMATCH");
await rm(output, { recursive: true, force: true }); const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
const shards = []; for (const [key, features] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
if (!shards.length || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("WASTE_STOP_PARTITION_MANIFEST_MISMATCH");
const reference = `/research/waste-stops/source-identity/sha256-${SOURCE_SHA256}`;
const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
const manifestBytes = json(manifest);
const receipt = { schemaVersion: "pulse-waste-stops-owner-only/1", source: manifest.source, safeFields: SAFE_FIELDS, excludedFields: ["id", "stop_name", "route_id", "route_name"], coordinateMethods: { government_open_data: 38_312, tgos: 30_938, poi_fallback: 1_135, legacy: 2_675 }, via: EXPECTED_VIA, geometry: "mixed official, TGOS, POI fallback and legacy reference Point; it does not establish a truck stop, collection schedule, current service, access, or nearest usable stop", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
await writeFile(resolve(temporary, "manifest.json"), manifestBytes); await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output);
console.log(JSON.stringify(receipt));
