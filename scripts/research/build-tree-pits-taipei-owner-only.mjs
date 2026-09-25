import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const processedPath = "data/processed/urban_open_space/tree_pits_taipei/tree_pits_taipei_20260714.geojson";
const rawPath = "data/raw/urban_open_space/tree_pit_taipei.json";
const outputDefault = "../runtime/owner-only/tree-pits-taipei";
const PROCESSED_SHA = "72197a37c4446a456effa722eb1e6a96e4c200e1c71343322857f7455c13000e";
const RAW_SHA = "9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03";
const ROWS = 56_720, MAX_ROWS = 20_000, MAX_BYTES = 8 * 1024 * 1024, TARGET_BYTES = 1_200_000;
const INITIAL_CELL = 0.02, MIN_CELL = 0.0025;
const SAFE_FIELDS = ["pit_id", "pit_type", "district", "area_m2"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const pos = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
const ring = value => Array.isArray(value) && value.length >= 4 && value.every(pos) && value[0][0] === value.at(-1)[0] && value[0][1] === value.at(-1)[1];
const polygon = value => Array.isArray(value) && value.length && value.every(ring);
const multi = value => Array.isArray(value) && value.length && value.every(polygon);
const box = points => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const cellFor = (lng, lat, size) => [Math.floor(lng / size), Math.floor(lat / size)];
const cellBox = (key, size) => { const [x, y] = key.split(",").map(Number); return [x * size, y * size, (x + 1) * size, (y + 1) * size]; };
const pointInBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (p, a, b) => Math.abs(orient(a, b, p)) <= 1e-12 && p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12;
const seg = (a, b, c, d) => on(a, c, d) || on(b, c, d) || on(c, a, b) || on(d, a, b) || ((orient(a, b, c) > 0) !== (orient(a, b, d) > 0) && (orient(c, d, a) > 0) !== (orient(c, d, b) > 0));
function ringLocation(p, coordinates) { let inside = false; for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) { const a = coordinates[j], b = coordinates[i]; if (on(p, a, b)) return "boundary"; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside ? "inside" : "outside"; }
function polygonLocation(p, coordinates) { const outer = ringLocation(p, coordinates[0]); if (outer !== "inside") return outer; for (const hole of coordinates.slice(1)) { const here = ringLocation(p, hole); if (here !== "outside") return here === "boundary" ? "boundary" : "outside"; } return "inside"; }
function polygonIntersectsBox(coordinates, b) {
  const rect = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]];
  for (const current of coordinates) for (let i = 1; i < current.length; i++) for (let j = 1; j < rect.length; j++) if (seg(current[i - 1], current[i], rect[j - 1], rect[j])) return true;
  if (coordinates[0].some(p => pointInBox(p, b))) return true;
  return rect.slice(0, -1).some(p => polygonLocation(p, coordinates) !== "outside");
}
function featureIntersectsBox(feature, b) { return feature.geometry.coordinates.some(current => polygonIntersectsBox(current, b)); }
function safeFeature(raw, ordinal) {
  const p = raw?.properties, g = raw?.geometry;
  if (raw?.type !== "Feature" || g?.type !== "MultiPolygon" || !multi(g.coordinates) || !p || typeof p !== "object" || Array.isArray(p)
    || Object.keys(p).length !== SAFE_FIELDS.length || SAFE_FIELDS.some(field => !(field in p))
    || !Number.isSafeInteger(p.pit_id) || p.pit_id < 1 || !["樹穴", "花圃"].includes(p.pit_type) || typeof p.district !== "string" || !p.district
    || typeof p.area_m2 !== "number" || !Number.isFinite(p.area_m2) || p.area_m2 < 0) fail("TREE_PITS_TAIPEI_SOURCE_FEATURE_INVALID");
  const vertices = g.coordinates.flat(2); return { type: "Feature", sourceOrdinal: ordinal, geometry: g, properties: { pit_id: p.pit_id, pit_type: p.pit_type, district: p.district, area_m2: p.area_m2 }, bbox: box(vertices) };
}
function keysFor(feature, size) { const [w, s, e, n] = feature.bbox, keys = []; for (let x = Math.floor(w / size); x <= Math.floor(e / size); x++) for (let y = Math.floor(s / size); y <= Math.floor(n / size); y++) { const key = `${x},${y}`; if (featureIntersectsBox(feature, cellBox(key, size))) keys.push(key); } return keys; }
async function writeShard(out, features, bbox) { const payload = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) }); if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("TREE_PITS_TAIPEI_SHARD_LIMIT_EXCEEDED"); const compressed = gzipSync(payload, { level: 9, mtime: 0 }), sha256 = hash(compressed), path = `${sha256}-${Buffer.from(JSON.stringify(bbox)).toString("hex")}.geojson.gz`; await writeFile(resolve(out, path), compressed); return { path, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox }; }
async function split(out, features, bbox, size) { const length = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) }).length; if (features.length <= MAX_ROWS && length <= TARGET_BYTES) return [await writeShard(out, features, bbox)]; if (size <= MIN_CELL) { if (features.length > MAX_ROWS || length > MAX_BYTES) fail("TREE_PITS_TAIPEI_MIN_CELL_LIMIT_EXCEEDED"); return [await writeShard(out, features, bbox)]; } const next = size / 2, buckets = new Map(); for (const feature of features) for (const key of keysFor(feature, next)) { const rows = buckets.get(key) ?? []; rows.push(feature); buckets.set(key, rows); } const shards = []; for (const [key, rows] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await split(out, rows, cellBox(key, next), next)); return shards; }

async function build(root, outputArg) {
  const output = resolve(outputArg ?? outputDefault), temporary = `${output}.building`;
  const [rawBytes, processedBytes] = await Promise.all([readFile(resolve(root, rawPath)), readFile(resolve(root, processedPath))]);
  if (hash(rawBytes) !== RAW_SHA) fail("TREE_PITS_TAIPEI_RAW_SHA_MISMATCH"); if (hash(processedBytes) !== PROCESSED_SHA) fail("TREE_PITS_TAIPEI_PROCESSED_SHA_MISMATCH");
  const collection = JSON.parse(processedBytes); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("TREE_PITS_TAIPEI_SOURCE_COUNT_MISMATCH");
  const ids = new Set(), counts = { 樹穴: 0, 花圃: 0 }, features = collection.features.map((item, ordinal) => { const feature = safeFeature(item, ordinal); if (ids.has(feature.properties.pit_id)) fail("TREE_PITS_TAIPEI_DUPLICATE_PIT_ID"); ids.add(feature.properties.pit_id); counts[feature.properties.pit_type]++; return feature; });
  if (counts.樹穴 !== 50_904 || counts.花圃 !== 5_816 || features.filter(item => item.properties.area_m2 === 0).length !== 1) fail("TREE_PITS_TAIPEI_CONSERVATION_MISMATCH");
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const buckets = new Map(); for (const feature of features) for (const key of keysFor(feature, INITIAL_CELL)) { const rows = buckets.get(key) ?? []; rows.push(feature); buckets.set(key, rows); }
  const shards = []; for (const [key, rows] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) shards.push(...await split(temporary, rows, cellBox(key, INITIAL_CELL), INITIAL_CELL));
  if (!shards.length || shards.length > 1024 || shards.some(shard => shard.featureCount > MAX_ROWS || shard.uncompressedBytes > MAX_BYTES)) fail("TREE_PITS_TAIPEI_PARTITION_MANIFEST_LIMIT_MISMATCH");
  const source = { rawSha256: RAW_SHA, processedSha256: PROCESSED_SHA, rawBytes: rawBytes.length, processedBytes: processedBytes.length, featureCount: ROWS, reference: "https://data.gov.tw/dataset/134908; https://data.taipei/dataset/detail?id=693705fa-4604-4207-bd50-8a9ce9fcfbc6; resource rid=3e2b359b-8dae-46e4-a747-5912d8743d0e" };
  const manifest = { schemaVersion: "pulse-tree-pits-taipei-surface-partitions/1", source, snapshot: "2026-07-14", crs: "EPSG:4326", geometry: "MultiPolygon", cellDegrees: INITIAL_CELL, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  const receipt = { schemaVersion: "pulse-tree-pits-taipei-owner-only/1", source, attribution: "臺北市政府工務局公園路燈工程管理處，臺北市樹穴及花圃圖資，OGDL v1。", license: "OGDL-Taiwan-1.0", snapshot: "2026-07-14 fixed snapshot; live remote currency is not claimed.", safeFields: SAFE_FIELDS, counts: { total: ROWS, tree_pits: counts.樹穴, flower_beds: counts.花圃, zero_area: 1 }, geometry: "Complete source WGS84 MultiPolygon coordinates are retained, including multipart components and holes. These are mapped tree pits and flower beds, not individual tree inventory, canopy, health, planting date, current maintenance, access, or availability.", manifest: { path: "manifest.json", sha256: hash(manifestBytes), bytes: manifestBytes.length }, shards: shards.length };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt)); await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}
const [root = analyticsRoot, output] = process.argv.slice(2); await build(root, output);
