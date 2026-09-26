import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const EXPECTED_INPUT_SHA256 = "56eada34f19169830816f95aad695915ae0537eebac8d930d76d80ca9e943adf";
const EXPECTED_FEATURE_COUNT = 702;
const EXPECTED_METHOD_COUNTS = Object.freeze({ TGOS: 462, L1: 239, offline_exact: 1 });
const EXPECTED_TGOS_COUNT = 462;
const OUTPUT_PROPERTIES = ["uid", "name", "type", "county", "town", "address", "org_code", "coord_method"];

function fail(code) { throw new Error(code); }

function usage() {
  console.error("Usage: node scripts/research/build-gov-service-tgos.mjs <processed-input.geojson> [output.geojson]");
  process.exitCode = 2;
}

function isPointFeature(feature) {
  return feature && feature.type === "Feature" && feature.properties && typeof feature.properties === "object"
    && feature.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)
    && feature.geometry.coordinates.length >= 2 && feature.geometry.coordinates.slice(0, 2).every(value => typeof value === "number" && Number.isFinite(value));
}

function sameMethodCounts(actual) {
  const expectedKeys = Object.keys(EXPECTED_METHOD_COUNTS);
  return Object.keys(actual).length === expectedKeys.length && expectedKeys.every(key => actual[key] === EXPECTED_METHOD_COUNTS[key]);
}

function cleanTgosFeature(feature) {
  const properties = {};
  for (const key of OUTPUT_PROPERTIES) {
    if (typeof feature.properties[key] !== "string") fail("GOV_SERVICE_OFFICES_INPUT_PROPERTY_INVALID");
    properties[key] = feature.properties[key];
  }
  if (properties.uid !== `gov_service_offices:${properties.org_code}`) fail("GOV_SERVICE_OFFICES_INPUT_UID_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties };
}

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument) usage();
else {
  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument ?? "../runtime/research-public/gov_service_offices_tgos_20260717.geojson");
  const inputBytes = await readFile(inputPath);
  const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
  if (inputSha256 !== EXPECTED_INPUT_SHA256) fail("GOV_SERVICE_OFFICES_INPUT_SHA_MISMATCH");

  let collection;
  try { collection = JSON.parse(inputBytes.toString("utf8")); } catch { fail("GOV_SERVICE_OFFICES_INPUT_INVALID_JSON"); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== EXPECTED_FEATURE_COUNT) fail("GOV_SERVICE_OFFICES_INPUT_COUNT_MISMATCH");

  const methods = {};
  const sourceUids = new Set();
  for (const feature of collection.features) {
    if (!isPointFeature(feature) || typeof feature.properties.coord_method !== "string") fail("GOV_SERVICE_OFFICES_INPUT_FEATURE_INVALID");
    methods[feature.properties.coord_method] = (methods[feature.properties.coord_method] ?? 0) + 1;
    if (typeof feature.properties.uid !== "string" || sourceUids.has(feature.properties.uid)) fail("GOV_SERVICE_OFFICES_INPUT_UID_INVALID");
    sourceUids.add(feature.properties.uid);
  }
  if (!sameMethodCounts(methods)) fail("GOV_SERVICE_OFFICES_INPUT_METHOD_COUNTS_MISMATCH");

  const features = collection.features.filter(feature => feature.properties.coord_method === "TGOS").map(cleanTgosFeature);
  if (features.length !== EXPECTED_TGOS_COUNT) fail("GOV_SERVICE_OFFICES_TGOS_COUNT_MISMATCH");
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log(JSON.stringify({ inputPath, inputSha256, inputFeatures: collection.features.length, methodCounts: methods, outputPath, outputSha256: createHash("sha256").update(output).digest("hex"), outputFeatures: features.length }));
}
