import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CELL_DEGREES = 0.1;
const MAX_FEATURES_PER_SHARD = 8_000;
const MAX_UNCOMPRESSED_BYTES = 1_500_000;
const MIN_CELL_DEGREES = 0.0125;
const safeFields = ["station_uid", "station_id", "station_name", "station_name_en", "city", "city_code", "location_city_code", "stops", "bus_type"];
const sources = {
  city: { sha256: "a585bab7d2fc98cb63e48eff461c43e5f16cf35b1fae9acd7845a5d4d7e7ac8b", count: 49_830, snapshot: "2026-02-28" },
  intercity: { sha256: "9012db171215104773a758c0a8c3d9ddba72f2e979f2195647721510ca7d558f", count: 15_383, snapshot: "2026-02-28" },
};

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

function safeFeature(feature, ordinal, type) {
  if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail("BUS_STATION_SOURCE_FEATURE_INVALID");
  const p = feature.properties;
  if (typeof p.StationUID !== "string" || !p.StationUID || typeof p.StationID !== "string" || typeof p.StationName !== "string" || !p.StationName
    || typeof p.City !== "string" || typeof p.CityCode !== "string" || typeof p.LocationCityCode !== "string"
    || !Number.isSafeInteger(p.Stops) || p.Stops < 0 || p.bus_type !== type) fail("BUS_STATION_SOURCE_PROPERTIES_INVALID");
  if (p.StationNameEn !== undefined && typeof p.StationNameEn !== "string") fail("BUS_STATION_SOURCE_PROPERTIES_INVALID");
  const [lng, lat] = feature.geometry.coordinates;
  return {
    cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
      station_uid: p.StationUID, station_id: p.StationID, station_name: p.StationName, station_name_en: p.StationNameEn || null,
      city: p.City || null, city_code: p.CityCode || null, location_city_code: p.LocationCityCode || null, stops: p.Stops, bus_type: p.bus_type,
    } },
  };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > 6 * 1024 * 1024) fail("BUS_STATION_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}
async function splitAndWrite(output, features, bbox, degrees) {
  if (features.length <= MAX_FEATURES_PER_SHARD && json({ type: "FeatureCollection", features }).length <= MAX_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    const shards = []; for (let index = 0; index < features.length; index += MAX_FEATURES_PER_SHARD) shards.push(await writeShard(output, features.slice(index, index + MAX_FEATURES_PER_SHARD), bbox)); return shards;
  }
  const children = new Map(); const childDegrees = degrees / 2;
  for (const feature of features) { const [lng, lat] = feature.geometry.coordinates; const key = cellFor(lng, lat, childDegrees).join(","); const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  const shards = []; for (const [key, child] of [...children.entries()].sort(([a], [b]) => a.localeCompare(b))) { const cell = key.split(",").map(Number); shards.push(...await splitAndWrite(output, child, cellBbox(cell, childDegrees), childDegrees)); } return shards;
}

async function build(type, inputArg, outputArg) {
  const spec = sources[type]; if (!spec || !inputArg) fail("Usage: node build-bus-stations-owner-only.mjs <city|intercity> <input.geojson> [output-dir]");
  const input = resolve(inputArg); const output = resolve(outputArg ?? `../runtime/owner-only/bus-stations/${type}`);
  const sourceBytes = await readFile(input); if (hash(sourceBytes) !== spec.sha256) fail("BUS_STATION_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(sourceBytes); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== spec.count) fail("BUS_STATION_SOURCE_COUNT_MISMATCH");
  const ids = new Set(); const buckets = new Map();
  for (const [ordinal, raw] of collection.features.entries()) { const { cell, feature } = safeFeature(raw, ordinal, type); if (ids.has(feature.properties.station_uid)) fail("BUS_STATION_SOURCE_UID_DUPLICATE"); ids.add(feature.properties.station_uid); const key = cell.join(","); const list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list); }
  await rm(output, { recursive: true, force: true }); const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = []; for (const [key, features] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  const reference = `/research/bus-stations/${type}/source-identity/sha256-${spec.sha256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: spec.sha256, bytes: sourceBytes.length, featureCount: spec.count, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-bus-stations-owner-only/1", source: manifest.source, snapshot: spec.snapshot, sourceProduct: type === "city" ? "TDX /v2/Bus/Station/City/{City}; 2025-11 tri-city + 2026-02-13/28 city batches, deduplicated StationUID" : "TDX /v2/Bus/Station/InterCity; 2026-02-28 fixed snapshot", safeFields, excludedFields: ["StationAddress", "lat", "lng", "StationNameEn raw empty string"], geometry: "TDX StationPosition WGS84 Point; a station location rather than a stop pole, route, vehicle position, timetable or live arrival status", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [type, input, output] = process.argv.slice(2); await build(type, input, output);
