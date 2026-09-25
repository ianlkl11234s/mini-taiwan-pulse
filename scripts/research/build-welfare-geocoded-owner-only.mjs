import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const commonFields = ["uid", "name", "welfare_class", "city", "sub_code", "permit_status", "coord_source", "coord_precision", "src_datasets", "n_src", "inst_code", "uni_no", "src_system"];
const families = [
  { key: "childcare", inputSha256: "34511cde4fd56b742623c54df7e807c135289c72efd90db1578d18c407423786", rows: 1578, output: "welfare-childcare-owner-20260925.geojson", coordinateSource: { google: 221, offline_l1: 1, offline_l15: 1, offline_l2: 1, tgos_upstream: 1354 }, coordinatePrecision: { approximate: 16, cached: 1, exact: 200, interpolated: 7, upstream: 1354 }, nulls: { inst_code: 0, permit_status: 0, src_system: 0, sub_code: 0, uni_no: 72 } },
  { key: "disability", inputSha256: "1317b144b57c19f8a580ee617b23f1e88adaee81ff271c0e3c9d405e21b001f6", rows: 334, output: "welfare-disability-owner-20260925.geojson", coordinateSource: { google: 7, offline_l1: 2, offline_l15: 4, offline_l2: 15, tgos_upstream: 306 }, coordinatePrecision: { approximate: 3, cached: 2, exact: 19, interpolated: 4, upstream: 306 }, nulls: { inst_code: 20, permit_status: 20, src_system: 20, sub_code: 20, uni_no: 266 } },
  { key: "social-work-orgs", inputSha256: "697c1eced0ae73e04768606cc2b326b08bd1d76050d8aa4320c539e5c97a1e19", rows: 587, output: "welfare-social-work-orgs-owner-20260925.geojson", coordinateSource: { google: 26, offline_l1: 3, offline_l2: 7, tgos_upstream: 551 }, coordinatePrecision: { approximate: 10, cached: 3, exact: 22, interpolated: 1, upstream: 551 }, nulls: { inst_code: 0, permit_status: 0, src_system: 0, sub_code: 0, uni_no: 61 } },
];

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const equal = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => actual[key] === value);
const counts = values => Object.fromEntries([...values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && Math.abs(geometry.coordinates[0]) <= 180 && Math.abs(geometry.coordinates[1]) <= 90;

const inputArguments = process.argv.slice(2);
if (inputArguments.length < families.length || inputArguments.length > families.length + 1) {
  fail("Usage: node scripts/research/build-welfare-geocoded-owner-only.mjs <childcare.geojson> <disability.geojson> <social-work-orgs.geojson> [output-dir]");
}

const outputDir = resolve(inputArguments[3] ?? "../runtime/owner-only/welfare-geocoded");
const receipts = [];
for (const [index, family] of families.entries()) {
  const inputPath = resolve(inputArguments[index]);
  const inputBytes = await readFile(inputPath);
  if (sha256(inputBytes) !== family.inputSha256) fail(`WELFARE_${family.key.toUpperCase().replaceAll("-", "_")}_INPUT_SHA_MISMATCH`);
  const collection = JSON.parse(inputBytes.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail(`WELFARE_${family.key.toUpperCase().replaceAll("-", "_")}_INPUT_COUNT_MISMATCH`);

  const ids = new Set();
  const nulls = { inst_code: 0, permit_status: 0, src_system: 0, sub_code: 0, uni_no: 0 };
  const features = collection.features.map(feature => {
    const properties = feature?.properties;
    if (feature?.type !== "Feature" || !properties || !point(feature.geometry)
      || typeof properties.uid !== "string" || !properties.uid || ids.has(properties.uid)
      || ["name", "welfare_class", "city", "coord_source", "coord_precision", "src_datasets"].some(field => typeof properties[field] !== "string" || !properties[field])
      || !Number.isSafeInteger(properties.n_src) || properties.n_src < 1) fail(`WELFARE_${family.key.toUpperCase().replaceAll("-", "_")}_INPUT_FEATURE_INVALID`);
    ids.add(properties.uid);
    for (const field of Object.keys(nulls)) {
      if (properties[field] === undefined || properties[field] === null) nulls[field]++;
      else if (typeof properties[field] !== "string" || !properties[field]) fail(`WELFARE_${family.key.toUpperCase().replaceAll("-", "_")}_INPUT_OPTIONAL_FIELD_INVALID`);
    }
    return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(commonFields.map(field => [field, properties[field] ?? null])) };
  });
  if (ids.size !== family.rows || !equal(counts(collection.features.map(feature => feature.properties.coord_source)), family.coordinateSource)
    || !equal(counts(collection.features.map(feature => feature.properties.coord_precision)), family.coordinatePrecision)
    || !equal(nulls, family.nulls)) fail(`WELFARE_${family.key.toUpperCase().replaceAll("-", "_")}_INPUT_SEMANTICS_MISMATCH`);

  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  const outputPath = resolve(outputDir, family.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  receipts.push({ family: family.key, inputPath, inputSha256: family.inputSha256, inputRows: family.rows, coordinateSource: family.coordinateSource, coordinatePrecision: family.coordinatePrecision, nulls: family.nulls, outputPath, outputSha256: sha256(output), outputBytes: Buffer.byteLength(output), outputRows: features.length, geometry: { point: features.length, null: 0, invalid: 0 }, retainedFields: commonFields });
}
console.log(JSON.stringify({ receipts }));
