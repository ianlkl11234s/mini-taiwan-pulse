import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const EXPECTED_INPUT_SHA256 = "cfd8b1d1f96466d65d3e5182ac111abcd29356e2f3402b25499d8a207aa80e8d";
const EXPECTED_FEATURE_COUNT = 731;
const EXPECTED_METHOD_COUNTS = Object.freeze({ TGOS: 653, L1: 70, offline_exact: 4, offline_interpolated: 4 });
const EXPECTED_TGOS_COUNT = 653;

function fail(code) { throw new Error(code); }

function usage() {
  console.error("Usage: node scripts/research/build-retail-market-tgos.mjs <processed-input.geojson> [output.geojson]");
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

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument) usage();
else {
  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument ?? "public/research/retail_markets_tgos_20260717.geojson");
  const inputBytes = await readFile(inputPath);
  const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
  if (inputSha256 !== EXPECTED_INPUT_SHA256) fail("RETAIL_MARKETS_INPUT_SHA_MISMATCH");

  let collection;
  try { collection = JSON.parse(inputBytes.toString("utf8")); } catch { fail("RETAIL_MARKETS_INPUT_INVALID_JSON"); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== EXPECTED_FEATURE_COUNT) fail("RETAIL_MARKETS_INPUT_COUNT_MISMATCH");

  const methods = {};
  for (const feature of collection.features) {
    if (!isPointFeature(feature) || typeof feature.properties.coord_method !== "string") fail("RETAIL_MARKETS_INPUT_FEATURE_INVALID");
    methods[feature.properties.coord_method] = (methods[feature.properties.coord_method] ?? 0) + 1;
  }
  if (!sameMethodCounts(methods)) fail("RETAIL_MARKETS_INPUT_METHOD_COUNTS_MISMATCH");

  const features = collection.features.filter(feature => feature.properties.coord_method === "TGOS");
  if (features.length !== EXPECTED_TGOS_COUNT) fail("RETAIL_MARKETS_TGOS_COUNT_MISMATCH");
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log(JSON.stringify({ inputPath, inputSha256, inputFeatures: collection.features.length, methodCounts: methods, outputPath, outputSha256: createHash("sha256").update(output).digest("hex"), outputFeatures: features.length }));
}
