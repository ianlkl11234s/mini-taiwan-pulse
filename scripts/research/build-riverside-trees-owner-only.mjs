import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const rawRelative = "data/raw/urban_open_space/riverside_trees_taipei.csv";
const processedRelative = "data/processed/urban_open_space/riverside_trees_taipei/riverside_trees_taipei_20260714.geojson";
const rawSha256 = "dbcdd5f4dcb4ecf4681f5c296e9eef8a76d7060a6ce7296f53f91793a66c9cb3";
const processedSha256 = "5c7f87775bb978a80fa07411480919e3af38055cdc54b6b14f92b2ab7495fa94";
const fields = ["tree_id", "species", "species_scientific", "family", "park_name", "manager", "height_m", "dbh_cm", "crown_area_m2", "estimated_age_years", "survey_date", "notes"];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 121.4 && geometry.coordinates[0] <= 121.7 && geometry.coordinates[1] >= 24.9 && geometry.coordinates[1] <= 25.2;

const [root = analyticsRoot, output = "../runtime/owner-only/riverside-trees-taipei/riverside-trees-taipei-owner-20260714.geojson"] = process.argv.slice(2);
const raw = await readFile(resolve(root, rawRelative));
if (hash(raw) !== rawSha256) fail("RIVERSIDE_TREES_RAW_SHA_MISMATCH");
const rawRows = raw.toString("utf8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/).length - 1;
if (rawRows !== 10_921) fail("RIVERSIDE_TREES_RAW_COUNT_MISMATCH");
const processed = await readFile(resolve(root, processedRelative));
if (hash(processed) !== processedSha256) fail("RIVERSIDE_TREES_PROCESSED_SHA_MISMATCH");
let collection; try { collection = JSON.parse(processed.toString("utf8")); } catch { fail("RIVERSIDE_TREES_PROCESSED_JSON_INVALID"); }
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 10_917) fail("RIVERSIDE_TREES_PROCESSED_COUNT_MISMATCH");
let nullNotes = 0; let invalidSurveyDate = 0;
const features = collection.features.map((feature, index) => {
  if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`RIVERSIDE_TREES_POINT_${index}`);
  const p = feature.properties;
  if (typeof p.tree_id !== "string" || !p.tree_id || ["species", "species_scientific", "family", "park_name", "manager", "survey_date"].some(field => typeof p[field] !== "string")
    || ["height_m", "dbh_cm", "crown_area_m2", "estimated_age_years"].some(field => typeof p[field] !== "number" || !Number.isFinite(p[field]))
    || !(p.notes === null || typeof p.notes === "string")) fail(`RIVERSIDE_TREES_PROPERTIES_${index}`);
  if (p.notes === null) nullNotes++;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.survey_date)) invalidSurveyDate++;
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (nullNotes !== 4_538 || invalidSurveyDate !== 2) fail("RIVERSIDE_TREES_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ raw: { path: resolve(root, rawRelative), sha256: rawSha256, rows: rawRows }, processed: { path: resolve(root, processedRelative), sha256: processedSha256, rows: features.length }, retainedFields: fields, nullNotes, invalidSurveyDate, output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length } }));
