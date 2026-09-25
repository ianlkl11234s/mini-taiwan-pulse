import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ANALYTICS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const CELL_DEGREES = 0.1;
const MAX_FEATURES_PER_SHARD = 8_000;
const MAX_UNCOMPRESSED_BYTES = 1_500_000;
const MIN_CELL_DEGREES = 0.0125;
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const families = {
  hotels: {
    raw: "data/raw/tourism/hotel/Hotel-json_v2.1.zip", rawSha256: "7da8cb15e9552c334708a843a9cea26b5a7311b9b973bef30dc7abc9ef7b2577",
    processed: "data/processed/tourism/hotel/hotel_20260722.geojson", processedSha256: "6eb9e3dd6ccc9ea9a6b7746231001e70e7d753ecc5794c7e1fb31fe56e82d9e0", rawRows: 15_656, rows: 15_654,
    id: "HotelID", fields: ["HotelID", "HotelName", "City", "CityCode", "Town", "TownCode", "HotelClasses", "HotelStars", "TotalRooms", "LowestPrice", "CeilingPrice", "TotalCapacity", "ParkingSpaces"],
  },
  restaurants: {
    raw: "data/raw/tourism/restaurant/Restaurant-json_v2.1.zip", rawSha256: "498dba192119715c7b01b9d8dd9759b98e24a7aef2969cb91d07ac818224776d",
    processed: "data/processed/tourism/restaurant/restaurant_20260723.geojson", processedSha256: "f78dcd2d99aacdc3607c2230d8280945ab67e17948b6e237e3a01b1abffd19f9", rawRows: 3_690, rows: 3_688,
    id: "id", fields: ["id", "name", "cuisine_class", "city", "town", "service_time"],
  },
};
function safeFeature(raw, ordinal, spec) {
  if (raw?.type !== "Feature" || !point(raw.geometry) || !raw.properties || typeof raw.properties !== "object") fail("TOURISM_HOSPITALITY_SOURCE_FEATURE_INVALID");
  const p = raw.properties;
  if (typeof p[spec.id] !== "string" || !p[spec.id]) fail("TOURISM_HOSPITALITY_SOURCE_ID_INVALID");
  for (const field of spec.fields) {
    const value = p[field];
    if (value !== null && !["string", "number"].includes(typeof value)) fail("TOURISM_HOSPITALITY_SOURCE_PROPERTY_INVALID");
  }
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(spec.fields.map(field => [field, p[field] ?? null])) } };
}
async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > 6 * 1024 * 1024) fail("TOURISM_HOSPITALITY_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}
async function splitAndWrite(output, features, bbox, degrees) {
  if (features.length <= MAX_FEATURES_PER_SHARD && json({ type: "FeatureCollection", features }).length <= MAX_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) { const result = []; for (let i = 0; i < features.length; i += MAX_FEATURES_PER_SHARD) result.push(await writeShard(output, features.slice(i, i + MAX_FEATURES_PER_SHARD), bbox)); return result; }
  const children = new Map(); const childDegrees = degrees / 2;
  for (const feature of features) { const [lng, lat] = feature.geometry.coordinates; const key = cellFor(lng, lat, childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const result = []; for (const [key, child] of [...children.entries()].sort(([a], [b]) => a.localeCompare(b))) result.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees)); return result;
}
async function build(name, root, outputRoot) {
  const spec = families[name]; if (!spec) fail("Usage: node scripts/research/build-tourism-hospitality-owner-only.mjs <hotels|restaurants> [taipei-gis-analytics-root] [output-directory]");
  const raw = await readFile(resolve(root, spec.raw)); if (hash(raw) !== spec.rawSha256) fail("TOURISM_HOSPITALITY_RAW_SHA_MISMATCH");
  const processed = await readFile(resolve(root, spec.processed)); if (hash(processed) !== spec.processedSha256) fail("TOURISM_HOSPITALITY_PROCESSED_SHA_MISMATCH");
  let collection; try { collection = JSON.parse(processed); } catch { fail("TOURISM_HOSPITALITY_PROCESSED_JSON_INVALID"); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== spec.rows) fail("TOURISM_HOSPITALITY_PROCESSED_COUNT_MISMATCH");
  const ids = new Set(), buckets = new Map();
  for (const [ordinal, rawFeature] of collection.features.entries()) { const { cell, feature } = safeFeature(rawFeature, ordinal, spec); if (ids.has(feature.properties[spec.id])) fail("TOURISM_HOSPITALITY_SOURCE_ID_DUPLICATE"); ids.add(feature.properties[spec.id]); const key = cell.join(","); const list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list); }
  const output = resolve(outputRoot, name); const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = []; for (const [key, features] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  const reference = `/research/tourism-hospitality/${name}/source-identity/sha256-${spec.processedSha256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: spec.processedSha256, bytes: processed.length, featureCount: spec.rows, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-tourism-hospitality-owner-only/1", family: name, raw: { sha256: spec.rawSha256, rows: spec.rawRows }, processed: manifest.source, rawExcluded: { invalid_geometry: spec.rawRows - spec.rows }, safeFields: spec.fields, excludedFields: name === "hotels" ? ["address", "lat", "lon"] : ["address", "description", "phone", "lat", "lon"], geometry: "Official source WGS84 Point; a static reference location. It cannot establish current operating status, availability, entry location, walking access, or transit reachability.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(resolve(output, ".."), { recursive: true }); await rm(output, { recursive: true, force: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}
const [name, root = ANALYTICS_ROOT, output = "../runtime/owner-only/tourism-hospitality"] = process.argv.slice(2); await build(name, root, output);
