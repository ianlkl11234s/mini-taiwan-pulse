import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const sourceRelative = "data/processed/water_resources/groundwater/groundwater_wells.geojson";
const SOURCE_SHA256 = "f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2";
const SOURCE_COUNT = 959;
const CELL_DEGREES = 0.5;
const MAX_ROWS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;
const SAFE_FIELDS = ["well_id", "well_name", "reported_county", "is_active", "elevation_m", "well_depth_m", "aquifer_type", "groundwater_zone"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat) => [Math.floor(lng / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)];
const cellBbox = ([x, y]) => [x * CELL_DEGREES, y * CELL_DEGREES, (x + 1) * CELL_DEGREES, (y + 1) * CELL_DEGREES];

function safeFeature(raw, ordinal) {
  const properties = raw?.properties, geometry = raw?.geometry;
  const [lng, lat] = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const metadata = properties?.metadata;
  if (raw?.type !== "Feature" || geometry?.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2
    || typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < 118 || lng > 122.5 || lat < 21.5 || lat > 26.5
    || typeof properties?.id !== "string" || !properties.id || typeof properties.name !== "string" || !properties.name
    || typeof properties.county !== "string" || !properties.county || typeof properties.is_active !== "boolean"
    || properties.elevation_m !== null || !metadata || typeof metadata !== "object"
    || !(metadata.well_depth_m === null || typeof metadata.well_depth_m === "number" && Number.isFinite(metadata.well_depth_m))
    || !(metadata.layer_attribute === null || typeof metadata.layer_attribute === "string") || typeof metadata.groundwater_zone !== "string" || !metadata.groundwater_zone) fail("GROUNDWATER_WELLS_SOURCE_ROW_SEMANTICS_MISMATCH");
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
    well_id: properties.id, well_name: properties.name, reported_county: properties.county, is_active: properties.is_active,
    elevation_m: properties.elevation_m, well_depth_m: metadata.well_depth_m, aquifer_type: metadata.layer_attribute, groundwater_zone: metadata.groundwater_zone,
  } } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("GROUNDWATER_WELLS_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }), sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function build(root, outputArg) {
  const source = await readFile(resolve(root, sourceRelative));
  if (hash(source) !== SOURCE_SHA256) fail("GROUNDWATER_WELLS_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("GROUNDWATER_WELLS_SOURCE_SCHEMA_MISMATCH");
  const ids = new Set(), buckets = new Map(), nulls = { elevation_m: 0, well_depth_m: 0, aquifer_type: 0 }, activity = { active: 0, inactive: 0 };
  for (const [ordinal, raw] of collection.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal);
    if (ids.has(feature.properties.well_id)) fail("GROUNDWATER_WELLS_SOURCE_DUPLICATE_ID");
    ids.add(feature.properties.well_id);
    for (const key of Object.keys(nulls)) if (feature.properties[key] === null) nulls[key]++;
    if (feature.properties.is_active) activity.active++; else activity.inactive++;
    const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  if (ids.size !== SOURCE_COUNT || nulls.elevation_m !== SOURCE_COUNT || nulls.well_depth_m !== 1 || nulls.aquifer_type !== 0 || activity.active !== 0 || activity.inactive !== SOURCE_COUNT) fail("GROUNDWATER_WELLS_SOURCE_CONSERVATION_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/groundwater-wells"), temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(await writeShard(temporary, features, cellBbox(key.split(",").map(Number))));
  if (!shards.length || shards.length > 1024 || shards.reduce((sum, shard) => sum + shard.featureCount, 0) !== SOURCE_COUNT) fail("GROUNDWATER_WELLS_PARTITION_MANIFEST_MISMATCH");
  const reference = `/research/groundwater-wells/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest);
  await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-groundwater-wells-owner-only/1", source: manifest.source, snapshot: "processed 2026-05-19 WRA static station metadata", publisher: "經濟部水利署 WRA", license: "OGDL-Taiwan-1.0", safeFields: SAFE_FIELDS, nullCounts: nulls, activityCounts: activity, excludedFields: ["address", "township", "station_type", "source", "metadata.base_elevation_m", "metadata.established_date", "metadata.water_resources_zone"], geometry: "Fixed WRA processed Point reference coordinates. Owner-only bbox lookup only: no nearest, distance, coverage, access, containment, or precise-current-position claim.", fieldWarnings: { elevation_m: "All 959 values are source null; retained without filtering or aggregation.", is_active: "All 959 values are false although catalog semantics conflict; retained without filtering or aggregation.", reported_county: "Source-reported county conflicts with locations; it is readable provenance only and must not support county comparison or geographic filtering." }, scope: "Only layerRef groundwaterWells static station metadata. It does not represent the groundwater live observation layer, water levels, observed_at, or water monitoring currentness.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = analyticsRoot, output] = process.argv.slice(2); await build(root, output);
