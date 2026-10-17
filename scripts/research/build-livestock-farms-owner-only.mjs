import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const sourcePath = "public/agriculture/livestock_farms.geojson";
const SOURCE_SHA256 = "41c3244b7eff050697fd746282d79b5c75c688960fa38c3c644b80e241819e13";
const SOURCE_COUNT = 13_087;
const CELL_DEGREES = 0.1;
const MAX_ROWS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;
const EXPECTED = { cattle: 574, chicken: 5176, duck: 1305, goose: 531, other: 273, pig: 4584, sheep: 644 };
const SAFE_FIELDS = ["animal_category", "coordinate_source", "coordinate_precision"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const cellFor = (lng, lat) => [Math.floor(lng / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)];
const cellBbox = ([x, y]) => [x * CELL_DEGREES, y * CELL_DEGREES, (x + 1) * CELL_DEGREES, (y + 1) * CELL_DEGREES];
function category(animal) { return ({ "牛": "cattle", "雞": "chicken", "鴨": "duck", "鵝": "goose", "豬": "pig", "羊": "sheep" })[animal] ?? "other"; }
function safeFeature(raw, ordinal) {
  const properties = raw?.properties, geometry = raw?.geometry, [lng, lat] = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  if (raw?.type !== "Feature" || geometry?.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2 || typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < 118 || lng > 122.5 || lat < 21.5 || lat > 26.5 || typeof properties?.["主畜種"] !== "string" || !properties["主畜種"] || typeof properties?.["定位來源"] !== "string" || typeof properties?.["精度"] !== "string" || !["高", "中", "低"].includes(properties["精度"])) fail("LIVESTOCK_FARMS_SOURCE_ROW_SEMANTICS_MISMATCH");
  return { cell: cellFor(lng, lat), feature: { type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: { animal_category: category(properties["主畜種"]), coordinate_source: properties["定位來源"], coordinate_precision: properties["精度"] } } };
}
async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features }); if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("LIVESTOCK_FARMS_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }), sha256 = hash(compressed); await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}
async function build(outputArg) {
  const source = await readFile(resolve(process.cwd(), sourcePath)); if (hash(source) !== SOURCE_SHA256) fail("LIVESTOCK_FARMS_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source.toString("utf8")); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("LIVESTOCK_FARMS_SOURCE_SCHEMA_MISMATCH");
  const buckets = new Map(), counts = Object.fromEntries(Object.keys(EXPECTED).map(key => [key, 0])), precision = { "高": 0, "中": 0, "低": 0 }, coordinateSource = {};
  for (const [ordinal, raw] of collection.features.entries()) { const { cell, feature } = safeFeature(raw, ordinal); counts[feature.properties.animal_category]++; precision[feature.properties.coordinate_precision]++; coordinateSource[feature.properties.coordinate_source] = (coordinateSource[feature.properties.coordinate_source] ?? 0) + 1; const key = cell.join(","), list = buckets.get(key) ?? []; list.push(feature); buckets.set(key, list); }
  if (JSON.stringify(counts) !== JSON.stringify(EXPECTED) || precision["高"] !== 12_271 || precision["中"] !== 47 || precision["低"] !== 769) fail("LIVESTOCK_FARMS_SOURCE_CONSERVATION_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/livestock-farms"), temporary = `${output}.building`; await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const shards = []; for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(await writeShard(temporary, features, cellBbox(key.split(",").map(Number))));
  if (!shards.length || shards.length > 1024 || shards.reduce((sum, shard) => sum + shard.featureCount, 0) !== SOURCE_COUNT) fail("LIVESTOCK_FARMS_PARTITION_MANIFEST_MISMATCH");
  const reference = `/research/livestock-farms/source-identity/sha256-${SOURCE_SHA256}`, manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference }, cellDegrees: CELL_DEGREES, shards }, manifestBytes = json(manifest);
  await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-livestock-farms-owner-only/1", source: manifest.source, snapshot: "2026-07-05 enriched-v3 local fallback", license: "RIGHTS_HOLD: catalog records OGDL-Taiwan-1.0, but 857 Google-derived coordinates and EMS/NLSC/twland coordinate-use/redistribution terms lack per-record receipts.", safeFields: SAFE_FIELDS, categoryCounts: counts, precisionCounts: precision, coordinateSourceCounts: coordinateSource, excludedFields: ["場名", "證號", "縣市", "段", "地號", "種類明細", "總隻數"], geometry: "Mixed NLSC/twland/EMS/Google reference points; owner-only bbox record lookup only. No nearest, distance, access, coverage, county comparison, total-head aggregate, precise-farm, current-RPC, public release, or national-completeness claim.", missingness: "ARIS batch01+02+03 coverage is partial. J06 mother list has 9,999 county-level rows without coordinates; missing farms are not zero. Low precision 769 rows are segment-centroid Google references.", displayRelationship: "Mini local livestock_farms.geojson and analytics enriched 20260705 GeoJSON have the same SHA. Current owner-only get_livestock_farms RPC release was not read and is not claimed equivalent.", manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}
await build(process.argv[2]);
