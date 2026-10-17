import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const FAMILIES = [
  { key: "ltc", inputSha256: "876b771afdb69676a342750f215fbfdaffd4cdfeaf4b73704d4297a2591c72cb", rows: 3117, output: "welfare-ltc-institutions-owner-20260925.geojson", coordinateSource: { google: 29, offline_l1: 9, offline_l15: 1, offline_l2: 25, tgos_upstream: 3053 }, coordinatePrecision: { approximate: 6, cached: 9, exact: 45, interpolated: 4, upstream: 3053 }, nulls: { inst_code: 0, permit_status: 0, src_system: 0, sub_code: 0, uni_no: 17 } },
  { key: "elderly", inputSha256: "0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f", rows: 1160, output: "welfare-elderly-care-homes-owner-20260925.geojson", coordinateSource: { google: 33, offline_l1: 10, offline_l15: 28, offline_l2: 46, tgos_upstream: 1043 }, coordinatePrecision: { approximate: 9, cached: 10, exact: 67, interpolated: 31, upstream: 1043 }, nulls: { inst_code: 81, permit_status: 81, src_system: 81, sub_code: 81, uni_no: 1090 } },
];
const SAFE_FIELDS = ["uid", "name", "welfare_class", "city", "sub_code", "permit_status", "coord_source", "coord_precision", "src_datasets", "n_src", "inst_code", "uni_no", "src_system"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const equal = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => actual[key] === value);
const counts = values => Object.fromEntries([...values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2 && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && Math.abs(geometry.coordinates[0]) <= 180 && Math.abs(geometry.coordinates[1]) <= 90;

const args = process.argv.slice(2);
if (args.length < FAMILIES.length || args.length > FAMILIES.length + 1) fail("Usage: node scripts/research/build-welfare-care-points-owner-only.mjs <ltc.geojson> <elderly.geojson> [output-dir]");
const outputDir = resolve(args[2] ?? "../runtime/owner-only/welfare-care");
const receipts = [];
for (const [index, family] of FAMILIES.entries()) {
  const inputPath = resolve(args[index]);
  const bytes = await readFile(inputPath);
  if (sha256(bytes) !== family.inputSha256) fail(`WELFARE_${family.key.toUpperCase()}_INPUT_SHA_MISMATCH`);
  let collection;
  try { collection = JSON.parse(bytes.toString("utf8")); } catch { fail(`WELFARE_${family.key.toUpperCase()}_INPUT_INVALID_JSON`); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail(`WELFARE_${family.key.toUpperCase()}_INPUT_COUNT_MISMATCH`);
  const ids = new Set();
  const nulls = { inst_code: 0, permit_status: 0, src_system: 0, sub_code: 0, uni_no: 0 };
  const features = collection.features.map(feature => {
    const properties = feature?.properties;
    if (feature?.type !== "Feature" || !properties || !point(feature.geometry) || typeof properties.uid !== "string" || !properties.uid || ids.has(properties.uid)
      || ["name", "welfare_class", "city", "coord_source", "coord_precision", "src_datasets"].some(field => typeof properties[field] !== "string" || !properties[field])
      || !Number.isSafeInteger(properties.n_src) || properties.n_src < 1) fail(`WELFARE_${family.key.toUpperCase()}_INPUT_FEATURE_INVALID`);
    ids.add(properties.uid);
    for (const field of Object.keys(nulls)) {
      if (properties[field] === undefined || properties[field] === null) nulls[field]++;
      else if (typeof properties[field] !== "string" || !properties[field]) fail(`WELFARE_${family.key.toUpperCase()}_INPUT_OPTIONAL_FIELD_INVALID`);
    }
    return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, properties[field] ?? null])) };
  });
  if (ids.size !== family.rows || !equal(counts(collection.features.map(feature => feature.properties.coord_source)), family.coordinateSource) || !equal(counts(collection.features.map(feature => feature.properties.coord_precision)), family.coordinatePrecision) || !equal(nulls, family.nulls)) fail(`WELFARE_${family.key.toUpperCase()}_INPUT_SEMANTICS_MISMATCH`);
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  const outputPath = resolve(outputDir, family.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  receipts.push({ family: family.key, inputPath, inputSha256: family.inputSha256, inputRows: family.rows, coordinateSource: family.coordinateSource, coordinatePrecision: family.coordinatePrecision, nulls: family.nulls, outputPath, outputSha256: sha256(output), outputBytes: Buffer.byteLength(output), outputRows: features.length, geometry: { point: features.length, null: 0, invalid: 0 }, retainedFields: SAFE_FIELDS });
}
console.log(JSON.stringify({ receipts }));
