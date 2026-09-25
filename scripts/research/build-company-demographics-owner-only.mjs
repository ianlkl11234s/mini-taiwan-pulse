import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const base = "data/processed/business_registry/company_demographics_grid";
const outputDefault = "../runtime/owner-only/company-demographics";
const MAX_ROWS = 20_000, MAX_BYTES = 8 * 1024 * 1024, TARGET_BYTES = 1_250_000, INITIAL_CELL = 0.1, MIN_CELL = 0.00625;
const SOURCE = {
  450: { count: 26_834, bytes: 34_413_951, sha256: "9f97d9d0e6747af17493109a43c1c42a64bae55c47b90e519ad8045c0c2918cd" },
  1500: { count: 5_745, bytes: 7_388_177, sha256: "cc71991553954c95085476508c3ec64c989f47d195b2bccc25ed084bdd33b429" },
};
const METADATA_SHA = "04ffe155c2ed2ac09e1c8d6cd1f9b2692e642a46004c69eedb1ff056129221f4";
const SOURCE_POINT_SHA = "d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b";
const AGE_FIELDS = ["age_known", "age_missing", "age_invalid", "age_recent", "age_median", "age_0_2", "age_3_5", "age_6_10", "age_11_20", "age_21_plus"];
const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const number = value => typeof value === "number" && Number.isFinite(value);
const box = ring => [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))];
const cell = ([x, y], size) => [x * size, y * size, (x + 1) * size, (y + 1) * size];
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (p, a, b) => Math.abs(orient(a, b, p)) <= 1e-12 && p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12;
const seg = (a, b, c, d) => on(a, c, d) || on(b, c, d) || on(c, a, b) || on(d, a, b) || ((orient(a, b, c) > 0) !== (orient(a, b, d) > 0) && (orient(c, d, a) > 0) !== (orient(c, d, b) > 0));
function ringContains(point, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i]; if (on(point, a, b)) return true; if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
function polygonIntersectsBox(feature, bbox) { const ring = feature.geometry.coordinates[0], rectangle = [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]; if (ring.some(point => point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3])) return true; if (rectangle.slice(0, -1).some(point => ringContains(point, ring))) return true; for (let i = 1; i < ring.length; i++) for (let j = 1; j < rectangle.length; j++) if (seg(ring[i - 1], ring[i], rectangle[j - 1], rectangle[j])) return true; return false; }
function keysFor(feature, size) { const [west, south, east, north] = feature.bbox, keys = []; for (let x = Math.floor(west / size); x <= Math.floor(east / size); x++) for (let y = Math.floor(south / size); y <= Math.floor(north / size); y++) { const current = `${x},${y}`; if (polygonIntersectsBox(feature, cell([x, y], size))) keys.push(current); } return keys; }

function safeFeature(raw, ordinal, scale, industryFields) {
  const p = raw?.properties, ring = raw?.geometry?.coordinates?.[0];
  const fields = ["grid_id", "n_companies", ...industryFields, ...AGE_FIELDS];
  if (raw?.type !== "Feature" || raw?.geometry?.type !== "Polygon" || raw.geometry.coordinates?.length !== 1 || !Array.isArray(ring) || ring.length !== 5 || !ring.every(point => Array.isArray(point) && point.length === 2 && point.every(number)) || ring[0][0] !== ring[4][0] || ring[0][1] !== ring[4][1]
    || !p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length !== fields.length || fields.some(field => !(field in p)) || typeof p.grid_id !== "string" || !new RegExp(`^G${scale}_-?\\d+_-?\\d+$`).test(p.grid_id)
    || !Number.isSafeInteger(p.n_companies) || p.n_companies < 1 || industryFields.some(field => !Number.isSafeInteger(p[field]) || p[field] < 0)
    || !["age_known", "age_missing", "age_invalid", "age_recent", "age_0_2", "age_3_5", "age_6_10", "age_11_20", "age_21_plus"].every(field => Number.isSafeInteger(p[field]) && p[field] >= 0)
    || !(p.age_median === null || number(p.age_median) && p.age_median >= 0)) fail("COMPANY_DEMOGRAPHICS_OWNER_SOURCE_FEATURE_INVALID");
  const industryTotal = industryFields.reduce((sum, field) => sum + p[field], 0);
  const ageBuckets = p.age_0_2 + p.age_3_5 + p.age_6_10 + p.age_11_20 + p.age_21_plus;
  if (industryTotal !== p.n_companies || p.age_known + p.age_missing + p.age_invalid !== p.n_companies || ageBuckets !== p.age_known || (p.age_known === 0) !== (p.age_median === null)) fail("COMPANY_DEMOGRAPHICS_OWNER_ROW_CONSERVATION_MISMATCH");
  return { type: "Feature", sourceOrdinal: ordinal, geometry: raw.geometry, properties: { ...p }, bbox: box(ring) };
}
async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) });
  if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("COMPANY_DEMOGRAPHICS_OWNER_SHARD_LIMIT_EXCEEDED");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 }), sha256 = hash(compressed), path = `${sha256}-${Buffer.from(JSON.stringify(bbox)).toString("hex")}.geojson.gz`;
  await writeFile(resolve(output, path), compressed);
  return { path, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}
async function split(output, features, bbox, size) {
  const length = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) }).length;
  if (features.length <= MAX_ROWS && length <= TARGET_BYTES) return [await writeShard(output, features, bbox)];
  if (size <= MIN_CELL) { if (features.length > MAX_ROWS || length > MAX_BYTES) fail("COMPANY_DEMOGRAPHICS_OWNER_MIN_CELL_LIMIT_EXCEEDED"); return [await writeShard(output, features, bbox)]; }
  const next = size / 2, buckets = new Map();
  for (const feature of features) for (const current of keysFor(feature, next)) { const rows = buckets.get(current) ?? []; rows.push(feature); buckets.set(current, rows); }
  const shards = []; for (const [current, rows] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await split(output, rows, cell(current.split(",").map(Number), next), next)); return shards;
}
async function buildScale(root, output, scale, metadata) {
  const sourcePath = `${base}/company_demographics_grid_${scale}m_202608.geojson`, source = await readFile(resolve(root, sourcePath)), expected = SOURCE[scale];
  if (source.length !== expected.bytes || hash(source) !== expected.sha256) fail("COMPANY_DEMOGRAPHICS_OWNER_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source), industryFields = [...metadata.industry_codes].map(code => `i_${code}`).concat("i_unknown");
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== expected.count) fail("COMPANY_DEMOGRAPHICS_OWNER_SOURCE_COUNT_MISMATCH");
  const ids = new Set(), totals = Object.fromEntries(["n_companies", ...industryFields, ...AGE_FIELDS.filter(field => field !== "age_median")].map(field => [field, 0])), buckets = new Map(); let nullMedians = 0;
  for (const [ordinal, raw] of collection.features.entries()) { const feature = safeFeature(raw, ordinal, scale, industryFields); if (ids.has(feature.properties.grid_id)) fail("COMPANY_DEMOGRAPHICS_OWNER_DUPLICATE_GRID_ID"); ids.add(feature.properties.grid_id); for (const field of Object.keys(totals)) totals[field] += feature.properties[field]; if (feature.properties.age_median === null) nullMedians++; for (const current of keysFor(feature, INITIAL_CELL)) { const rows = buckets.get(current) ?? []; rows.push(feature); buckets.set(current, rows); } }
  const expectedAge = metadata.nationwide_age_counts, expectedIndustry = metadata.nationwide_industry_counts;
  if (totals.n_companies !== 654_165 || totals.age_known !== expectedAge.known || totals.age_missing !== expectedAge.missing || totals.age_invalid !== expectedAge.invalid || totals.age_recent !== expectedAge.recent || AGE_FIELDS.filter(field => /^age_(0_2|3_5|6_10|11_20|21_plus)$/.test(field)).some(field => totals[field] !== expectedAge[field]) || industryFields.some(field => totals[field] !== expectedIndustry[field]) || nullMedians !== metadata.scales[String(scale)].age_median_null_grids) fail("COMPANY_DEMOGRAPHICS_OWNER_SCALE_CONSERVATION_MISMATCH");
  const shards = []; for (const [current, rows] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await split(output, rows, cell(current.split(",").map(Number), INITIAL_CELL), INITIAL_CELL));
  if (!shards.length || shards.length > 1024 || shards.some(shard => shard.featureCount > MAX_ROWS || shard.uncompressedBytes > MAX_BYTES)) fail("COMPANY_DEMOGRAPHICS_OWNER_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const manifest = { schemaVersion: "pulse-company-demographics-owner-surface-partitions/1", source: { sha256: expected.sha256, bytes: expected.bytes, featureCount: expected.count, reference: `/research/company-demographics-grid-${scale}m/source-identity/sha256-${expected.sha256}` }, grid: { size_m: scale, crs_projected: "EPSG:3826", crs_output: "EPSG:4326", occupied_only: true }, cellDegrees: INITIAL_CELL, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(output, `manifest-${scale}m.json`), manifestBytes); return { scale, manifest, manifestBytes, totals, nullMedians, shards: shards.length };
}
async function build(root, outputArg) {
  const output = resolve(outputArg ?? outputDefault), metadataBytes = await readFile(resolve(root, `${base}/company_demographics_grid_202608_metadata.json`));
  if (hash(metadataBytes) !== METADATA_SHA) fail("COMPANY_DEMOGRAPHICS_OWNER_METADATA_SHA_MISMATCH"); const metadata = JSON.parse(metadataBytes);
  if (metadata?.dataset_id !== "company_demographics_grid" || metadata.source_rows !== 654_165 || metadata.source_sha256 !== SOURCE_POINT_SHA || metadata.source_vintage !== "202608" || metadata.grid_system?.crs_output !== "EPSG:4326" || metadata.grid_system?.crs_projected !== "EPSG:3826" || !Array.isArray(metadata.industry_codes) || metadata.industry_codes.length !== 89) fail("COMPANY_DEMOGRAPHICS_OWNER_METADATA_INVALID");
  const temporary = `${output}.building`; await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const results = []; for (const scale of [450, 1500]) results.push(await buildScale(root, temporary, scale, metadata));
  const receipt = { schemaVersion: "pulse-company-demographics-owner-only/1", sourceVintage: "202608", sourcePointRows: 654_165, sourcePointSha256: SOURCE_POINT_SHA, exclusions: { dead_or_abnormal: 1_152, invalid_coordinate: 2_565 }, missingness: { age_setup_year_missing: 16, age_setup_year_invalid: 0 }, rights: "RIGHTS_HOLD for public redistribution: processed source records OGDL-Taiwan-1.0, but the 118-member upstream company_stock source-matrix receipts have not all been rechecked. Localhost owner-only only.", safeFields: ["grid_id", "n_companies", ...metadata.industry_codes.map(code => `i_${code}`), "i_unknown", ...AGE_FIELDS], geometry: "Full original EPSG:4326 Polygon boundaries are retained. These are occupied-only aggregation cells derived from company-registration address geocoding, not company premises, individual company Points, administrative areas, current operation, or accessibility.", scales: results.map(result => ({ size_m: result.scale, source: result.manifest.source, n_companies_total: result.totals.n_companies, industry_total: Object.keys(result.totals).filter(field => field.startsWith("i_")).reduce((sum, field) => sum + result.totals[field], 0), age_known_total: result.totals.age_known, age_missing_total: result.totals.age_missing, age_invalid_total: result.totals.age_invalid, age_median_null_grids: result.nullMedians, manifest: { path: `manifest-${result.scale}m.json`, sha256: hash(result.manifestBytes), bytes: result.manifestBytes.length }, shards: result.shards })) };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}
const [root = analyticsRoot, output] = process.argv.slice(2); await build(root, output);
