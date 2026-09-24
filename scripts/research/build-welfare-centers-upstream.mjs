import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const EXPECTED_INPUT_SHA256 = "5d38217ad725855d1386bb6e3308ee490da2f1dda2c114fd7ff86474caebac50";
const EXPECTED_FEATURE_COUNT = 162;
const EXPECTED_METHOD_COUNTS = Object.freeze({ upstream_tgos: 153, offline_l1_cached: 5, google_approximate: 3, google_exact: 1 });
const EXPECTED_UPSTREAM_TGOS_COUNT = 153;
const OUTPUT_PROPERTIES = ["uid", "name", "county", "town", "address", "coord_method"];

function fail(code) { throw new Error(code); }

function usage() {
  console.error("Usage: node scripts/research/build-welfare-centers-upstream.mjs <processed-input.geojson> [output.geojson]");
  process.exitCode = 2;
}

function isWgs84Point(feature) {
  const coordinates = feature?.geometry?.coordinates;
  return feature?.type === "Feature" && feature.properties && typeof feature.properties === "object"
    && feature.geometry?.type === "Point" && Array.isArray(coordinates) && coordinates.length === 2
    && coordinates.every(value => typeof value === "number" && Number.isFinite(value))
    && coordinates[0] >= -180 && coordinates[0] <= 180 && coordinates[1] >= -90 && coordinates[1] <= 90;
}

function sameMethodCounts(actual) {
  const expectedKeys = Object.keys(EXPECTED_METHOD_COUNTS);
  return Object.keys(actual).length === expectedKeys.length && expectedKeys.every(key => actual[key] === EXPECTED_METHOD_COUNTS[key]);
}

function cleanUpstreamTgosFeature(feature) {
  const properties = {};
  for (const key of OUTPUT_PROPERTIES) {
    if (typeof feature.properties[key] !== "string" || !feature.properties[key].trim()) fail("WELFARE_CENTERS_INPUT_PROPERTY_INVALID");
    properties[key] = feature.properties[key];
  }
  if (!/^welfare_centers:[a-f0-9]{8}(?:-\d+)?$/.test(properties.uid)) fail("WELFARE_CENTERS_INPUT_UID_INVALID");
  if (properties.coord_method !== "upstream_tgos") fail("WELFARE_CENTERS_INPUT_COORD_METHOD_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties };
}

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument) usage();
else {
  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument ?? "public/research/welfare_centers_upstream_20260812.geojson");
  const inputBytes = await readFile(inputPath);
  const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
  if (inputSha256 !== EXPECTED_INPUT_SHA256) fail("WELFARE_CENTERS_INPUT_SHA_MISMATCH");

  let collection;
  try { collection = JSON.parse(inputBytes.toString("utf8")); } catch { fail("WELFARE_CENTERS_INPUT_INVALID_JSON"); }
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== EXPECTED_FEATURE_COUNT) fail("WELFARE_CENTERS_INPUT_COUNT_MISMATCH");

  const methods = {};
  const sourceUids = new Set();
  for (const feature of collection.features) {
    if (!isWgs84Point(feature) || typeof feature.properties.coord_method !== "string") fail("WELFARE_CENTERS_INPUT_FEATURE_INVALID");
    methods[feature.properties.coord_method] = (methods[feature.properties.coord_method] ?? 0) + 1;
    if (typeof feature.properties.uid !== "string" || sourceUids.has(feature.properties.uid)) fail("WELFARE_CENTERS_INPUT_UID_INVALID");
    sourceUids.add(feature.properties.uid);
  }
  if (!sameMethodCounts(methods)) fail("WELFARE_CENTERS_INPUT_METHOD_COUNTS_MISMATCH");

  const features = collection.features.filter(feature => feature.properties.coord_method === "upstream_tgos").map(cleanUpstreamTgosFeature);
  if (features.length !== EXPECTED_UPSTREAM_TGOS_COUNT) fail("WELFARE_CENTERS_UPSTREAM_TGOS_COUNT_MISMATCH");
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log(JSON.stringify({ inputPath, inputSha256, inputFeatures: collection.features.length, methodCounts: methods, outputPath, outputSha256: createHash("sha256").update(output).digest("hex"), outputFeatures: features.length }));
}
