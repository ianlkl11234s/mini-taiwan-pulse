import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ANALYTICS_ROOT = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const RAW = "data/raw/agriculture/produce_wholesale_companies/produce_wholesale_companies_20260522.csv";
const PROCESSED = "data/processed/agriculture/produce_wholesale_companies/produce_wholesale_companies.geojson";
const RAW_SHA256 = "4aba5f45721c1124b800ed94e5bd22b6996cdbd3a9ca6ada6e79fea74a2eebe2";
const SOURCE_SHA256 = "95891f3dfef06431bdb49b04e72503c1de865ffb5704da50179bad6564e25008";
const SOURCE_ROWS = 22_843, CELL_DEGREES = 0.1, MAX_ROWS = 20_000, MAX_BYTES = 8 * 1024 * 1024;
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const fail = code => { throw new Error(code); };
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(Number.isFinite) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 124 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const cellFor = (lng, lat) => [Math.floor(lng / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)];
const cellBbox = ([x, y]) => [x * CELL_DEGREES, y * CELL_DEGREES, (x + 1) * CELL_DEGREES, (y + 1) * CELL_DEGREES];
function csvRows(value) { const rows = []; let row = [], field = "", quoted = false; for (let index = 0; index < value.length; index++) { const char = value[index], next = value[index + 1]; if (char === "\"") { if (quoted && next === "\"") { field += char; index++; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(field); field = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index++; row.push(field); if (row.some(cell => cell !== "")) rows.push(row); row = []; field = ""; } else field += char; } if (quoted) fail("AGRI_PRODUCE_WHOLESALE_RAW_CSV_INVALID"); if (field || row.length) { row.push(field); rows.push(row); } return rows; }

async function writeShard(output, features, bbox) {
  const payload = json({ type: "FeatureCollection", features });
  if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("AGRI_PRODUCE_WHOLESALE_SHARD_LIMIT");
  const compressed = gzipSync(payload, { level: 9, mtime: 0 });
  const sha256 = hash(compressed);
  await writeFile(resolve(output, `${sha256}.geojson.gz`), compressed);
  return { path: `${sha256}.geojson.gz`, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox };
}

const [analyticsRoot = ANALYTICS_ROOT, outputArg] = process.argv.slice(2);
const rawBytes = await readFile(resolve(analyticsRoot, RAW));
if (hash(rawBytes) !== RAW_SHA256) fail("AGRI_PRODUCE_WHOLESALE_RAW_SHA_MISMATCH");
const rawRows = csvRows(rawBytes.toString("utf8").replace(/^\uFEFF/, "")), rawHeader = rawRows[0], statusColumn = rawHeader?.indexOf("公司狀態");
if (!rawHeader || rawHeader.length !== 9 || rawRows.length - 1 !== 35_218 || statusColumn === undefined || statusColumn < 0 || rawRows.slice(1).filter(row => row[statusColumn] === "核准設立").length !== 23_046) fail("AGRI_PRODUCE_WHOLESALE_RAW_SCOPE_MISMATCH");
const sourceBytes = await readFile(resolve(analyticsRoot, PROCESSED));
if (hash(sourceBytes) !== SOURCE_SHA256) fail("AGRI_PRODUCE_WHOLESALE_PROCESSED_SHA_MISMATCH");
const source = JSON.parse(sourceBytes);
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== SOURCE_ROWS) fail("AGRI_PRODUCE_WHOLESALE_COUNT_MISMATCH");

const buckets = new Map(), producedAt = new Map();
for (const [ordinal, feature] of source.features.entries()) {
  const properties = feature?.properties;
  if (!validPoint(feature?.geometry) || !properties || properties.business_type !== "produce_wholesale" || properties["公司狀態"] !== "核准設立"
    || properties.source_dataset_id !== "45655" || properties.source_slug !== "produce_wholesale_companies" || typeof properties["產製日期"] !== "string") fail("AGRI_PRODUCE_WHOLESALE_SOURCE_SCOPE_MISMATCH");
  producedAt.set(properties["產製日期"], (producedAt.get(properties["產製日期"]) ?? 0) + 1);
  const [lng, lat] = feature.geometry.coordinates, key = cellFor(lng, lat).join(","), features = buckets.get(key) ?? [];
  features.push({ type: "Feature", sourceOrdinal: ordinal, geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
    business_type: properties.business_type, company_status: properties["公司狀態"], produced_at: properties["產製日期"], source_dataset_id: properties.source_dataset_id, source_slug: properties.source_slug,
  } });
  buckets.set(key, features);
}
if (producedAt.size !== 4) fail("AGRI_PRODUCE_WHOLESALE_PRODUCED_AT_MISMATCH");

const output = resolve(outputArg ?? "../runtime/owner-only/agri-produce-wholesale"), temporary = `${output}.building`;
await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
const shards = [];
for (const [key, features] of [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right))) shards.push(await writeShard(temporary, features, cellBbox(key.split(",").map(Number))));
if (!shards.length || shards.length > 1024 || shards.reduce((total, shard) => total + shard.featureCount, 0) !== SOURCE_ROWS) fail("AGRI_PRODUCE_WHOLESALE_PARTITION_MISMATCH");
const reference = `/research/agri-produce-wholesale/source-identity/sha256-${SOURCE_SHA256}`;
const manifest = { schemaVersion: "pulse-point-partitions/2", source: { sha256: SOURCE_SHA256, bytes: sourceBytes.length, featureCount: SOURCE_ROWS, reference }, cellDegrees: CELL_DEGREES, shards };
const manifestBytes = json(manifest);
const receipt = {
  schemaVersion: "pulse-agri-produce-wholesale-owner-only/1", source: manifest.source,
  raw: { sha256: RAW_SHA256, rows: 35_218 }, snapshot: "2026-05-25", license: "OGDL-Taiwan-1.0; TGOS-derived coordinates redistribution is HOLD.",
  sourceCounts: { approved: 23_046, tgos_geocode_miss: 203, published_point: SOURCE_ROWS }, safeFields: ["business_type", "company_status", "produced_at", "source_dataset_id", "source_slug"],
  excludedFields: ["統一編號", "公司名稱", "負責人", "公司地址", "資本總額", "lon", "lat", "row_id"],
  geometry: "TGOS address-geocoded reference Point; owner-only bbox lookup only. No nearest, distance, access, coverage, entrance, current-business, or national-completeness claim.",
  manifest: { sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length,
};
await writeFile(resolve(temporary, "manifest.json"), manifestBytes); await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt));
await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
