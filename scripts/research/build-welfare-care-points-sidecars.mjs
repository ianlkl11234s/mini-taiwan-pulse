import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const FAMILIES = [
  {
    input: "ltc_institutions_national.geojson", output: "ltc_institutions_tgos_upstream.geojson",
    sha256: "876b771afdb69676a342750f215fbfdaffd4cdfeaf4b73704d4297a2591c72cb", rows: 3117, selectedRows: 3053,
    properties: ["uid", "name", "welfare_class", "uni_no", "address", "city", "coord_source", "coord_precision", "src_datasets", "n_src", "sub_code", "permit_status", "inst_code", "src_system"],
  },
  {
    input: "elderly_care_homes_national.geojson", output: "elderly_care_homes_tgos_upstream.geojson",
    sha256: "0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f", rows: 1160, selectedRows: 1043,
    properties: ["uid", "name", "welfare_class", "address", "city", "coord_source", "coord_precision", "src_datasets", "n_src", "sub_code", "permit_status", "inst_code", "src_system", "attr_type", "beds_approved", "target", "licensed_at", "district", "phone", "uni_no", "nature", "authority", "subtype"],
  },
];

function fail(code) { throw new Error(code); }
function isPoint(feature) {
  const coordinates = feature?.geometry?.coordinates;
  return feature?.type === "Feature" && feature.properties && feature.geometry?.type === "Point" && Array.isArray(coordinates)
    && coordinates.length === 2 && coordinates.every(value => typeof value === "number" && Number.isFinite(value))
    && coordinates[0] >= -180 && coordinates[0] <= 180 && coordinates[1] >= -90 && coordinates[1] <= 90;
}
function project(feature, family) {
  const properties = {};
  for (const key of family.properties) {
    const value = feature.properties[key];
    if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number") fail("WELFARE_CARE_POINTS_PROPERTY_INVALID");
    properties[key] = value ?? null;
  }
  return { type: "Feature", geometry: feature.geometry, properties };
}

const [inputDir = "public/welfare", outputDir = "public/research"] = process.argv.slice(2);
const receipts = [];
for (const family of FAMILIES) {
  const inputPath = resolve(inputDir, family.input);
  const bytes = await readFile(inputPath);
  const inputSha256 = createHash("sha256").update(bytes).digest("hex");
  if (inputSha256 !== family.sha256) fail("WELFARE_CARE_POINTS_INPUT_SHA_MISMATCH");
  let collection;
  try { collection = JSON.parse(bytes.toString("utf8")); } catch { fail("WELFARE_CARE_POINTS_INPUT_INVALID_JSON"); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail("WELFARE_CARE_POINTS_INPUT_COUNT_MISMATCH");
  const uids = new Set();
  for (const feature of collection.features) {
    if (!isPoint(feature) || typeof feature.properties.uid !== "string" || uids.has(feature.properties.uid)) fail("WELFARE_CARE_POINTS_INPUT_FEATURE_INVALID");
    uids.add(feature.properties.uid);
  }
  const features = collection.features.filter(feature => feature.properties.coord_source === "tgos_upstream" && feature.properties.coord_precision === "upstream").map(feature => project(feature, family));
  if (features.length !== family.selectedRows) fail("WELFARE_CARE_POINTS_SELECTION_COUNT_MISMATCH");
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  const outputPath = resolve(outputDir, family.output);
  await mkdir(resolve(outputDir), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  receipts.push({ inputPath, inputSha256, inputRows: family.rows, outputPath, outputSha256: createHash("sha256").update(output).digest("hex"), outputRows: features.length });
}
console.log(JSON.stringify(receipts));
