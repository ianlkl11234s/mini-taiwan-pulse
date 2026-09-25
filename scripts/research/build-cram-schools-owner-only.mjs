import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ANALYTICS = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const SOURCE_RELATIVE = "data/processed/education/cram_schools/cram_schools_20260807.geojson";
const RAW_RELATIVE = "data/raw/education/cram_schools/city_02.json";
const SOURCE_SHA256 = "adf0dddc81dc6ba30ff71c72242b4263b5a3896b7faffd40cead7ee24711af4e";
const RAW_SHA256 = "dc74fd5b0ccce06461b993b3b8e4de0fcf37ec0e6ebf1b1864d13636dba43c73";
const SOURCE_COUNT = 17_137;
const RAW_COUNT = 17_772;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SAFE_FIELDS = ["county", "category", "geocode_source", "geocode_precision"];
const SOURCE_FIELDS = ["_row_id", "address_clean", "county", "precision", "source", "主管機關文件單位代碼", "各地短期補習班數量", "地區縣市", "地址", "地址-行政區域代碼", "短期補習班名稱", "短期補習班類別", "立案時間", "縣市別代碼", "電子郵件"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 122.5 && geometry.coordinates[1] >= 21.5 && geometry.coordinates[1] <= 26.5;
const string = value => typeof value === "string" && value ? value : fail("CRAM_SCHOOL_SOURCE_PROPERTY_TYPE_MISMATCH");

function safeFeature(raw, ordinal) {
  const properties = raw?.properties;
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !properties || typeof properties !== "object" || Array.isArray(properties)
    || Object.keys(properties).length !== SOURCE_FIELDS.length || SOURCE_FIELDS.some(field => !(field in properties))
    || !Number.isSafeInteger(properties._row_id) || properties._row_id < 0 || properties._row_id >= RAW_COUNT
    || !["exact", "cached", "tgos", "interpolated"].includes(properties.precision) || !string(properties.county) || !string(properties["短期補習班類別"]) || !["offline_l1", "offline_l15", "offline_l2", "tgos"].includes(properties.source)) fail("CRAM_SCHOOL_SOURCE_FEATURE_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
    county: properties.county, category: properties["短期補習班類別"], geocode_source: properties.source, geocode_precision: properties.precision,
  } } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("CRAM_SCHOOL_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("CRAM_SCHOOL_MIN_CELL_LIMIT_EXCEEDED");
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
  const raw = await readFile(resolve(root, RAW_RELATIVE)); if (hash(raw) !== RAW_SHA256) fail("CRAM_SCHOOL_RAW_SHA_MISMATCH");
  const rawRows = JSON.parse(raw); if (!Array.isArray(rawRows) || rawRows.length !== RAW_COUNT) fail("CRAM_SCHOOL_RAW_COUNT_MISMATCH");
  const source = await readFile(resolve(root, SOURCE_RELATIVE)); if (hash(source) !== SOURCE_SHA256) fail("CRAM_SCHOOL_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("CRAM_SCHOOL_SOURCE_COUNT_MISMATCH");
  const buckets = new Map(); const categoryCounts = {}; const precisionCounts = {}; const countyCounts = {}; const rowIds = new Set();
  for (const [ordinal, rawFeature] of collection.features.entries()) {
    const { cell, feature } = safeFeature(rawFeature, ordinal); const rowId = rawFeature.properties._row_id;
    if (rowIds.has(rowId)) fail("CRAM_SCHOOL_SOURCE_ID_DUPLICATE"); rowIds.add(rowId);
    for (const [label, target, value] of [["category", categoryCounts, feature.properties.category], ["precision", precisionCounts, feature.properties.geocode_precision], ["county", countyCounts, feature.properties.county]]) target[value] = (target[value] ?? 0) + 1;
    const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  if (precisionCounts.exact !== 10_100 || precisionCounts.cached !== 2_831 || precisionCounts.tgos !== 4_129 || precisionCounts.interpolated !== 77) fail("CRAM_SCHOOL_PRECISION_COUNT_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/cram-schools"); const temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("CRAM_SCHOOL_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/cram-schools/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-cram-schools-owner-only/1", source: manifest.source, raw: { sha256: RAW_SHA256, rows: RAW_COUNT }, snapshot: "2026-08-07", publisher: "高雄市教育局代管全國短期補習班系統", license: "OGDL-Taiwan-1.0 catalog claim; coordinate reuse is restricted to localhost owner-only because processed points are TGOS/offline/cached/interpolated geocodes rather than verified original facility coordinates.", safeFields: SAFE_FIELDS, excludedFields: ["_row_id", "短期補習班名稱", "地址", "address_clean", "電子郵件", "主管機關文件單位代碼", "地區縣市", "縣市別代碼", "地址-行政區域代碼", "各地短期補習班數量", "立案時間"], precisionCounts, categoryCounts, countyCounts, geocodeMissing: RAW_COUNT - SOURCE_COUNT, geometry: "Fixed geocoded reference Points. exact/cached/tgos/interpolated indicate geocoder provenance; interpolated is an estimated same-road location. This sidecar supports owner-only bounded bbox and category lookup only, never nearest, distance, access, service coverage, current registration, opening, or school quality claims.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = ANALYTICS, output] = process.argv.slice(2);
await build(root, output);
