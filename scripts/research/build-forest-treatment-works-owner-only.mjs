import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const processedRelative = "data/processed/forestry/forestry_treatment_works/forestry_treatment_works.geojson";
const rawRelative = "data/raw/forestry/forestry_treatment_works/raw.json";
const processedSha256 = "266a981d42ec5c601b1fdf6b79097cadb96724a13eb815dc7b3680960efe8e2b";
const rawSha256 = "2c623886278f0c6acbb6b9c5fcc65a80f025730adaf06cc6d677982d99288b22";
const safeFields = ["planyear", "eng_no", "eng_name", "city", "country", "coord_rule"];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value));

const [root = analyticsRoot, output = "../runtime/owner-only/forest-treatment-works/forest-treatment-works-owner-20260802.geojson"] = process.argv.slice(2);
const raw = await readFile(resolve(root, rawRelative));
if (hash(raw) !== rawSha256) fail("FOREST_TREATMENT_WORKS_RAW_SHA_MISMATCH");
const rawRows = JSON.parse(raw.toString("utf8"));
if (!Array.isArray(rawRows) || rawRows.length !== 9_999) fail("FOREST_TREATMENT_WORKS_RAW_SHAPE_MISMATCH");

const processed = await readFile(resolve(root, processedRelative));
if (hash(processed) !== processedSha256) fail("FOREST_TREATMENT_WORKS_PROCESSED_SHA_MISMATCH");
const collection = JSON.parse(processed.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 6_213) fail("FOREST_TREATMENT_WORKS_PROCESSED_SHAPE_MISMATCH");
const coordRules = new Map(); let blankCity = 0; let blankCountry = 0;
const features = collection.features.map((feature, index) => {
  if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`FOREST_TREATMENT_WORKS_POINT_${index}`);
  const properties = feature.properties;
  if (!Number.isFinite(properties.planyear) || ["eng_no", "eng_name", "city", "country", "coord_rule"].some(field => typeof properties[field] !== "string")) fail(`FOREST_TREATMENT_WORKS_PROPERTIES_${index}`);
  if (properties.city === "") blankCity++;
  if (properties.country === "") blankCountry++;
  coordRules.set(properties.coord_rule, (coordRules.get(properties.coord_rule) ?? 0) + 1);
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(field => [field, properties[field]])) };
});
const expectedRules = JSON.stringify(Object.fromEntries([...coordRules.entries()].sort()));
if (blankCity !== 77 || blankCountry !== 77 || expectedRules !== JSON.stringify({ tm2: 6084, tm2_swapped: 115, wgs84: 3, wgs84_swapped: 11 })) fail("FOREST_TREATMENT_WORKS_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ raw: { path: resolve(root, rawRelative), sha256: rawSha256, rows: rawRows.length }, processed: { path: resolve(root, processedRelative), sha256: processedSha256, rows: features.length }, retainedFields: safeFields, blankCity, blankCountry, coordRules: Object.fromEntries(coordRules), output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length }, hold: "raw current snapshot has 9999 rows while processed provenance documents 6275; do not claim raw-to-processed version continuity" }));
