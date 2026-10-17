import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = { sha256: "7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3", rows: 4315 };
const expectedLevels = { "國民小學": 2614, "附設國民小學": 42, "國民中學": 736, "附設國民中學": 228, "高級中等學校": 508, "大專校院": 140, "空大及大專校院附設進修學校": 10, "宗教研修學院": 9, "特殊教育學校": 28 };
const expectedRegions = { null: 3163, "偏遠": 830, "特偏": 192, "極偏": 130 };
const safeFields = ["code", "school_name", "school_level", "city", "district", "system_type", "region_type"];

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const counts = values => Object.fromEntries([...values.reduce((out, value) => out.set(String(value), (out.get(String(value)) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const same = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => actual[key] === value);
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-edu-schools-owner-only.mjs <taiwan_schools_2024.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "../runtime/owner-only/edu-schools/taiwan-schools-2024-owner.geojson");
const bytes = await readFile(input);
if (sha256(bytes) !== source.sha256) fail("EDU_SCHOOLS_UPSTREAM_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== source.rows) fail("EDU_SCHOOLS_UPSTREAM_COUNT_MISMATCH");
const features = collection.features.map(feature => {
  const properties = feature?.properties;
  if (feature?.type !== "Feature" || !properties || !validPoint(feature.geometry)
    || typeof properties.code !== "string" || !properties.code
    || ["school_name", "school_level", "city", "district"].some(field => typeof properties[field] !== "string" || !properties[field])
    || (properties.system_type !== null && (typeof properties.system_type !== "string" || !properties.system_type))
    || (properties.region_type !== null && !["偏遠", "特偏", "極偏"].includes(properties.region_type))) fail("EDU_SCHOOLS_UPSTREAM_FEATURE_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(field => [field, properties[field] ?? null])) };
});
if (!same(counts(collection.features.map(feature => feature.properties.school_level)), expectedLevels)
  || !same(counts(collection.features.map(feature => feature.properties.region_type)), expectedRegions)) fail("EDU_SCHOOLS_UPSTREAM_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out, "utf8");
console.log(JSON.stringify({ input, inputSha256: source.sha256, inputRows: source.rows, output, outputSha256: sha256(out), outputBytes: Buffer.byteLength(out), outputRows: features.length, geometry: { point: features.length, null: 0, invalid: 0 }, schoolLevels: expectedLevels, regionTypes: expectedRegions, retainedFields: safeFields }));
