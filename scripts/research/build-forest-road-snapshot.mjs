#!/usr/bin/env node
/**
 * Builds the research-only, immutable 2D line snapshot from the deployed
 * Forestry GeoJSON.  It deliberately retains complete LineStrings: this
 * artifact is not a display tile and must not be regenerated from PMTiles.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inputPath = resolve(root, "public/forestry/forest_roads.geojson");
const outputDir = resolve(root, "../runtime/research-public/forest-roads");
const outputName = "forest-roads-2d.geojson";
const expectedInputSha256 = "68f26143a39beba971fa1517bda91334d378241de9c320fc52c68e8c1a551f16";
const sha256 = value => createHash("sha256").update(value).digest("hex");

function fail(code) { throw new Error(code); }
function finiteCoordinate(value) {
  return Array.isArray(value) && value.length === 3 && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90 && value[2] === 0;
}
function nullableString(value) { return value === null || typeof value === "string" ? value : fail("INVALID_SOURCE_PROPERTY"); }
function nullableNumber(value) { return value === null || typeof value === "number" && Number.isFinite(value) ? value : fail("INVALID_SOURCE_PROPERTY"); }

const input = await readFile(inputPath);
if (sha256(input) !== expectedInputSha256) fail("FOREST_ROAD_SOURCE_SHA_MISMATCH");
const source = JSON.parse(input.toString("utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== 107) fail("INVALID_FOREST_ROAD_SOURCE");

let vertexCount = 0;
const features = source.features.map((feature, index) => {
  if (feature?.type !== "Feature" || feature.geometry?.type !== "LineString" || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2 || !feature.geometry.coordinates.every(finiteCoordinate) || !feature.properties || typeof feature.properties !== "object") fail("INVALID_FOREST_ROAD_FEATURE");
  vertexCount += feature.geometry.coordinates.length;
  const p = feature.properties;
  const recordId = `forest-road-${expectedInputSha256.slice(0, 16)}-${String(index + 1).padStart(3, "0")}`;
  return {
    type: "Feature",
    properties: {
      record_id: recordId,
      road_name: typeof p["林道名"] === "string" && p["林道名"] ? p["林道名"] : fail("INVALID_FOREST_ROAD_NAME"),
      road_number: typeof p.number === "string" && p.number ? p.number : fail("INVALID_FOREST_ROAD_NUMBER"),
      branch: typeof p["主支線"] === "string" && p["主支線"] ? p["主支線"] : fail("INVALID_FOREST_ROAD_BRANCH"),
      forestry_district: typeof p.DIST_C === "string" && p.DIST_C ? p.DIST_C : fail("INVALID_FOREST_ROAD_DISTRICT"),
      county: typeof p["縣市"] === "string" && p["縣市"] ? p["縣市"] : fail("INVALID_FOREST_ROAD_COUNTY"),
      township: nullableString(p["鄉鎮"]),
      road_kind: nullableString(p["林道種"]),
      road_grade: nullableString(p["林道規"]),
      vehicle_length_km: nullableNumber(p["車行長"]),
      walking_length_km: nullableNumber(p["步行長"]),
      interrupted_length_km: nullableNumber(p["中斷長"]),
      reviewed_length_km: nullableNumber(p["檢討後"]),
      control_point: nullableString(p["管制點"]),
      note: nullableString(p["備註"]),
    },
    geometry: { type: "LineString", coordinates: feature.geometry.coordinates.map(([lng, lat]) => [lng, lat]) },
  };
});
if (vertexCount !== 329885) fail("FOREST_ROAD_VERTEX_COUNT_MISMATCH");
const artifact = JSON.stringify({ type: "FeatureCollection", features });
const artifactBytes = Buffer.byteLength(artifact);
const artifactSha256 = sha256(artifact);
const manifest = JSON.stringify({
  schema_version: 1,
  purpose: "research_fixed_line_snapshot",
  source: {
    path: "public/forestry/forest_roads.geojson", sha256: expectedInputSha256, bytes: input.byteLength,
    publisher: "林業及自然保育署", dataset_id: "datagov:38213", upstream_resource_created_at: "2024-04-25",
    license: "OGDL-Taiwan-1.0",
  },
  artifact: { path: outputName, sha256: artifactSha256, bytes: artifactBytes, features: features.length, vertices: vertexCount, geometry: "LineString EPSG:4326 2D; source Z=0 intentionally omitted" },
});
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, outputName), artifact);
await writeFile(resolve(outputDir, "manifest.json"), manifest);
process.stdout.write(`${outputName}\t${artifactSha256}\t${artifactBytes}\n`);
