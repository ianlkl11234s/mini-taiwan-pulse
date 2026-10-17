import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const processedRelative = "data/processed/emergency_response/aed/aed_20260524.geojson";
const rawRelative = "data/raw/emergency_response/aed/aed_openData.csv";
const SOURCE_SHA256 = "b4de010d5620cb52110b520d9a9980532ea9be00c755f1254e4a5a16a84bb9e6";
const RAW_SHA256 = "bb25209d3c499670818de651edf2501dfd6808c214d0ef8903104c5f3318debe";
const SOURCE_COUNT = 15_490;
const RAW_COUNT = 15_494;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SAFE_FIELDS = ["place_id", "aed_id", "place_name", "county", "district", "place_category", "place_type", "open_hours", "open_hours_note"];
const SOURCE_FIELDS = ["PlaceID", "PlaceName", "County", "District", "Address", "PlaceCategory", "PlaceType", "AEDID", "AEDLocation", "AEDLocationDesc", "OpenHours", "OpenHoursNote", "EmergencyPhone", "lat", "lng"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 122.5 && geometry.coordinates[1] >= 21.5 && geometry.coordinates[1] <= 26.5;
const nullable = value => typeof value === "string" ? value || null : fail("AED_SOURCE_PROPERTY_TYPE_MISMATCH");

function parseCsv(input) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { value += '"'; index++; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value.replace(/\r$/, "")); if (row.some(field => field !== "")) rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (value || row.length) { row.push(value); if (row.some(field => field !== "")) rows.push(row); }
  return rows;
}

function verifyRaw(raw) {
  const [header, ...rows] = parseCsv(raw.toString("utf8").replace(/^\uFEFF/, ""));
  const expected = ["場所ID", "場所名稱", "場所縣市", "場所區域", "場所地址", "場所分類", "場所類型", "場所描述", "AEDID", "AED放置地點", "AED地點描述", "地點LAT", "地點LNG", "周一至周五起", "周一至周五迄", "周六起", "周六迄", "周日起", "周日迄", "開放使用時間備註", "開放時間緊急連絡電話"];
  if (JSON.stringify(header) !== JSON.stringify(expected) || rows.length !== RAW_COUNT) fail("AED_RAW_SCHEMA_MISMATCH");
  const latIndex = header.indexOf("地點LAT"), lngIndex = header.indexOf("地點LNG"); let missingCoordinates = 0; let outOfTaiwanRange = 0; let located = 0;
  for (const row of rows) {
    const lat = Number(row[latIndex]), lng = Number(row[lngIndex]);
    if (!row[latIndex] || !row[lngIndex] || !Number.isFinite(lat) || !Number.isFinite(lng)) missingCoordinates++;
    else if (lng < 118 || lng > 122.5 || lat < 21.5 || lat > 26.5) outOfTaiwanRange++;
    else located++;
  }
  if (missingCoordinates !== 0 || outOfTaiwanRange !== 4 || located !== SOURCE_COUNT) fail("AED_RAW_COORDINATE_SEMANTICS_MISMATCH");
  return { rows: rows.length, missingCoordinates, outOfTaiwanRange, located };
}

function safeFeature(raw, ordinal) {
  const properties = raw?.properties;
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !properties || typeof properties !== "object" || Array.isArray(properties)
    || Object.keys(properties).length !== SOURCE_FIELDS.length || SOURCE_FIELDS.some(field => !(field in properties))
    || SOURCE_FIELDS.filter(field => !["lat", "lng"].includes(field)).some(field => typeof properties[field] !== "string")
    || !Number.isFinite(properties.lat) || !Number.isFinite(properties.lng) || properties.lat !== raw.geometry.coordinates[1] || properties.lng !== raw.geometry.coordinates[0]
    || !properties.PlaceID || !properties.AEDID) fail("AED_SOURCE_FEATURE_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
    place_id: properties.PlaceID, aed_id: properties.AEDID, place_name: nullable(properties.PlaceName), county: nullable(properties.County), district: nullable(properties.District),
    place_category: nullable(properties.PlaceCategory), place_type: nullable(properties.PlaceType), open_hours: nullable(properties.OpenHours), open_hours_note: nullable(properties.OpenHoursNote),
  } } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("AED_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("AED_MIN_CELL_LIMIT_EXCEEDED");
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
  const raw = await readFile(resolve(root, rawRelative)); if (hash(raw) !== RAW_SHA256) fail("AED_RAW_SHA_MISMATCH");
  const rawReceipt = verifyRaw(raw);
  const source = await readFile(resolve(root, processedRelative)); if (hash(source) !== SOURCE_SHA256) fail("AED_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("AED_SOURCE_COUNT_MISMATCH");
  const ids = new Set(); const buckets = new Map(); const nullCounts = Object.fromEntries(SAFE_FIELDS.slice(2).map(field => [field, 0]));
  for (const [ordinal, rawFeature] of collection.features.entries()) {
    const { cell, feature } = safeFeature(rawFeature, ordinal); const identity = `${feature.properties.place_id}/${feature.properties.aed_id}`;
    if (ids.has(identity)) fail("AED_SOURCE_ID_DUPLICATE"); ids.add(identity);
    for (const field of SAFE_FIELDS.slice(2)) if (feature.properties[field] === null) nullCounts[field]++;
    const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  const output = resolve(outputArg ?? "../runtime/owner-only/med-aed"); const temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("AED_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/med-aed/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-med-aed-owner-only/1", source: manifest.source, raw: { sha256: RAW_SHA256, ...rawReceipt }, snapshot: "2026-05-24", license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）", safeFields: SAFE_FIELDS, nullCounts, excludedFields: ["Address", "AEDLocation", "AEDLocationDesc", "EmergencyPhone", "lat", "lng"], geometry: "Official WGS84 record coordinates retained only for bounded owner-only lookup. Four raw rows outside the Taiwan pipeline extent are not assigned replacement geometry. This sidecar does not establish emergency availability, device function, opening access, exact nearest AED, walking access, or service coverage.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = analyticsRoot, output] = process.argv.slice(2);
await build(root, output);
