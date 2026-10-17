import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const SOURCE_SHA256 = "efea0882b55273f0ae8eb3a965a206a4e01a07d8ca9f219e78af1954794e6acc";
const SOURCE_COUNT = 90_652;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SOURCE_FIELDS = ["factory_id", "factory_name", "uniform_no", "factory_address", "county", "org_type", "registered_date", "industry_categories", "main_products", "geocode_precision"];
const SAFE_FIELDS = ["factory_id", "factory_name", "county", "org_type", "registered_date", "industry_categories", "main_products", "geocode_precision"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

function safeFeature(feature, ordinal) {
  if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) fail("FACTORY_LOCATION_SOURCE_FEATURE_INVALID");
  const properties = feature.properties;
  if (Object.keys(properties).length !== SOURCE_FIELDS.length || SOURCE_FIELDS.some(field => typeof properties[field] !== "string")) fail("FACTORY_LOCATION_SOURCE_PROPERTIES_INVALID");
  const [lng, lat] = feature.geometry.coordinates;
  return {
    cell: cellFor(lng, lat),
    feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, properties[field]])) },
  };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("FACTORY_LOCATION_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 });
  const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("FACTORY_LOCATION_MIN_CELL_LIMIT_EXCEEDED");
    const shards = [];
    for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox));
    return shards;
  }
  const childDegrees = degrees / 2; const children = new Map();
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates; const key = cellFor(lng, lat, childDegrees).join(",");
    const list = children.get(key) ?? []; list.push(feature); children.set(key, list);
  }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

async function build(inputArg, outputArg) {
  if (!inputArg) fail("Usage: node build-factory-locations-owner-only.mjs <factory_locations_202606.geojson> [output-dir]");
  const input = resolve(inputArg); const output = resolve(outputArg ?? "../runtime/owner-only/factory-locations");
  const sourceBytes = await readFile(input);
  if (hash(sourceBytes) !== SOURCE_SHA256) fail("FACTORY_LOCATION_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(sourceBytes);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("FACTORY_LOCATION_SOURCE_COUNT_MISMATCH");
  const ids = new Set(); const buckets = new Map();
  for (const [ordinal, raw] of collection.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal);
    if (ids.has(feature.properties.factory_id)) fail("FACTORY_LOCATION_SOURCE_ID_DUPLICATE");
    ids.add(feature.properties.factory_id); const key = cell.join(","); const list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  await rm(output, { recursive: true, force: true }); const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("FACTORY_LOCATION_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/factory-locations/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = {
    schemaVersion: "pulse-factory-locations-owner-only/1", source: manifest.source,
    sourceRows: { raw: 100_634, exactDuplicateRemoved: 1, deduplicated: 100_633, active: 100_624, geocodeMiss: 9_972, publishedPoint: SOURCE_COUNT },
    snapshot: "202606", license: "政府資料開放授權條款第1版（OGDL-Taiwan-1.0）", safeFields: SAFE_FIELDS,
    excludedFields: ["uniform_no", "factory_address", "factory_responsible_person"],
    geometry: "factory-address offline geocode WGS84 reference Point; it is not an entrance, parcel, boundary, transport access, or guaranteed same-version frontend geometry",
    manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length,
  };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [input, output] = process.argv.slice(2); await build(input, output);
