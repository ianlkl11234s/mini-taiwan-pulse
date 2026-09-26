import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const SOURCE_SHA256 = "2cfa4bd59e050f7784d0dfcd1f571ca5d62c5cad78dd5073029363f31d45178f";
const SOURCE_COUNT = 80_732;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SOURCE_FIELDS = ["emsno", "facility_name", "uniform_no", "facility_address", "county", "township", "industry_area_name", "industry_group", "industry_name", "isair", "iswater", "iswaste", "istoxic", "issoil", "coord_source", "company_joined", "company_name", "company_categories", "company_industry_code", "company_capital_total"];
const SAFE_FIELDS = ["county", "township", "industry_area_name", "industry_group", "industry_name", "isair", "iswater", "iswaste", "istoxic", "issoil", "coord_source", "company_joined"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

function validProperties(properties) {
  return properties && typeof properties === "object" && !Array.isArray(properties)
    && Object.keys(properties).length === SOURCE_FIELDS.length && SOURCE_FIELDS.every(field => Object.hasOwn(properties, field))
    && ["emsno", "facility_name", "uniform_no", "facility_address", "county", "township", "industry_area_name", "industry_group", "industry_name", "coord_source", "company_name", "company_categories", "company_industry_code"].every(field => typeof properties[field] === "string")
    && ["isair", "iswater", "iswaste", "istoxic", "issoil"].every(field => Number.isInteger(properties[field]))
    && typeof properties.company_joined === "boolean"
    && (properties.company_capital_total === null || typeof properties.company_capital_total === "number");
}

function safeFeature(raw, ordinal) {
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !validProperties(raw.properties)) fail("REGULATED_FACILITIES_SOURCE_FEATURE_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, raw.properties[field]])) } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("REGULATED_FACILITIES_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 });
  const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("REGULATED_FACILITIES_MIN_CELL_LIMIT_EXCEEDED");
    const shards = [];
    for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox));
    return shards;
  }
  const childDegrees = degrees / 2;
  const children = new Map();
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    const key = cellFor(lng, lat, childDegrees).join(",");
    const list = children.get(key) ?? [];
    list.push(feature);
    children.set(key, list);
  }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

async function build(inputArg, outputArg) {
  if (!inputArg) fail("Usage: node build-regulated-facilities-owner-only.mjs <regulated_facilities_20260818.geojson> [output-dir]");
  const input = resolve(inputArg);
  const output = resolve(outputArg ?? "../runtime/owner-only/regulated-facilities");
  const sourceBytes = await readFile(input);
  if (hash(sourceBytes) !== SOURCE_SHA256) fail("REGULATED_FACILITIES_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(sourceBytes);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("REGULATED_FACILITIES_SOURCE_COUNT_MISMATCH");
  const ids = new Set();
  const buckets = new Map();
  for (const [ordinal, raw] of collection.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal);
    if (ids.has(raw.properties.emsno)) fail("REGULATED_FACILITIES_SOURCE_ID_DUPLICATE");
    ids.add(raw.properties.emsno);
    const key = cell.join(",");
    const list = buckets.get(key) ?? [];
    list.push(feature);
    buckets.set(key, list);
  }
  await rm(output, { recursive: true, force: true });
  const temporary = `${output}.building`;
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("REGULATED_FACILITIES_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/regulated-facilities/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest);
  await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = {
    schemaVersion: "pulse-regulated-facilities-owner-only/1", source: manifest.source, snapshot: "2026-08-18", sourceRows: { raw: 451_434, activeFacility: 127_795, coordinateMissFacility: 47_063, publishedPoint: SOURCE_COUNT },
    coverage: { coordinateCoverageOfActiveFacilities: SOURCE_COUNT / 127_795, companyJoinCoverageAllFacilities: 0.5001056379357565, note: "50.01% is company join coverage, not coordinate coverage." },
    license: "政府資料開放授權條款第1版（OGDL-Taiwan-1.0）", safeFields: SAFE_FIELDS,
    excludedFields: ["emsno", "facility_name", "uniform_no", "facility_address", "company_name", "company_categories", "company_industry_code", "company_capital_total"],
    geometry: "EMS WGS84 or EMS TWD97 TM2 converted reference Point; company join never changes geometry. It is not an entrance, parcel, boundary, nearest facility, route, access, operating status, pollution, penalty, emission, or environmental-risk finding.",
    manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length,
  };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt));
  await mkdir(dirname(output), { recursive: true });
  await rename(temporary, output);
  console.log(JSON.stringify(receipt));
}

const [input, output] = process.argv.slice(2);
await build(input, output);
