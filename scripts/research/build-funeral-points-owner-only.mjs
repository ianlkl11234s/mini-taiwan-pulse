import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ANALYTICS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;

const FAMILIES = [
  {
    key: "facilities", datasetId: "funeral_facilities_moi", version: "20260805", count: 3707,
    processed: "data/processed/funeral/funeral_facilities_moi/funeral_facilities_moi_20260805.geojson",
    processedSha256: "f358f04697fa477cdf99a033f4488be476c12948162d974010cc57fdbb899223",
    raw: [
      ["data/raw/funeral/moi_7052_facilities_main.csv", "79df5827a5b7d1745a322264ab9594aed2d50250aa4bf7a97961fe87dd0526b6", 3751],
      ["data/raw/funeral/moi_7052_facilities_coords.csv", "283baa82ec82640f85907ad6cecae1bb9db7e1562d7693f653d12820b17a75d2", 328],
      ["data/raw/funeral/moi_53681_eco_burial.csv", "ed9706d38cb739c85593dd9f3bea857ce81e63bce9382f08c03c5b3dc37e4fae", 69],
    ],
    sourceFields: ["facility_id", "facility_uid", "source", "facility_type", "type_raw", "name", "operator_type", "county", "district", "address_raw", "phone", "eco_type", "addr_kind", "addr_subtype", "geocode_source", "precision", "parcel_hit_count"],
    safeFields: ["facility_id", "facility_uid", "source", "facility_type", "name", "operator_type", "county", "district", "eco_type", "geocode_source", "precision"],
    excludedFields: ["address_raw", "phone", "type_raw", "addr_kind", "addr_subtype", "parcel_hit_count"],
    precision: { approximate: 429, cached: 257, exact: 418, interpolated: 19, parcel_centroid: 1576, source: 241, tgos: 767 },
    geocodeSource: { google: 574, nlsc_parcel: 1327, offline_L1: 257, offline_L2: 292, source: 241, tgos: 767, twland_parcel: 249 },
  },
  {
    key: "operators", datasetId: "funeral_operators_biz", version: "20260805", count: 6233,
    processed: "data/processed/funeral/funeral_operators_biz/funeral_operators_biz_20260805.geojson",
    processedSha256: "aa16c2de7b159068f276ef81d8a3dac1fd88d3334b0d20f521fd7a3f821b6c20",
    raw: [
      ["data/raw/funeral/gcis_81112_business.csv", "379362957524bffb2f9217eae8e29b35e123391a6971e5df5b20506bbb5b0279", 4199],
      ["data/raw/funeral/gcis_32679_company.csv", "ada59f4f7f5636369633681bd128f6e06b632cd851bcd9cf15f0f58eaaf8781d", 2034],
    ],
    sourceFields: ["operator_id", "source", "entity_type", "name", "uniform_id", "county", "district", "address_raw", "address_norm", "status", "capital", "permit_no", "established_date", "is_active", "geocode_source", "precision"],
    safeFields: ["operator_id", "source", "entity_type", "name", "county", "district", "status", "is_active", "geocode_source", "precision"],
    excludedFields: ["uniform_id", "address_raw", "address_norm", "capital", "permit_no", "established_date"],
    precision: { approximate: 16, cached: 1238, exact: 3100, interpolated: 18, tgos: 1861 },
    geocodeSource: { google: 48, offline_L1: 1238, offline_L15: 10, offline_L2: 3076, tgos: 1861 },
    active: { true: 4569, false: 1664 },
  },
];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const countRows = bytes => Math.max(0, bytes.toString("utf8").split(/\r?\n/).filter(Boolean).length - 1);
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2 && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const equal = (left, right) => Object.keys(left).length === Object.keys(right).length && Object.entries(right).every(([key, value]) => left[key] === value);
const counts = (features, key) => Object.fromEntries([...features.reduce((result, feature) => result.set(String(feature.properties[key]), (result.get(String(feature.properties[key])) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));

async function writeShard(output, features, bbox, family) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail(`FUNERAL_${family.key.toUpperCase()}_SHARD_LIMIT_EXCEEDED`);
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees, family) {
  if (features.length <= MAX_FEATURES_PER_SHARD && json({ type: "FeatureCollection", features }).length <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox, family)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (json({ type: "FeatureCollection", features }).length > MAX_UNCOMPRESSED_BYTES) fail(`FUNERAL_${family.key.toUpperCase()}_MIN_CELL_LIMIT_EXCEEDED`);
    const shards = []; for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox, family)); return shards;
  }
  const children = new Map(); const childDegrees = degrees / 2;
  for (const feature of features) { const key = cellFor(...feature.geometry.coordinates, childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const shards = []; for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees, family)); return shards;
}

async function buildFamily(root, output, family) {
  for (const [relative, expectedHash, expectedRows] of family.raw) { const bytes = await readFile(resolve(root, relative)); if (hash(bytes) !== expectedHash) fail(`FUNERAL_${family.key.toUpperCase()}_RAW_SHA_MISMATCH`); if (countRows(bytes) !== expectedRows) fail(`FUNERAL_${family.key.toUpperCase()}_RAW_COUNT_MISMATCH`); }
  const sourceBytes = await readFile(resolve(root, family.processed)); if (hash(sourceBytes) !== family.processedSha256) fail(`FUNERAL_${family.key.toUpperCase()}_PROCESSED_SHA_MISMATCH`);
  let collection; try { collection = JSON.parse(sourceBytes); } catch { fail(`FUNERAL_${family.key.toUpperCase()}_PROCESSED_JSON_INVALID`); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.count) fail(`FUNERAL_${family.key.toUpperCase()}_PROCESSED_COUNT_MISMATCH`);
  const ids = new Set(); const buckets = new Map();
  for (const [ordinal, raw] of collection.features.entries()) {
    if (raw?.type !== "Feature" || !point(raw.geometry) || !raw.properties || typeof raw.properties !== "object" || Array.isArray(raw.properties) || Object.keys(raw.properties).length !== family.sourceFields.length || family.sourceFields.some(field => !(field in raw.properties))) fail(`FUNERAL_${family.key.toUpperCase()}_SOURCE_FEATURE_INVALID`);
    if (family.sourceFields.some(field => field === "parcel_hit_count" ? !Number.isInteger(raw.properties[field]) || raw.properties[field] < 0 : typeof raw.properties[field] !== "string")) fail(`FUNERAL_${family.key.toUpperCase()}_SOURCE_PROPERTIES_INVALID`);
    const id = raw.properties[family.safeFields[0]]; if (!id || ids.has(id)) fail(`FUNERAL_${family.key.toUpperCase()}_SOURCE_ID_INVALID`); ids.add(id);
    const [lng, lat] = raw.geometry.coordinates; const key = cellFor(lng, lat).join(","); const features = buckets.get(key) ?? [];
    features.push({ type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(family.safeFields.map(field => [field, raw.properties[field]])) }); buckets.set(key, features);
  }
  if (!equal(counts(collection.features, "precision"), family.precision) || !equal(counts(collection.features, "geocode_source"), family.geocodeSource) || family.active && !equal(counts(collection.features, "is_active"), { False: family.active.false, True: family.active.true })) fail(`FUNERAL_${family.key.toUpperCase()}_SOURCE_SEMANTICS_MISMATCH`);
  await mkdir(output, { recursive: true }); const shards = []; for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES, family));
  if (!shards.length || shards.length > 1024 || shards.reduce((sum, shard) => sum + shard.featureCount, 0) !== family.count) fail(`FUNERAL_${family.key.toUpperCase()}_PARTITION_MANIFEST_LIMIT_MISMATCH`);
  const reference = `/research/funeral-points/${family.key}/source-identity/sha256-${family.processedSha256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: family.processedSha256, bytes: sourceBytes.length, featureCount: family.count, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(output, "manifest.json"), manifestBytes);
  return { datasetId: family.datasetId, version: family.version, source: manifest.source, raw: family.raw.map(([path, sha256, rows]) => ({ path, sha256, rows })), safeFields: family.safeFields, excludedFields: family.excludedFields, precision: family.precision, geocodeSource: family.geocodeSource, active: family.active, manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
}

async function build(rootArg, outputArg) {
  const root = resolve(rootArg ?? ANALYTICS_ROOT); const output = resolve(outputArg ?? "../runtime/owner-only/funeral-points"); const temporary = `${output}.building`;
  await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const families = []; for (const family of FAMILIES) families.push(await buildFamily(root, resolve(temporary, family.key), family));
  const receipt = { schemaVersion: "pulse-funeral-points-owner-only/1", snapshot: "20260805", license: "原始官方名冊/商工登記：OGDL-Taiwan-1.0；Google-derived coordinates（facilities 574、operators 48）公開再散布權未核，僅 owner-only；最近點、精確距離、入口、道路可達性 HOLD。", coordinateRights: "Google-derived coordinate reuse is unverified; NLSC/twland parcel-centroid and geocode points are proxy references only.", families };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rm(output, { recursive: true, force: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root, output] = process.argv.slice(2); await build(root, output);
