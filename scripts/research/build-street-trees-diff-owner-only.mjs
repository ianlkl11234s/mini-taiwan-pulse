import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const SOURCE_SHA256 = "95dd7c6e1cabfac3662cd3ada3a5880bd2e122208fd55224c1aaecd6ccf7d3ce";
const SOURCE_COUNT = 99_527;
const CELL_DEGREES = 0.1;
const MIN_CELL_DEGREES = 0.0125;
const MAX_FEATURES_PER_SHARD = 20_000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const TARGET_UNCOMPRESSED_BYTES = 1_500_000;
const SAFE_FIELDS = ["status", "renumber_suspect", "survey_date"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat, degrees = CELL_DEGREES) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 121.4 && geometry.coordinates[0] <= 121.7 && geometry.coordinates[1] >= 24.9 && geometry.coordinates[1] <= 25.2;

function safeFeature(raw, ordinal) {
  const p = raw?.properties;
  if (raw?.type !== "Feature" || !validPoint(raw.geometry) || !p || typeof p !== "object"
    || typeof p.TreeID !== "string" || !p.TreeID || !["persisted", "disappeared", "appeared"].includes(p.status)
    || typeof p.renumber_suspect !== "boolean" || typeof p.SurveyDate !== "string") fail("STREET_TREES_DIFF_SOURCE_FEATURE_INVALID");
  const [lng, lat] = raw.geometry.coordinates;
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
    status: p.status, renumber_suspect: p.renumber_suspect, survey_date: p.SurveyDate,
  } } };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_FEATURES_PER_SHARD || payload.length > MAX_UNCOMPRESSED_BYTES) fail("STREET_TREES_DIFF_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 });
  const digest = hash(compressed);
  await writeFile(resolve(output, `${digest}.geojson.gz`), compressed);
  return { path: `${digest}.geojson.gz`, sha256: digest, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features }).length;
  if (features.length <= MAX_FEATURES_PER_SHARD && payloadBytes <= TARGET_UNCOMPRESSED_BYTES) return [await writeShard(output, features, bbox)];
  if (degrees <= MIN_CELL_DEGREES) {
    if (payloadBytes > MAX_UNCOMPRESSED_BYTES) fail("STREET_TREES_DIFF_MIN_CELL_LIMIT_EXCEEDED");
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
    list.push(feature); children.set(key, list);
  }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

async function build(inputArg, outputArg) {
  if (!inputArg) fail("Usage: node build-street-trees-diff-owner-only.mjs <street_trees_taipei_diff_20260712.geojson> [output-dir]");
  const input = resolve(inputArg), output = resolve(outputArg ?? "../runtime/owner-only/street-trees-diff");
  const sourceBytes = await readFile(input);
  if (hash(sourceBytes) !== SOURCE_SHA256) fail("STREET_TREES_DIFF_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(sourceBytes);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("STREET_TREES_DIFF_SOURCE_COUNT_MISMATCH");
  const buckets = new Map(); const statusCounts = { persisted: 0, disappeared: 0, appeared: 0 }; let renumberSuspect = 0;
  for (const [ordinal, raw] of collection.features.entries()) {
    const { cell, feature } = safeFeature(raw, ordinal);
    statusCounts[feature.properties.status]++; if (feature.properties.renumber_suspect) renumberSuspect++;
    const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list);
  }
  if (statusCounts.persisted !== 88_004 || statusCounts.disappeared !== 7_494 || statusCounts.appeared !== 4_029 || renumberSuspect !== 447) fail("STREET_TREES_DIFF_SOURCE_SEMANTICS_MISMATCH");
  await rm(output, { recursive: true, force: true });
  const temporary = `${output}.building`; await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(temporary, features, cellBbox(key.split(",").map(Number), CELL_DEGREES), CELL_DEGREES));
  if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_COUNT) fail("STREET_TREES_DIFF_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/street-trees-taipei-diff/source-identity/sha256-${SOURCE_SHA256}`;
  const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-street-trees-diff-owner-only/1", source: manifest.source, snapshot: { baseline: "2024-11-21 Wayback", current: "2026-07-12 TaipeiTree.json" }, statusCounts, renumberSuspect, license: "OGDL-Taiwan-1.0; 2024 baseline is a non-official Wayback snapshot.", safeFields: SAFE_FIELDS, excludedFields: ["TreeID", "TreeType", "Dist", "Region", "Diameter", "TreeHeight"], geometry: "WGS84 tree inventory reference Point. It is a proxy for bounded record lookup only, not a tree entrance, exact nearest result, walking access, or service coverage.", semantics: "disappeared means TreeID absent from the current inventory, not felled. renumber_suspect marks likely renumbering. Region is excluded because about 10% are park/green-space names rather than roads.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt));
  await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [input, output] = process.argv.slice(2);
await build(input, output);
