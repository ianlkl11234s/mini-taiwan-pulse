import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const input = {
  sha256: "ac0c94e29487b56589d25bd301ff4369f931dc166a27b446591ac405fe1d7e2a",
  rows: 1425,
  geometry: { point: 1396, null: 29 },
  welfareClass: { child_dev: 1107, child_welfare: 122, parent_child_center: 196 },
  coordStatus: { no_coord: 29, ok: 1396 },
  coordSource: { google: 146, offline_l1: 498, offline_l15: 166, offline_l2: 546, tgos_upstream: 40, null: 29 },
  coordPrecision: { approximate: 48, cached: 498, exact: 635, interpolated: 175, upstream: 40, null: 29 },
};
const safeFields = ["uid", "name", "welfare_class", "city", "coord_status", "coord_source", "coord_precision", "src_datasets", "n_src", "class_conflict", "unit_type", "service_mode"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const count = values => Object.fromEntries([...values.reduce((result, value) => result.set(value ?? "null", (result.get(value ?? "null") ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const same = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => actual[key] === value);
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && Math.abs(geometry.coordinates[0]) <= 180 && Math.abs(geometry.coordinates[1]) <= 90;

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-welfare-child-services-owner-only.mjs <child_services_20260812.geojson> [output.geojson]");
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg ?? "../runtime/owner-only/welfare-child-services/welfare-child-services-owner-20260812.geojson");
const bytes = await readFile(inputPath);
if (sha256(bytes) !== input.sha256) fail("WELFARE_CHILD_SERVICES_INPUT_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== input.rows) fail("WELFARE_CHILD_SERVICES_INPUT_COUNT_MISMATCH");

const ids = new Set();
const features = collection.features.map(feature => {
  const properties = feature?.properties;
  if (feature?.type !== "Feature" || !properties || typeof properties.uid !== "string" || !properties.uid || ids.has(properties.uid)
    || typeof properties.name !== "string" || !properties.name || typeof properties.welfare_class !== "string" || !properties.welfare_class
    || typeof properties.coord_status !== "string" || !properties.coord_status || typeof properties.src_datasets !== "string" || !properties.src_datasets
    || !Number.isSafeInteger(properties.n_src) || properties.n_src < 1) fail("WELFARE_CHILD_SERVICES_INPUT_FEATURE_INVALID");
  if (feature.geometry !== null && !validPoint(feature.geometry)) fail("WELFARE_CHILD_SERVICES_INPUT_GEOMETRY_INVALID");
  if (properties.coord_status === "ok" && (!validPoint(feature.geometry) || typeof properties.coord_source !== "string" || typeof properties.coord_precision !== "string")) fail("WELFARE_CHILD_SERVICES_INPUT_COORDINATE_SEMANTICS_INVALID");
  if (properties.coord_status === "no_coord" && (feature.geometry !== null || properties.coord_source !== null || properties.coord_precision !== null)) fail("WELFARE_CHILD_SERVICES_INPUT_UNLOCATED_SEMANTICS_INVALID");
  ids.add(properties.uid);
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(field => [field, properties[field] ?? null])) };
});
const source = collection.features;
const geometry = { point: source.filter(feature => validPoint(feature.geometry)).length, null: source.filter(feature => feature.geometry === null).length };
if (ids.size !== input.rows || !same(geometry, input.geometry)
  || !same(count(source.map(feature => feature.properties.welfare_class)), input.welfareClass)
  || !same(count(source.map(feature => feature.properties.coord_status)), input.coordStatus)
  || !same(count(source.map(feature => feature.properties.coord_source)), input.coordSource)
  || !same(count(source.map(feature => feature.properties.coord_precision)), input.coordPrecision)) fail("WELFARE_CHILD_SERVICES_INPUT_SEMANTICS_MISMATCH");

const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");
console.log(JSON.stringify({ inputPath, inputSha256: input.sha256, inputRows: input.rows, outputPath, outputSha256: sha256(output), outputBytes: Buffer.byteLength(output), outputRows: features.length, geometry, welfareClass: input.welfareClass, coordStatus: input.coordStatus, coordSource: input.coordSource, coordPrecision: input.coordPrecision, retainedFields: safeFields }));
