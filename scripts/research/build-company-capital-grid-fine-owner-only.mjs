import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const base = "data/processed/business_registry/company_capital_grid";
const outputDefault = "../runtime/owner-only/company-capital-grid-fine";
const maxRows = 20_000;
const maxBytes = 8 * 1024 * 1024;
const targetBytes = 1_250_000;
const initialCellDegrees = 0.1;
const minCellDegrees = 0.00625;
const safeFields = ["grid_id", "capital_sum", "n_companies", "capital_median"];
const scales = [
  { size: 150, count: 89_754, sha256: "a0da52b2b1ac58edff22f214d6a8ebda23aa4437476eee8af6d0b4bbc2204d03", bytes: 33_035_760, missingMedian: 35 },
  { size: 450, count: 26_834, sha256: "c79e8b49cf61ffb8292ad3c46ff26d799d7482b37529c7bfee2e15bc78536747", bytes: 9_939_217, missingMedian: 11 },
];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const coord = value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180;
const validRing = ring => Array.isArray(ring) && ring.length === 5 && ring.every(point => Array.isArray(point) && point.length === 2 && coord(point[0]) && coord(point[1]))
  && ring[0][0] === ring[4][0] && ring[0][1] === ring[4][1];
const bboxOf = ring => [Math.min(...ring.map(point => point[0])), Math.min(...ring.map(point => point[1])), Math.max(...ring.map(point => point[0])), Math.max(...ring.map(point => point[1]))];
const cellFor = (lng, lat, degrees) => [Math.floor(lng / degrees), Math.floor(lat / degrees)];
const cellBbox = ([x, y], degrees) => [x * degrees, y * degrees, (x + 1) * degrees, (y + 1) * degrees];

function safeFeature(raw, ordinal, size) {
  const p = raw?.properties; const ring = raw?.geometry?.coordinates?.[0];
  if (raw?.type !== "Feature" || raw.geometry?.type !== "Polygon" || raw.geometry.coordinates?.length !== 1 || !validRing(ring)
    || !p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length !== safeFields.length || safeFields.some(field => !(field in p))
    || typeof p.grid_id !== "string" || !new RegExp(`^G${size === 150 ? "" : size}_-?\\d+_-?\\d+$`).test(p.grid_id)
    || !Number.isSafeInteger(p.capital_sum) || p.capital_sum < 0 || !Number.isSafeInteger(p.n_companies) || p.n_companies < 1
    || !(p.capital_median === null || typeof p.capital_median === "number" && Number.isFinite(p.capital_median) && p.capital_median > 0)
    || (p.capital_sum === 0) !== (p.capital_median === null)) fail("COMPANY_CAPITAL_GRID_FINE_SOURCE_FEATURE_INVALID");
  return { type: "Feature", sourceOrdinal: ordinal, geometry: raw.geometry, properties: { ...p }, bbox: bboxOf(ring) };
}

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) });
  if (features.length > maxRows || payload.length > maxBytes) fail("COMPANY_CAPITAL_GRID_FINE_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

async function splitAndWrite(output, features, bbox, degrees) {
  const payloadBytes = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) }).length;
  if (features.length <= maxRows && payloadBytes <= targetBytes) return [await writeShard(output, features, bbox)];
  if (degrees <= minCellDegrees) {
    if (features.length > maxRows || payloadBytes > maxBytes) fail("COMPANY_CAPITAL_GRID_FINE_MIN_CELL_LIMIT_EXCEEDED");
    return [await writeShard(output, features, bbox)];
  }
  const childDegrees = degrees / 2; const children = new Map();
  for (const feature of features) {
    const [west, south, east, north] = feature.bbox;
    const keys = new Set([[west, south], [west, north], [east, south], [east, north]].map(([lng, lat]) => cellFor(lng, lat, childDegrees).join(",")));
    // Each grid appears in every child cell it intersects. Query-time ordinals de-duplicate it.
    for (const key of keys) { const list = children.get(key) ?? []; list.push(feature); children.set(key, list); }
  }
  const shards = [];
  for (const [key, child] of [...children.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, child, cellBbox(key.split(",").map(Number), childDegrees), childDegrees));
  return shards;
}

async function buildScale(root, output, scale) {
  const relative = `${base}/company_capital_grid_${scale.size}m_202608_r2.geojson`;
  const source = await readFile(resolve(root, relative)); if (hash(source) !== scale.sha256 || source.length !== scale.bytes) fail("COMPANY_CAPITAL_GRID_FINE_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== scale.count) fail("COMPANY_CAPITAL_GRID_FINE_SOURCE_COUNT_MISMATCH");
  const ids = new Set(); let companies = 0, capital = 0, nullMedian = 0; const buckets = new Map();
  for (const [ordinal, raw] of collection.features.entries()) {
    const feature = safeFeature(raw, ordinal, scale.size); if (ids.has(feature.properties.grid_id)) fail("COMPANY_CAPITAL_GRID_FINE_DUPLICATE_GRID_ID"); ids.add(feature.properties.grid_id);
    companies += feature.properties.n_companies; capital += feature.properties.capital_sum; if (feature.properties.capital_median === null) nullMedian++;
    const [west, south, east, north] = feature.bbox;
    const keys = new Set([[west, south], [west, north], [east, south], [east, north]].map(([lng, lat]) => cellFor(lng, lat, initialCellDegrees).join(",")));
    for (const key of keys) { const bucket = buckets.get(key) ?? []; bucket.push(feature); buckets.set(key, bucket); }
  }
  if (companies !== 654_165 || capital !== 40_627_610_824_468 || nullMedian !== scale.missingMedian) fail("COMPANY_CAPITAL_GRID_FINE_CONSERVATION_MISMATCH");
  const shards = [];
  for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(...await splitAndWrite(output, features, cellBbox(key.split(",").map(Number), initialCellDegrees), initialCellDegrees));
  if (!shards.length || shards.length > 1024 || shards.some(shard => shard.featureCount > maxRows || shard.uncompressedBytes > maxBytes)) fail("COMPANY_CAPITAL_GRID_FINE_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const reference = `/research/company-capital-grid-${scale.size}m/source-identity/sha256-${scale.sha256}`;
  const manifest = { schemaVersion: "pulse-company-capital-grid-surface-partitions/1", source: { sha256: scale.sha256, bytes: source.length, featureCount: scale.count, reference }, grid: { size_m: scale.size, crs_projected: "EPSG:3826", crs_output: "EPSG:4326", occupied_only: true }, cellDegrees: initialCellDegrees, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(output, `manifest-${scale.size}m.json`), manifestBytes);
  return { scale, manifest, manifestBytes, companies, capital, nullMedian, shards: shards.length };
}

async function build(root, outputArg) {
  const output = resolve(outputArg ?? outputDefault); const temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const receipts = []; for (const scale of scales) receipts.push(await buildScale(root, temporary, scale));
  const receipt = { schemaVersion: "pulse-company-capital-grid-fine-owner-only/1", sourceVintage: "202608", sourceRows: 657_882, exclusions: { dead_or_abnormal: 1_152, invalid_coordinate: 2_565 }, publishedCompanies: 654_165, rights: "Processed manifest records OGDL-Taiwan-1.0 for the GCIS source matrix. Per-upstream receipt review remains incomplete, so this is localhost owner-only and does not establish public redistribution rights.", safeFields, geometry: "Full original EPSG:4326 Polygon boundaries are retained. These are occupied-only aggregation cells derived from business-address geocoding, not company premises, company points, administrative areas, or a current-operating-company claim.", scales: receipts.map(item => ({ size_m: item.scale.size, source: item.manifest.source, capital_sum_total: item.capital, n_companies_total: item.companies, capital_median_null_count: item.nullMedian, manifest: { path: `manifest-${item.scale.size}m.json`, sha256: hash(item.manifestBytes), bytes: item.manifestBytes.length }, shards: item.shards })) };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = analyticsRoot, output] = process.argv.slice(2);
await build(root, output);
