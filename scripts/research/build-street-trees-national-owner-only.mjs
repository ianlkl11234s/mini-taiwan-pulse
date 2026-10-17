import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ANALYTICS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const SOURCE = "data/processed/urban_open_space/street_trees_national/street_trees_national_20260714.geojson";
const TAIPEI = "data/raw/urban_open_space/street_trees_taipei_diff/taipei_tree_20260712.json";
const TAICHUNG = "data/processed/urban_open_space/street_trees_taichung/street_trees_taichung.geojson";
const SOURCE_SHA256 = "a9b2e18ec60e2444bc263bb0bf1c9ee804b66a7a62064a38affb6a7890f6de99";
const TAIPEI_SHA256 = "80c8c567d3e80d9e5ddeb186b8d41844160a71fea6eb58d72cd39a5daa98949e";
const TAICHUNG_SHA256 = "7743407091c35e0a110c6a478a0aaa77caf54dc6484993d2e06af4004e1d4ca3";
const SOURCE_ROWS = 210_436, CELL_DEGREES = 0.025, MAX_ROWS = 20_000, MAX_BYTES = 8 * 1024 * 1024;
const SAFE_FIELDS = ["tree_id", "species", "dbh_cm", "height_m", "city", "district", "location_type", "survey_date", "source"];
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const fail = code => { throw new Error(code); };
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(Number.isFinite) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 124 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const cellFor = (lng, lat) => [Math.floor(lng / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)];
const cellBbox = ([x, y]) => [x * CELL_DEGREES, y * CELL_DEGREES, (x + 1) * CELL_DEGREES, (y + 1) * CELL_DEGREES];

async function required(root, path, expected, code) { const bytes = await readFile(resolve(root, path)); if (hash(bytes) !== expected) fail(code); return bytes; }
async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("STREET_TREES_NATIONAL_SHARD_LIMIT");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }), sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

const [analyticsRoot = ANALYTICS_ROOT, outputArg] = process.argv.slice(2);
const taipei = JSON.parse(await required(analyticsRoot, TAIPEI, TAIPEI_SHA256, "STREET_TREES_NATIONAL_TAIPEI_SHA_MISMATCH"));
const taichung = JSON.parse(await required(analyticsRoot, TAICHUNG, TAICHUNG_SHA256, "STREET_TREES_NATIONAL_TAICHUNG_SHA_MISMATCH"));
if (!Array.isArray(taipei) || taipei.length !== 92_033 || taipei.some(row => !row?.TWD97X || !row?.TWD97Y) || taichung?.type !== "FeatureCollection" || !Array.isArray(taichung.features) || taichung.features.length !== 118_403) fail("STREET_TREES_NATIONAL_UPSTREAM_SCOPE_MISMATCH");
const sourceBytes = await required(analyticsRoot, SOURCE, SOURCE_SHA256, "STREET_TREES_NATIONAL_SOURCE_SHA_MISMATCH");
const source = JSON.parse(sourceBytes);
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== SOURCE_ROWS) fail("STREET_TREES_NATIONAL_COUNT_MISMATCH");

const buckets = new Map(), counts = { taipei: 0, taichung: 0, taichung_sidewalk: 0, taichung_park_plaza: 0, taichung_greenway: 0, empty_location_type: 0, empty_survey_date: 0 };
for (const [ordinal, feature] of source.features.entries()) {
  const properties = feature?.properties;
  if (!validPoint(feature?.geometry) || !properties || !["taipei", "taichung"].includes(properties.city) || !["taipei_open_data", "taichung_open_data"].includes(properties.source)
    || properties.source !== `${properties.city}_open_data` || SAFE_FIELDS.some(field => !(field in properties)) || typeof properties.tree_id !== "string" || typeof properties.species !== "string"
    || !Number.isFinite(properties.dbh_cm) || !Number.isFinite(properties.height_m) || typeof properties.district !== "string" || typeof properties.location_type !== "string" || typeof properties.survey_date !== "string") fail("STREET_TREES_NATIONAL_SOURCE_SCOPE_MISMATCH");
  counts[properties.city]++; if (properties.location_type === "") counts.empty_location_type++; if (properties.survey_date === "") counts.empty_survey_date++;
  if (properties.city === "taichung") { if (properties.location_type === "人行道") counts.taichung_sidewalk++; else if (properties.location_type === "公園廣場") counts.taichung_park_plaza++; else if (properties.location_type === "綠地園道") counts.taichung_greenway++; else fail("STREET_TREES_NATIONAL_TAICHUNG_LOCATION_TYPE_MISMATCH"); }
  const [lng, lat] = feature.geometry.coordinates, key = cellFor(lng, lat).join(","), features = buckets.get(key) ?? [];
  features.push({ type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, properties[field]])) });
  buckets.set(key, features);
}
if (counts.taipei !== 92_033 || counts.taichung !== 118_403 || counts.taichung_sidewalk !== 48_124 || counts.taichung_park_plaza !== 61_321 || counts.taichung_greenway !== 8_958 || counts.empty_location_type !== 13_121 || counts.empty_survey_date !== 1) fail("STREET_TREES_NATIONAL_CONSERVATION_MISMATCH");

const output = resolve(outputArg ?? "../runtime/owner-only/street-trees-national"), temporary = `${output}.building`;
await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
const shards = [];
for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(await writeShard(temporary, features, cellBbox(key.split(",").map(Number))));
if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_ROWS) fail("STREET_TREES_NATIONAL_PARTITION_MISMATCH");
const reference = `/research/street-trees-national/source-identity/sha256-${SOURCE_SHA256}`;
const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_ROWS, reference }, cellDegrees: CELL_DEGREES, shards }, manifestBytes = json(manifest);
const receipt = { schemaVersion: "pulse-street-trees-national-owner-only/1", source: manifest.source, upstream: { taipei: { path: TAIPEI, sha256: TAIPEI_SHA256, rows: 92_033, snapshot: "2026-07-12", license: "OGDL-Taiwan-1.0" }, taichung: { path: TAICHUNG, sha256: TAICHUNG_SHA256, rows: 118_403, survey: "2016-2019; 2020-04-22 map", license: "OGDL-Taiwan-1.0" } }, safeFields: SAFE_FIELDS, excludedFields: ["address", "lat", "lon"], sourceCounts: counts, coverage: "Only Taipei and Taichung; the two city snapshots are heterogeneous and not a national or simultaneous inventory.", geometry: "Reference Point proxy; owner-only bbox lookup only. No nearest, distance, access, coverage, national comparison, time-series, current-condition, or street-tree-only claim.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
await writeFile(resolve(temporary, "manifest.json"), manifestBytes); await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
