import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const rawRelative = "data/raw/tourism/tourism_factory/tourism_factory_20260723.csv";
const processedRelative = "data/processed/tourism/tourism_factory/tourism_factory_20260723.geojson";
const rawSha256 = "5d2ee4616bbb3608c115e4c4c54647917564d67c1603e17684b80239662af60f";
const processedSha256 = "a47d7ba0ff6e1221a4f94cac1aeeff75308d2779aed57d26a2f65895d7ee4014";
const safeFields = ["id", "region", "city", "name", "zipcode", "geocode_source", "geocode_precision"];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2 && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const counts = values => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const equal = (left, right) => Object.keys(left).length === Object.keys(right).length && Object.entries(right).every(([key, value]) => left[key] === value);

const [root = analyticsRoot, output = "../runtime/owner-only/tourism-factories/tourism-factories-owner-20260723.geojson"] = process.argv.slice(2);
const raw = await readFile(resolve(root, rawRelative)); if (hash(raw) !== rawSha256) fail("TOURISM_FACTORIES_RAW_SHA_MISMATCH");
const rawCount = (raw.toString("utf8").replace(/^\uFEFF/, "").match(/^\d+,(?:北部|中部|南部|東部),/gm) ?? []).length; if (rawCount !== 158) fail("TOURISM_FACTORIES_RAW_COUNT_MISMATCH");
const processed = await readFile(resolve(root, processedRelative)); if (hash(processed) !== processedSha256) fail("TOURISM_FACTORIES_PROCESSED_SHA_MISMATCH");
let collection; try { collection = JSON.parse(processed); } catch { fail("TOURISM_FACTORIES_PROCESSED_JSON_INVALID"); }
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 158) fail("TOURISM_FACTORIES_PROCESSED_COUNT_MISMATCH");
const ids = new Set(); const features = collection.features.map(feature => {
  if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail("TOURISM_FACTORIES_SOURCE_FEATURE_INVALID");
  const p = feature.properties;
  if (typeof p.id !== "string" || !p.id || ids.has(p.id) || safeFields.some(field => typeof p[field] !== "string" || !p[field]) || !["google", "offline_l1", "offline_l15", "offline_l2"].includes(p.geocode_source) || !["exact", "approximate", "interpolated", "cached"].includes(p.geocode_precision)) fail("TOURISM_FACTORIES_SOURCE_PROPERTIES_INVALID");
  ids.add(p.id); return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(field => [field, p[field]])) };
});
const geocodeSource = counts(collection.features.map(feature => feature.properties.geocode_source));
if (ids.size !== 158 || !equal(geocodeSource, { google: 34, offline_l1: 52, offline_l15: 17, offline_l2: 55 })) fail("TOURISM_FACTORIES_SOURCE_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`); const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ raw: { path: resolve(root, rawRelative), sha256: rawSha256, rows: 158 }, processed: { path: resolve(root, processedRelative), sha256: processedSha256, rows: 158 }, geocodeSource, retainedFields: safeFields, excludedFields: ["address", "phone", "website", "lat", "lon"], output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length } }));
