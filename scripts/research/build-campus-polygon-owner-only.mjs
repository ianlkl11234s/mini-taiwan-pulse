import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const rawPath = "data/raw/education/campus_polygon/campus_121.zip";
const processedPath = "data/processed/education/campus_polygon/campus_polygon_20260807.geojson";
const outputDefault = "../runtime/owner-only/campus-polygon";
const RAW_SHA = "14fdbec063543c260059f662c380be80ae6f1285c6967e5d35896b11c514eb48";
const PROCESSED_SHA = "950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff";
const ROWS = 4_336, PROCESSED_BYTES = 9_847_540, MAX_ROWS = 3_000, MAX_BYTES = 8 * 1024 * 1024;
const CELL_DEGREES = 0.1, TARGET_BYTES = 700_000;
const SAFE_FIELDS = ["record_id", "school_name", "school_level", "school_level_zh", "is_branch", "area_ha", "county", "county_source", "source_yyyymm"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
const ring = value => Array.isArray(value) && value.length >= 4 && value.every(point) && value[0][0] === value.at(-1)[0] && value[0][1] === value.at(-1)[1];
const polygon = value => Array.isArray(value) && value.length > 0 && value.every(ring);
const bbox = points => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const cellBox = (x, y) => [x * CELL_DEGREES, y * CELL_DEGREES, (x + 1) * CELL_DEGREES, (y + 1) * CELL_DEGREES];
const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (p, a, b) => Math.abs(orient(a, b, p)) <= 1e-12 && p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12;
const segments = (a, b, c, d) => on(a, c, d) || on(b, c, d) || on(c, a, b) || on(d, a, b) || ((orient(a, b, c) > 0) !== (orient(a, b, d) > 0) && (orient(c, d, b) > 0) !== (orient(c, d, a) > 0));
function location(p, rings) { let inside = false; for (let i = 0, j = rings[0].length - 1; i < rings[0].length; j = i++) { const a = rings[0][j], b = rings[0][i]; if (on(p, a, b)) return "boundary"; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside ? "inside" : "outside"; }
function polygonIntersectsBox(rings, b) { const rect = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]; for (const ring of rings) for (let i = 1; i < ring.length; i++) for (let j = 1; j < rect.length; j++) if (segments(ring[i - 1], ring[i], rect[j - 1], rect[j])) return true; return rings[0].some(p => inBox(p, b)) || rect.slice(0, -1).some(p => location(p, rings) !== "outside"); }
function safeFeature(raw, ordinal) {
  const p = raw?.properties, g = raw?.geometry;
  if (raw?.type !== "Feature" || g?.type !== "Polygon" || !polygon(g.coordinates) || !p || typeof p !== "object" || Array.isArray(p)
    || typeof p.school_name !== "string" || !p.school_name || typeof p.school_level !== "string" || !p.school_level
    || !(typeof p.school_level_zh === "string" || p.school_level_zh === null) || typeof p.is_branch !== "boolean"
    || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha) || p.area_ha < 0 || typeof p.county !== "string" || !p.county
    || !["name_prefix", "centroid_sjoin"].includes(p.county_source) || typeof p.YYYYMM !== "string" || !/^\d{6}$/.test(p.YYYYMM)) fail("CAMPUS_POLYGON_SOURCE_FEATURE_INVALID");
  const coords = g.coordinates.flat();
  return { type: "Feature", sourceOrdinal: ordinal, geometry: g, properties: { record_id: String(ordinal), school_name: p.school_name, school_level: p.school_level, school_level_zh: p.school_level_zh, is_branch: p.is_branch, area_ha: p.area_ha, county: p.county, county_source: p.county_source, source_yyyymm: p.YYYYMM }, bbox: bbox(coords) };
}
function keysFor(feature) { const [w, s, e, n] = feature.bbox, keys = []; for (let x = Math.floor(w / CELL_DEGREES); x <= Math.floor(e / CELL_DEGREES); x++) for (let y = Math.floor(s / CELL_DEGREES); y <= Math.floor(n / CELL_DEGREES); y++) if (polygonIntersectsBox(feature.geometry.coordinates, cellBox(x, y))) keys.push([x, y]); return keys; }
async function writeShard(dir, features, shardBbox) { const payload = json({ type: "FeatureCollection", features: features.map(({ bbox: _bbox, ...feature }) => feature) }); if (features.length > MAX_ROWS || payload.length > MAX_BYTES) fail("CAMPUS_POLYGON_SHARD_LIMIT_EXCEEDED"); const compressed = gzipSync(payload, { level: 9, mtime: 0 }); const sha256 = hash(compressed), path = `${sha256}-${Buffer.from(JSON.stringify(shardBbox)).toString("hex")}.geojson.gz`; await writeFile(resolve(dir, path), compressed); return { path, sha256, bytes: compressed.length, encoding: "gzip", uncompressedSha256: hash(payload), uncompressedBytes: payload.length, featureCount: features.length, bbox: shardBbox }; }
async function build(root = analyticsRoot, outputArg) {
  const output = resolve(outputArg ?? outputDefault), temporary = `${output}.building`;
  const [raw, processed] = await Promise.all([readFile(resolve(root, rawPath)), readFile(resolve(root, processedPath))]);
  if (hash(raw) !== RAW_SHA) fail("CAMPUS_POLYGON_RAW_SHA_MISMATCH");
  if (processed.length !== PROCESSED_BYTES || hash(processed) !== PROCESSED_SHA) fail("CAMPUS_POLYGON_PROCESSED_SHA_MISMATCH");
  const collection = JSON.parse(processed); if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("CAMPUS_POLYGON_SOURCE_COUNT_MISMATCH");
  const features = collection.features.map(safeFeature); const nonSchool = features.filter(f => f.properties.school_level === "non_school");
  if (nonSchool.length !== 12 || features.filter(f => f.properties.school_level_zh === null).length !== 12) fail("CAMPUS_POLYGON_SEMANTICS_MISMATCH");
  await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const buckets = new Map(); for (const feature of features) for (const [x, y] of keysFor(feature)) { const key = `${x},${y}`, rows = buckets.get(key) ?? []; rows.push(feature); buckets.set(key, rows); }
  const shards = []; for (const [key, rows] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) { const [x, y] = key.split(",").map(Number); if (rows.length > MAX_ROWS || json({ type: "FeatureCollection", features: rows }).length > TARGET_BYTES) fail("CAMPUS_POLYGON_PARTITION_DENSITY_EXCEEDED"); shards.push(await writeShard(temporary, rows, cellBox(x, y))); }
  const manifest = { schemaVersion: "pulse-campus-polygon-surface-partitions/1", source: { rawSha256: RAW_SHA, processedSha256: PROCESSED_SHA, processedBytes: PROCESSED_BYTES, featureCount: ROWS, reference: "/research/campus-polygon/source-identity/sha256-950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff" }, snapshot: "2026-08-07", crs: "EPSG:4326", geometry: "Polygon", cellDegrees: CELL_DEGREES, shards };
  const manifestBytes = json(manifest); await writeFile(resolve(temporary, "manifest.json"), manifestBytes);
  await writeFile(resolve(temporary, "manifest-receipt.json"), json({ schemaVersion: "pulse-campus-polygon-owner-only/1", source: manifest.source, raw: { path: rawPath, sha256: RAW_SHA }, pmtiles: { sha256: "3735e97933bef4f93d163a607d902607c1c008f1481ad3f674ca4120d74e3f15", featureCount: ROWS }, sidecar: { manifestSha256: hash(manifestBytes), featureCount: ROWS, safeFields: SAFE_FIELDS }, semantics: { geometry: "TGOS school campus reference Polygon; not entrance, access route, school district, attendance boundary, catchment, or walking access", nonSchoolRows: 12, nullSchoolLevelZhRows: 12, sourceTime: "source_yyyymm is source YYYYMM and differs from 2026-08-07 pipeline snapshot" }, license: "OGDL-Taiwan-1.0 (source catalog); localhost owner-only safe-field sidecar." }));
  await rm(output, { recursive: true, force: true }); await rename(temporary, output); return manifest;
}
if (process.argv[1]?.endsWith("build-campus-polygon-owner-only.mjs")) build(analyticsRoot, process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
export { build };
