import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const SOURCE_SHA256 = "0640e94d1f16d857e502946e67eae2c7c40636ab160b7f8c9f433600cd206507";
const SOURCE_ROWS = 22_918;
const SOURCE_FIELDS = ["entity_id", "occurred_at", "case_class", "location", "facility_subtype", "source", "source_tier", "fetched_at"];
const SAFE_FIELDS = ["record_id", "case_class", "facility_subtype", "source", "source_tier", "fetched_at"];
const CELL_DEGREES = 0.05;
const MAX_SHARD_ROWS = 20_000;
const MAX_SHARD_BYTES = 8 * 1024 * 1024;

const fail = code => { throw new Error(code); };
const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat) => [Math.floor(lng / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)];
const cellBbox = ([x, y]) => [Number((x * CELL_DEGREES).toFixed(12)), Number((y * CELL_DEGREES).toFixed(12)), Number(((x + 1) * CELL_DEGREES).toFixed(12)), Number(((y + 1) * CELL_DEGREES).toFixed(12))];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const normalizedTimestamp = value => {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})-(\d{2}):(\d{2})$/.exec(value);
  if (!match) fail("ACCIDENT_TAIPEI_SOURCE_TIMESTAMP_INVALID");
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T${match[4]}:${match[5]}`;
};

function safeFeature(raw, ordinal) {
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !raw.properties || typeof raw.properties !== "object" || Array.isArray(raw.properties)) fail("ACCIDENT_TAIPEI_SOURCE_FEATURE_INVALID");
  const properties = raw.properties;
  if (Object.keys(properties).length !== SOURCE_FIELDS.length || SOURCE_FIELDS.some(field => !(field in properties))
    || typeof properties.entity_id !== "string" || !/^pj_accident_tp_\d{6}$/.test(properties.entity_id)
    || typeof properties.occurred_at !== "string" || !/^2019\/\d{1,2}\/\d{1,2}-\d{2}:\d{2}$/.test(properties.occurred_at)
    || !["1", "2"].includes(properties.case_class) || typeof properties.location !== "string"
    || properties.facility_subtype !== "accident_taipei" || properties.source !== "taipei_136123"
    || properties.source_tier !== 1 || properties.fetched_at !== "2026-06-26") fail("ACCIDENT_TAIPEI_SOURCE_PROPERTIES_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return {
    cell: cellFor(lng, lat),
    feature: {
      type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { record_id: `accident-taipei:${String(ordinal + 1).padStart(5, "0")}`, case_class: properties.case_class, facility_subtype: properties.facility_subtype, source: properties.source, source_tier: properties.source_tier, fetched_at: properties.fetched_at },
    },
  };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_SHARD_ROWS || payload.length > MAX_SHARD_BYTES) fail("ACCIDENT_TAIPEI_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 });
  const digest = sha256(compressed), path = `${digest}.geojson.gz`;
  await writeFile(resolve(output, path), compressed);
  return { path, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: sha256(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function build(inputArg, outputArg) {
  if (!inputArg) fail("Usage: node scripts/research/build-accident-taipei-owner-only.mjs <accident_taipei_dots_20260626.geojson> [output-dir]");
  const input = resolve(inputArg), output = resolve(outputArg ?? "../runtime/owner-only/accident-taipei");
  const bytes = await readFile(input);
  if (sha256(bytes) !== SOURCE_SHA256) fail("ACCIDENT_TAIPEI_SOURCE_SHA_MISMATCH");
  let source;
  try { source = JSON.parse(bytes); } catch { fail("ACCIDENT_TAIPEI_SOURCE_INVALID_JSON"); }
  if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== SOURCE_ROWS) fail("ACCIDENT_TAIPEI_SOURCE_COUNT_MISMATCH");
  const buckets = new Map(), ids = new Set(), classes = { "1": 0, "2": 0 }, timestamps = [];
  for (const [ordinal, raw] of source.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal);
    if (ids.has(raw.properties.entity_id)) fail("ACCIDENT_TAIPEI_SOURCE_ID_DUPLICATE");
    ids.add(raw.properties.entity_id); classes[raw.properties.case_class]++; timestamps.push(normalizedTimestamp(raw.properties.occurred_at));
    const key = cell.join(","), bucket = buckets.get(key) ?? [];
    bucket.push(feature); buckets.set(key, bucket);
  }
  timestamps.sort();
  if (ids.size !== SOURCE_ROWS || classes["1"] !== 83 || classes["2"] !== 22_835 || timestamps[0] !== "2019-01-01T00:50" || timestamps.at(-1) !== "2019-12-31T23:58") fail("ACCIDENT_TAIPEI_SOURCE_SEMANTICS_MISMATCH");
  const temporary = `${output}.building`;
  await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(await writeShard(temporary, features, cellBbox(key.split(",").map(Number))));
  if (!shards.length || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_ROWS) fail("ACCIDENT_TAIPEI_PARTITION_MANIFEST_MISMATCH");
  const reference = `/research/accident-taipei/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: bytes.length, featureCount: SOURCE_ROWS, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest), manifestSha256 = sha256(manifestBytes);
  await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-accident-taipei-owner-only/1", source: manifest.source, snapshot: "2019-01-01 through 2019-12-31; processed 2026-06-26", publisher: "臺北市政府資料開放平台 data.gov.tw/dataset/136123", license: "OGDL-Taiwan-1.0", safeFields: SAFE_FIELDS, excludedFields: ["entity_id", "occurred_at", "location"], classes, geometry: "fixed sensitive incident reference Point; no nearest, route, current risk, safety, crash total, or current accident claims", manifest: { sha256: manifestSha256, bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt));
  await mkdir(dirname(output), { recursive: true });
  await rm(output, { recursive: true, force: true }); await rename(temporary, output);
  console.log(JSON.stringify(receipt, null, 2));
}

const [input, output] = process.argv.slice(2);
await build(input, output);
