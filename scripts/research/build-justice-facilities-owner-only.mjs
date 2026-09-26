import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const families = [
  { id: "anti-corruption-offices", upstream: "anti_corruption_offices/anti_corruption_offices_20260626.geojson", output: "anti-corruption-offices-owner-20260626.geojson", rows: 66, sha256: "367a849aa628a16d8c9c7a63f0447209e222026671c6faa8df34dea5e4e8de4c", fields: ["entity_id", "name", "level", "facility_subtype", "source", "source_tier", "fetched_at"] },
  { id: "correctional-facilities", upstream: "correctional_facilities/correctional_facilities_20260626.geojson", output: "correctional-facilities-owner-20260626.geojson", rows: 51, sha256: "de96d699fd75452aa144ec326d320245b7dcf1e4ed1c7b2cd85625e88ea94478", fields: ["entity_id", "name", "facility_type", "nature_zh", "source", "source_tier", "fetched_at"] },
  { id: "courts", upstream: "courts/courts_20260626.geojson", output: "courts-owner-20260626.geojson", rows: 35, sha256: "b0024292a0346f8fb15fb9f87152e0faa59680e949f458da722fabea42640a24", fields: ["entity_id", "name", "court_type", "source", "source_tier", "fetched_at"] },
  { id: "immigration-offices", upstream: "immigration_offices/immigration_offices_20260626.geojson", output: "immigration-offices-owner-20260626.geojson", rows: 25, sha256: "4dc884eda6ab1039e7f84cf3d9d3c21d3df266d4c561b9f8cea4a07458dc9f74", fields: ["agency_code", "name", "name_en", "facility_subtype"] },
  { id: "investigation-bureau", upstream: "investigation_bureau/investigation_bureau_20260626.geojson", output: "investigation-bureau-owner-20260626.geojson", rows: 29, sha256: "bf8c9cebf887abf93d2e39d0207992dd0eed245e8e1db5c8fc5c552cdb200769", fields: ["entity_id", "name", "facility_subtype", "source", "source_tier", "fetched_at"] },
  { id: "prosecutors-offices", upstream: "prosecutors_offices/prosecutors_offices_20260626.geojson", output: "prosecutors-offices-owner-20260626.geojson", rows: 29, sha256: "84426ec9ebd8008d48a778e3233c48abe83f4106aab31f0a9479e58b338a2063", fields: ["entity_id", "name", "pros_type", "source", "source_tier", "fetched_at"] },
];

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

const [analyticsRootArg, outputRootArg] = process.argv.slice(2);
if (!analyticsRootArg) fail("Usage: node scripts/research/build-justice-facilities-owner-only.mjs <taipei-gis-analytics-root> [output-directory]");
const analyticsRoot = resolve(analyticsRootArg);
const outputRoot = resolve(outputRootArg ?? "../runtime/owner-only/justice-facilities");
const results = [];

for (const family of families) {
  const input = resolve(analyticsRoot, "data/processed/police_justice", family.upstream);
  const inputBytes = await readFile(input);
  if (sha256(inputBytes) !== family.sha256) fail(`JUSTICE_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_SHA_MISMATCH`);
  const collection = JSON.parse(inputBytes.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail(`JUSTICE_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_COUNT_MISMATCH`);
  const features = collection.features.map((feature, index) => {
    if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) fail(`JUSTICE_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_FEATURE_INVALID`);
    const properties = feature.properties;
    if (family.fields.some(field => properties[field] === undefined || (typeof properties[field] !== "string" && typeof properties[field] !== "number"))) fail(`JUSTICE_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_FIELD_INVALID`);
    return { type: "Feature", geometry: feature.geometry, properties: { record_id: `${family.id}:${String(index + 1).padStart(3, "0")}`, ...Object.fromEntries(family.fields.map(field => [field, properties[field]])) } };
  });
  const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  const output = resolve(outputRoot, family.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, out, "utf8");
  results.push({ dataset: family.id, input, inputSha256: family.sha256, inputRows: family.rows, output, outputSha256: sha256(out), outputRows: features.length, outputBytes: Buffer.byteLength(out), retainedFields: ["record_id", ...family.fields], geometry: { point: features.length, null: 0, invalid: 0 } });
}

console.log(JSON.stringify({ outputRoot, datasets: results }, null, 2));
